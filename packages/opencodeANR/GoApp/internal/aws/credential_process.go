package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentity"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/clouds-anr/GovClaudeClient/internal/auth"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// AWSCredentials is the JSON format expected by AWS credential_process.
type AWSCredentials struct {
	Version        int    `json:"Version"`
	AccessKeyId    string `json:"AccessKeyId"`
	SecretAccessKey string `json:"SecretAccessKey"`
	SessionToken   string `json:"SessionToken"`
	Expiration     string `json:"Expiration"`
}

// RunCredentialProcess is the main entry point for --credential-process mode.
// It checks cache, authenticates if needed, federates, caches, and outputs JSON.
func RunCredentialProcess(cfg *config.AppConfig) error {
	profile := &cfg.Profile
	logging.Debug("credential-process starting", "profile", profile.ProfileName)

	// 1. Check cached credentials
	cached, err := GetCachedCredentials(profile)
	if err == nil && cached != nil {
		logging.Debug("using cached credentials", "expires", cached.Expiration)

		// Check quota on cache hit (for near-realtime enforcement)
		if err := RunQuotaCheckDuringCredentialProcess(cfg); err != nil {
			return err
		}

		return OutputCredentialProcess(*cached)
	}

	// 2. Port-based locking: try to authenticate
	logging.Debug("no cached credentials, starting OIDC auth")
	tokens, err := auth.AuthenticateOIDC(context.Background(), profile)
	if err != nil {
		logging.Error("OIDC authentication failed", "error", err)
		return fmt.Errorf("OIDC authentication failed: %w", err)
	}
	logging.Debug("OIDC authentication successful")

	// 3. Check quota before issuing new credentials
	if err := RunQuotaCheckDuringCredentialProcess(cfg); err != nil {
		return err
	}

	// 4. Exchange for AWS credentials
	creds, err := GetAWSCredentials(profile, tokens.IDToken, tokens.Claims)
	if err != nil {
		logging.Error("AWS credential exchange failed", "error", err)
		return fmt.Errorf("AWS credential exchange failed: %w", err)
	}
	logging.Debug("AWS credentials obtained", "expires", creds.Expiration)

	// 5. Cache credentials
	if err := SaveCredentials(profile, creds); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: could not cache credentials: %v\n", err)
		logging.Warn("credential cache failed", "error", err)
	}

	// 6. Save monitoring token
	if err := SaveMonitoringToken(profile, tokens.IDToken, tokens.Claims); err != nil {
		// Non-fatal
		fmt.Fprintf(os.Stderr, "Warning: could not save monitoring token: %v\n", err)
		logging.Warn("monitoring token save failed", "error", err)
	}

	return OutputCredentialProcess(*creds)
}

// OutputCredentialProcess writes credentials as JSON to stdout.
func OutputCredentialProcess(creds AWSCredentials) error {
	return json.NewEncoder(os.Stdout).Encode(creds)
}

// GetAWSCredentials exchanges an OIDC token for AWS credentials
// using either Cognito Identity Pool or Direct STS federation.
func GetAWSCredentials(cfg *config.ProfileConfig, idToken string, claims map[string]interface{}) (*AWSCredentials, error) {
	if cfg.FederationType == "direct" {
		return getCredentialsDirect(cfg, idToken, claims)
	}
	return getCredentialsCognito(cfg, idToken, claims)
}

// getCredentialsDirect uses STS AssumeRoleWithWebIdentity for 12-hour sessions.
func getCredentialsDirect(cfg *config.ProfileConfig, idToken string, claims map[string]interface{}) (*AWSCredentials, error) {
	if cfg.FederatedRoleARN == "" {
		return nil, fmt.Errorf("federated_role_arn is required for direct STS federation")
	}

	ctx := context.Background()

	// Create STS client without credentials to avoid recursive calls
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.AWSRegion),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider("", "", "")),
	)
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}
	stsClient := sts.NewFromConfig(awsCfg)

	// Generate session name
	sessionName := generateSessionName(claims)

	duration := int32(cfg.MaxSessionDuration)
	if duration == 0 {
		duration = 43200 // 12 hours
	}

	result, err := stsClient.AssumeRoleWithWebIdentity(ctx, &sts.AssumeRoleWithWebIdentityInput{
		RoleArn:          aws.String(cfg.FederatedRoleARN),
		RoleSessionName:  aws.String(sessionName),
		WebIdentityToken: aws.String(idToken),
		DurationSeconds:  aws.Int32(duration),
	})
	if err != nil {
		return nil, fmt.Errorf("AssumeRoleWithWebIdentity: %w", err)
	}

	return &AWSCredentials{
		Version:        1,
		AccessKeyId:    aws.ToString(result.Credentials.AccessKeyId),
		SecretAccessKey: aws.ToString(result.Credentials.SecretAccessKey),
		SessionToken:   aws.ToString(result.Credentials.SessionToken),
		Expiration:     result.Credentials.Expiration.Format(time.RFC3339),
	}, nil
}

// getCredentialsCognito uses Cognito Identity Pool (GetId + GetCredentialsForIdentity).
func getCredentialsCognito(cfg *config.ProfileConfig, idToken string, claims map[string]interface{}) (*AWSCredentials, error) {
	if cfg.IdentityPoolID == "" {
		return nil, fmt.Errorf("identity_pool_id is required for Cognito federation")
	}

	ctx := context.Background()

	// Create Cognito Identity client without credentials (unsigned)
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.AWSRegion),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider("", "", "")),
	)
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}
	cognitoClient := cognitoidentity.NewFromConfig(awsCfg)

	// Determine login key
	loginKey := determineLoginKey(cfg, claims)

	logins := map[string]string{loginKey: idToken}

	// GetId
	idResult, err := cognitoClient.GetId(ctx, &cognitoidentity.GetIdInput{
		IdentityPoolId: aws.String(cfg.IdentityPoolID),
		Logins:         logins,
	})
	if err != nil {
		return nil, fmt.Errorf("Cognito GetId: %w", err)
	}

	// GetCredentialsForIdentity
	credsResult, err := cognitoClient.GetCredentialsForIdentity(ctx, &cognitoidentity.GetCredentialsForIdentityInput{
		IdentityId: idResult.IdentityId,
		Logins:     logins,
	})
	if err != nil {
		return nil, fmt.Errorf("Cognito GetCredentialsForIdentity: %w", err)
	}

	return &AWSCredentials{
		Version:        1,
		AccessKeyId:    aws.ToString(credsResult.Credentials.AccessKeyId),
		SecretAccessKey: aws.ToString(credsResult.Credentials.SecretKey),
		SessionToken:   aws.ToString(credsResult.Credentials.SessionToken),
		Expiration:     credsResult.Credentials.Expiration.Format(time.RFC3339),
	}, nil
}

// determineLoginKey builds the Cognito Identity login key from config/claims.
func determineLoginKey(cfg *config.ProfileConfig, claims map[string]interface{}) string {
	if cfg.ProviderType == "cognito" {
		// Use issuer from token if available
		if iss, ok := claims["iss"].(string); ok {
			return strings.TrimPrefix(iss, "https://")
		}
		// Fallback: construct from user pool ID
		if cfg.CognitoUserPoolID != "" {
			return fmt.Sprintf("cognito-idp.%s.amazonaws.com/%s", cfg.AWSRegion, cfg.CognitoUserPoolID)
		}
	}
	return cfg.ProviderDomain
}

// generateSessionName creates a valid AWS session name from token claims.
func generateSessionName(claims map[string]interface{}) string {
	re := regexp.MustCompile(`[^\w+=,.@-]`)
	if sub, ok := claims["sub"].(string); ok {
		sanitized := re.ReplaceAllString(sub, "-")
		if len(sanitized) > 32 {
			sanitized = sanitized[:32]
		}
		return "claude-code-" + sanitized
	}
	if email, ok := claims["email"].(string); ok {
		parts := strings.SplitN(email, "@", 2)
		sanitized := re.ReplaceAllString(parts[0], "-")
		if len(sanitized) > 32 {
			sanitized = sanitized[:32]
		}
		return "claude-code-" + sanitized
	}
	return "claude-code"
}
