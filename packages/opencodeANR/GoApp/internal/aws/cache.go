package aws

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/clouds-anr/GovClaudeClient/internal/config"
	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// GetCachedCredentials retrieves cached credentials from ~/.aws/credentials.
func GetCachedCredentials(cfg *config.ProfileConfig) (*AWSCredentials, error) {
	creds, err := readFromCredentialsFile(cfg.ProfileName)
	if err != nil {
		return nil, err
	}
	if creds == nil {
		return nil, fmt.Errorf("no cached credentials")
	}

	// Check for cleared/expired dummy credentials
	if creds.AccessKeyId == "EXPIRED" {
		return nil, fmt.Errorf("credentials cleared")
	}

	// Check expiration (30-second buffer)
	if creds.Expiration != "" {
		exp, err := time.Parse(time.RFC3339, creds.Expiration)
		if err != nil {
			// Try ISO format with Z suffix
			creds.Expiration = strings.Replace(creds.Expiration, "Z", "+00:00", 1)
			exp, err = time.Parse(time.RFC3339, creds.Expiration)
			if err != nil {
				return nil, fmt.Errorf("parse expiration: %w", err)
			}
		}
		if time.Until(exp) < 30*time.Second {
			return nil, fmt.Errorf("credentials expired")
		}
	}

	return creds, nil
}

// SaveCredentials saves credentials to ~/.aws/credentials using atomic write.
func SaveCredentials(cfg *config.ProfileConfig, creds *AWSCredentials) error {
	return saveToCredentialsFile(creds, cfg.ProfileName)
}

// ClearCachedCredentials replaces credentials with expired dummies.
func ClearCachedCredentials(cfg *config.ProfileConfig) []string {
	var cleared []string

	// Clear credentials file
	expired := &AWSCredentials{
		Version:        1,
		AccessKeyId:    "EXPIRED",
		SecretAccessKey: "EXPIRED",
		SessionToken:   "EXPIRED",
		Expiration:     "2000-01-01T00:00:00Z",
	}
	if err := saveToCredentialsFile(expired, cfg.ProfileName); err == nil {
		cleared = append(cleared, "credentials file")
	}

	// Clear monitoring token
	sessionDir := config.SessionDir()
	tokenFile := filepath.Join(sessionDir, cfg.ProfileName+"-monitoring.json")
	if err := os.Remove(tokenFile); err == nil {
		cleared = append(cleared, "monitoring token file")
	}

	// Remove quota check timestamp
	quotaFile := filepath.Join(sessionDir, cfg.ProfileName+"-quota-check.json")
	_ = os.Remove(quotaFile)

	// Remove quota warning
	warningFile := filepath.Join(sessionDir, cfg.ProfileName+"-quota-warning.json")
	_ = os.Remove(warningFile)

	return cleared
}

// CheckCredentialsExpired returns true if credentials are expired or missing.
func CheckCredentialsExpired(cfg *config.ProfileConfig) bool {
	creds, err := readFromCredentialsFile(cfg.ProfileName)
	if err != nil || creds == nil {
		return true
	}
	if creds.AccessKeyId == "EXPIRED" {
		return true
	}
	if creds.Expiration == "" {
		return true
	}
	exp, err := time.Parse(time.RFC3339, creds.Expiration)
	if err != nil {
		return true
	}
	return time.Until(exp) <= 30*time.Second
}

// SaveMonitoringToken saves the ID token for OTEL monitoring.
func SaveMonitoringToken(cfg *config.ProfileConfig, idToken string, claims map[string]interface{}) error {
	sessionDir := config.SessionDir()
	if err := os.MkdirAll(sessionDir, 0700); err != nil {
		return err
	}

	email, _ := claims["email"].(string)
	exp, _ := claims["exp"].(float64)

	data := map[string]interface{}{
		"token":   idToken,
		"expires": int64(exp),
		"email":   email,
		"profile": cfg.ProfileName,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	tokenFile := filepath.Join(sessionDir, cfg.ProfileName+"-monitoring.json")
	return atomicWrite(tokenFile, jsonData, 0600)
}

// GetMonitoringToken retrieves a valid monitoring token.
func GetMonitoringToken(cfg *config.ProfileConfig) string {
	// Check environment first
	if token := os.Getenv("CLAUDE_CODE_MONITORING_TOKEN"); token != "" {
		logging.Debug("GetMonitoringToken: found in environment")
		return token
	}

	sessionDir := config.SessionDir()
	tokenFile := filepath.Join(sessionDir, cfg.ProfileName+"-monitoring.json")

	logging.Debug("GetMonitoringToken: checking cache", 
		"profile", cfg.ProfileName,
		"token_file", tokenFile,
	)

	data, err := os.ReadFile(tokenFile)
	if err != nil {
		logging.Debug("GetMonitoringToken: cache read failed", "error", err)
		return ""
	}

	var tokenData struct {
		Token   string `json:"token"`
		Expires int64  `json:"expires"`
	}
	if err := json.Unmarshal(data, &tokenData); err != nil {
		logging.Debug("GetMonitoringToken: cache JSON unmarshal failed", "error", err)
		return ""
	}

	// Check expiration (10 minute buffer)
	now := time.Now().UTC().Unix()
	timeUntilExpiry := tokenData.Expires - now
	if timeUntilExpiry < 600 {
		logging.Debug("GetMonitoringToken: token expired or expiring soon", 
			"expires_in_seconds", timeUntilExpiry,
		)
		return ""
	}

	logging.Debug("GetMonitoringToken: valid token found", 
		"expires_in_seconds", timeUntilExpiry,
		"token_length", len(tokenData.Token),
	)
	return tokenData.Token
}

// GetMonitoringTokenRelaxed retrieves the monitoring token even if close to
// or past expiry. This is used by the OTEL headers helper where the token
// is only needed for user attribution claims (email, org, etc.) — those
// claims don't change, so a slightly stale token is perfectly fine.
func GetMonitoringTokenRelaxed(cfg *config.ProfileConfig) string {
	if token := os.Getenv("CLAUDE_CODE_MONITORING_TOKEN"); token != "" {
		logging.Debug("GetMonitoringTokenRelaxed: found in environment")
		return token
	}

	sessionDir := config.SessionDir()
	tokenFile := filepath.Join(sessionDir, cfg.ProfileName+"-monitoring.json")

	logging.Debug("GetMonitoringTokenRelaxed: checking cache",
		"profile", cfg.ProfileName,
		"token_file", tokenFile,
	)

	data, err := os.ReadFile(tokenFile)
	if err != nil {
		logging.Debug("GetMonitoringTokenRelaxed: cache read failed", "error", err)
		return ""
	}

	var tokenData struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(data, &tokenData); err != nil {
		logging.Debug("GetMonitoringTokenRelaxed: cache JSON unmarshal failed", "error", err)
		return ""
	}

	logging.Debug("GetMonitoringTokenRelaxed: token found (ignoring expiry)",
		"token_length", len(tokenData.Token),
	)
	return tokenData.Token
}

// --- file I/O helpers ---

func readFromCredentialsFile(profile string) (*AWSCredentials, error) {
	credPath := filepath.Join(config.AWSDir(), "credentials")
	data, err := os.ReadFile(credPath)
	if err != nil {
		return nil, err
	}

	// Simple INI parser for credentials file
	section := ""
	values := make(map[string]string)
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section = line[1 : len(line)-1]
			continue
		}
		if section != profile {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			values[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}

	accessKey := values["aws_access_key_id"]
	secretKey := values["aws_secret_access_key"]
	sessionToken := values["aws_session_token"]

	if accessKey == "" || secretKey == "" || sessionToken == "" {
		return nil, nil
	}

	return &AWSCredentials{
		Version:        1,
		AccessKeyId:    accessKey,
		SecretAccessKey: secretKey,
		SessionToken:   sessionToken,
		Expiration:     values["x-expiration"],
	}, nil
}

func saveToCredentialsFile(creds *AWSCredentials, profile string) error {
	credPath := filepath.Join(config.AWSDir(), "credentials")

	if err := os.MkdirAll(config.AWSDir(), 0700); err != nil {
		return err
	}

	// Read existing file
	existing, _ := os.ReadFile(credPath)

	// Parse and update
	lines := strings.Split(string(existing), "\n")
	var result []string
	inProfile := false
	profileFound := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			if inProfile {
				// End of our profile section - we already wrote new values
				inProfile = false
			}
			sectionName := trimmed[1 : len(trimmed)-1]
			if sectionName == profile {
				inProfile = true
				profileFound = true
				result = append(result, line)
				result = append(result, "aws_access_key_id = "+creds.AccessKeyId)
				result = append(result, "aws_secret_access_key = "+creds.SecretAccessKey)
				result = append(result, "aws_session_token = "+creds.SessionToken)
				if creds.Expiration != "" {
					result = append(result, "x-expiration = "+creds.Expiration)
				}
				continue
			}
		}
		if inProfile {
			// Skip old profile keys
			if strings.Contains(trimmed, "=") {
				continue
			}
		}
		result = append(result, line)
	}

	if !profileFound {
		result = append(result, "")
		result = append(result, "["+profile+"]")
		result = append(result, "aws_access_key_id = "+creds.AccessKeyId)
		result = append(result, "aws_secret_access_key = "+creds.SecretAccessKey)
		result = append(result, "aws_session_token = "+creds.SessionToken)
		if creds.Expiration != "" {
			result = append(result, "x-expiration = "+creds.Expiration)
		}
	}

	content := strings.Join(result, "\n")
	if !strings.HasSuffix(content, "\n") {
		content += "\n"
	}

	return atomicWrite(credPath, []byte(content), 0600)
}

func atomicWrite(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer func() {
		_ = tmp.Close()
		_ = os.Remove(tmpName)
	}()

	if _, err := tmp.Write(data); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpName, perm); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}
