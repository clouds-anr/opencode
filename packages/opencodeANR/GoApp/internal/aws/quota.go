package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/clouds-anr/GovClaudeClient/internal/audit"
	"github.com/clouds-anr/GovClaudeClient/internal/auth"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
)

// QuotaResult holds the result from a quota check API call.
type QuotaResult struct {
	Allowed bool                   `json:"allowed"`
	Reason  string                 `json:"reason,omitempty"`
	Message string                 `json:"message,omitempty"`
	Usage   map[string]interface{} `json:"usage,omitempty"`
	Policy  map[string]interface{} `json:"policy,omitempty"`
}

// CheckQuotaAPI checks user quota via the quota check API endpoint.
func CheckQuotaAPI(ctx context.Context, cfg *config.ProfileConfig, idToken string) (*QuotaResult, error) {
	endpoint := cfg.QuotaAPIEndpoint
	if endpoint == "" {
		return &QuotaResult{Allowed: true, Reason: "no_endpoint"}, nil
	}

	timeout := cfg.QuotaCheckTimeout
	if timeout == 0 {
		timeout = 5
	}

	client := &http.Client{Timeout: time.Duration(timeout) * time.Second}
	req, err := http.NewRequest("GET", endpoint+"/check", nil)
	if err != nil {
		return handleQuotaError(cfg, "request_error", err)
	}
	req.Header.Set("Authorization", "Bearer "+idToken)

	resp, err := client.Do(req)
	if err != nil {
		return handleQuotaError(cfg, "connection_error", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var result QuotaResult
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return handleQuotaError(cfg, "parse_error", err)
		}

		// Extract user ID from token for audit logging
		userID := "unknown"
		if claims, err := auth.DecodeJWTPayload(idToken); err == nil {
			if sub, ok := claims["sub"].(string); ok {
				userID = sub
			}
		}

		// Audit quota check
		_ = audit.LogQuotaEvent(ctx, cfg, userID, result.Allowed, result.Usage)

		return &result, nil
	}

	return handleQuotaError(cfg, "api_error", fmt.Errorf("HTTP %d", resp.StatusCode))
}

// CheckQuotaDynamo queries DynamoDB directly for quota information.
func CheckQuotaDynamo(ctx context.Context, profile, region, userEmail string) (*QuotaDisplay, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithSharedConfigProfile(profile),
		awsconfig.WithRegion(region),
	)
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}
	db := dynamodb.NewFromConfig(awsCfg)

	now := time.Now().UTC()
	monthKey := now.Format("2006-01")
	today := now.Format("2006-01-02")

	display := &QuotaDisplay{
		UserEmail:    userEmail,
		Region:       region,
		Month:        monthKey,
		MonthlyLimit: 10_000_000, // Default
		PolicySource: "default",
	}

	// 1. Get policy limits
	// Try user-specific policy first
	userPK := fmt.Sprintf("POLICY#user#%s", userEmail)
	policyResp, err := db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: strPtr("QuotaPolicies"),
		Key: map[string]types.AttributeValue{
			"pk": &types.AttributeValueMemberS{Value: userPK},
			"sk": &types.AttributeValueMemberS{Value: "CURRENT"},
		},
	})
	if err == nil && policyResp.Item != nil {
		if enabled, ok := policyResp.Item["enabled"]; ok {
			if bv, ok := enabled.(*types.AttributeValueMemberBOOL); ok && bv.Value {
				extractPolicyLimits(policyResp.Item, display)
				display.PolicySource = fmt.Sprintf("user:%s", userEmail)
			}
		} else {
			// No enabled field means enabled by default
			extractPolicyLimits(policyResp.Item, display)
			display.PolicySource = fmt.Sprintf("user:%s", userEmail)
		}
	}

	// If no user policy, try default
	if display.PolicySource == "default" {
		defaultResp, err := db.GetItem(ctx, &dynamodb.GetItemInput{
			TableName: strPtr("QuotaPolicies"),
			Key: map[string]types.AttributeValue{
				"pk": &types.AttributeValueMemberS{Value: "POLICY#default#default"},
				"sk": &types.AttributeValueMemberS{Value: "CURRENT"},
			},
		})
		if err == nil && defaultResp.Item != nil {
			extractPolicyLimits(defaultResp.Item, display)
		}
	}

	// 2. Get usage metrics
	usagePK := fmt.Sprintf("USER#%s", userEmail)
	usageSK := fmt.Sprintf("MONTH#%s", monthKey)
	usageResp, err := db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: strPtr("UserQuotaMetrics"),
		Key: map[string]types.AttributeValue{
			"pk": &types.AttributeValueMemberS{Value: usagePK},
			"sk": &types.AttributeValueMemberS{Value: usageSK},
		},
	})
	if err == nil && usageResp.Item != nil {
		if v, ok := usageResp.Item["total_tokens"].(*types.AttributeValueMemberN); ok {
			fmt.Sscanf(v.Value, "%d", &display.TokensUsed)
		}
		if v, ok := usageResp.Item["daily_tokens"].(*types.AttributeValueMemberN); ok {
			fmt.Sscanf(v.Value, "%d", &display.DailyTokens)
		}
		if v, ok := usageResp.Item["daily_date"].(*types.AttributeValueMemberS); ok {
			if v.Value != today {
				display.DailyTokens = 0
			}
		}
		if v, ok := usageResp.Item["last_updated"].(*types.AttributeValueMemberS); ok {
			display.LastUpdated = v.Value
		}
	}

	return display, nil
}

// QuotaDisplay holds formatted quota data for display.
type QuotaDisplay struct {
	UserEmail    string
	Region       string
	Month        string
	MonthlyLimit int
	DailyLimit   int
	TokensUsed   int
	DailyTokens  int
	LastUpdated  string
	PolicySource string
}

// PrintQuota prints quota status to stdout.
func PrintQuota(d *QuotaDisplay) {
	fmt.Println("Claude Code with Bedrock - Quota Status")
	fmt.Println(strings.Repeat("=", 50))
	fmt.Printf("\nUser: %s\n", d.UserEmail)
	fmt.Printf("Region: %s\n", d.Region)
	fmt.Println(strings.Repeat("-", 50))

	fmt.Printf("\nPolicy: %s\n", d.PolicySource)

	remaining := max(0, d.MonthlyLimit-d.TokensUsed)
	pct := 0.0
	if d.MonthlyLimit > 0 {
		pct = float64(d.TokensUsed) / float64(d.MonthlyLimit) * 100
	}

	fmt.Printf("\nMonthly Usage (%s):\n", d.Month)
	fmt.Printf("  Tokens used:      %s\n", formatNumber(d.TokensUsed))
	fmt.Printf("  Monthly limit:    %s\n", formatNumber(d.MonthlyLimit))
	fmt.Printf("  Remaining:        %s\n", formatNumber(remaining))
	fmt.Printf("  Usage:            %.1f%%\n", pct)

	if d.DailyLimit > 0 {
		dailyRemaining := max(0, d.DailyLimit-d.DailyTokens)
		dailyPct := float64(d.DailyTokens) / float64(d.DailyLimit) * 100
		today := time.Now().UTC().Format("2006-01-02")
		fmt.Printf("\nDaily Usage (%s):\n", today)
		fmt.Printf("  Tokens used:      %s\n", formatNumber(d.DailyTokens))
		fmt.Printf("  Daily limit:      %s\n", formatNumber(d.DailyLimit))
		fmt.Printf("  Remaining:        %s\n", formatNumber(dailyRemaining))
		fmt.Printf("  Usage:            %.1f%%\n", dailyPct)
	}

	if d.LastUpdated != "" {
		fmt.Printf("\n  Last updated:     %s\n", d.LastUpdated)
	}

	// Status
	dailyExceeded := d.DailyLimit > 0 && d.DailyTokens >= d.DailyLimit
	if pct >= 100 {
		fmt.Println("\n  [!!] MONTHLY QUOTA EXCEEDED")
	} else if dailyExceeded {
		fmt.Println("\n  [!!] DAILY QUOTA EXCEEDED")
	} else if pct >= 90 {
		fmt.Println("\n  [WARNING] Monthly limit approaching (>90%)")
	} else if pct >= 80 {
		fmt.Println("\n  [INFO] Monthly usage above 80%")
	} else {
		fmt.Println("\n  [OK] Within quota limits")
	}
}

// ShouldCheckQuota returns true if quota checking is configured.
func ShouldCheckQuota(cfg *config.ProfileConfig) bool {
	return cfg.QuotaAPIEndpoint != ""
}

// SaveQuotaCheckTimestamp records when the last quota check occurred.
func SaveQuotaCheckTimestamp(cfg *config.ProfileConfig) {
	sessionDir := config.SessionDir()
	_ = os.MkdirAll(sessionDir, 0700)

	data, _ := json.Marshal(map[string]string{
		"last_check": time.Now().UTC().Format(time.RFC3339),
	})

	file := filepath.Join(sessionDir, cfg.ProfileName+"-quota-check.json")
	_ = atomicWrite(file, data, 0600)
}

// --- helpers ---

func handleQuotaError(cfg *config.ProfileConfig, reason string, err error) (*QuotaResult, error) {
	failMode := cfg.QuotaFailMode
	if failMode == "" {
		failMode = "open"
	}

	if failMode == "closed" {
		return &QuotaResult{
			Allowed: false,
			Reason:  reason,
			Message: fmt.Sprintf("Quota check failed: %v", err),
		}, nil
	}
	return &QuotaResult{Allowed: true, Reason: reason}, nil
}

func extractPolicyLimits(item map[string]types.AttributeValue, d *QuotaDisplay) {
	if v, ok := item["monthly_token_limit"].(*types.AttributeValueMemberN); ok {
		fmt.Sscanf(v.Value, "%d", &d.MonthlyLimit)
	}
	if v, ok := item["daily_token_limit"].(*types.AttributeValueMemberN); ok {
		fmt.Sscanf(v.Value, "%d", &d.DailyLimit)
	}
}

func strPtr(s string) *string { return &s }

func formatNumber(n int) string {
	if n == 0 {
		return "0"
	}
	s := fmt.Sprintf("%d", n)
	// Add commas
	parts := []string{}
	for i := len(s); i > 0; i -= 3 {
		start := i - 3
		if start < 0 {
			start = 0
		}
		parts = append([]string{s[start:i]}, parts...)
	}
	return joinStrings(parts, ",")
}

func joinStrings(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}
