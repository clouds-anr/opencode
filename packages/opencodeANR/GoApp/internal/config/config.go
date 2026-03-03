package config

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// ProviderConfig holds OIDC provider endpoint configuration.
type ProviderConfig struct {
	Name              string
	AuthorizeEndpoint string
	TokenEndpoint     string
	Scopes            string
	ResponseType      string
}

// ProviderConfigs maps provider type names to their endpoint config.
var ProviderConfigs = map[string]ProviderConfig{
	"okta": {
		Name:              "Okta",
		AuthorizeEndpoint: "/oauth2/v1/authorize",
		TokenEndpoint:     "/oauth2/v1/token",
		Scopes:            "openid profile email",
		ResponseType:      "code",
	},
	"auth0": {
		Name:              "Auth0",
		AuthorizeEndpoint: "/authorize",
		TokenEndpoint:     "/oauth/token",
		Scopes:            "openid profile email",
		ResponseType:      "code",
	},
	"azure": {
		Name:              "Azure AD",
		AuthorizeEndpoint: "/oauth2/v2.0/authorize",
		TokenEndpoint:     "/oauth2/v2.0/token",
		Scopes:            "openid profile email",
		ResponseType:      "code",
	},
	"cognito": {
		Name:              "AWS Cognito User Pool",
		AuthorizeEndpoint: "/login",
		TokenEndpoint:     "/oauth2/token",
		Scopes:            "openid email",
		ResponseType:      "code",
	},
}

// ProfileConfig holds per-profile settings.
type ProfileConfig struct {
	ProfileName        string `json:"profile_name"`
	ProviderDomain     string `json:"provider_domain"`
	ClientID           string `json:"client_id"`
	AWSRegion          string `json:"aws_region"`
	ProviderType       string `json:"provider_type"`
	CredentialStorage  string `json:"credential_storage"`
	CrossRegionProfile string `json:"cross_region_profile"`
	IdentityPoolID     string `json:"identity_pool_id"`
	FederationType     string `json:"federation_type"`
	CognitoUserPoolID  string `json:"cognito_user_pool_id"`
	SelectedModel      string `json:"selected_model"`
	FederatedRoleARN   string `json:"federated_role_arn,omitempty"`
	MaxSessionDuration int    `json:"max_session_duration,omitempty"`
	QuotaAPIEndpoint   string `json:"quota_api_endpoint,omitempty"`
	QuotaCheckInterval int    `json:"quota_check_interval,omitempty"`
	QuotaFailMode      string `json:"quota_fail_mode,omitempty"`
	QuotaCheckTimeout  int    `json:"quota_check_timeout,omitempty"`
	AuditTableName     string `json:"audit_table_name,omitempty"`

	// Installer download URLs (optional overrides for air-gapped / internal mirrors)
	InstallerURLClaude string `json:"installer_url_claude,omitempty"`
	InstallerURLGit    string `json:"installer_url_git,omitempty"`
}

// ClaudeEnvVars holds environment variables for ~/.claude/settings.json.
type ClaudeEnvVars struct {
	AWSRegion                 string `json:"AWS_REGION"`
	ClaudeCodeUseBedrock      string `json:"CLAUDE_CODE_USE_BEDROCK"`
	AWSProfile                string `json:"AWS_PROFILE"`
	AnthropicModel            string `json:"ANTHROPIC_MODEL"`
	AnthropicSmallFastModel   string `json:"ANTHROPIC_SMALL_FAST_MODEL"`
	ClaudeCodeEnableTelemetry string `json:"CLAUDE_CODE_ENABLE_TELEMETRY"`
	OTELMetricsExporter       string `json:"OTEL_METRICS_EXPORTER"`
	OTELExporterProtocol      string `json:"OTEL_EXPORTER_OTLP_PROTOCOL"`
	OTELExporterEndpoint      string `json:"OTEL_EXPORTER_OTLP_ENDPOINT,omitempty"`
}

// AppConfig is the top-level configuration for the launcher.
type AppConfig struct {
	Profile   ProfileConfig
	ClaudeEnv ClaudeEnvVars
}

// DetectProviderType determines the OIDC provider from the domain hostname.
func DetectProviderType(domain string) (string, error) {
	if domain == "" {
		return "", fmt.Errorf("empty provider domain")
	}
	host := strings.ToLower(domain)
	// Strip scheme if present
	if idx := strings.Index(host, "://"); idx >= 0 {
		host = host[idx+3:]
	}
	// Strip path/port
	if idx := strings.IndexAny(host, ":/"); idx >= 0 {
		host = host[:idx]
	}
	switch {
	case strings.HasSuffix(host, ".okta.com") || host == "okta.com":
		return "okta", nil
	case strings.HasSuffix(host, ".auth0.com") || host == "auth0.com":
		return "auth0", nil
	case strings.HasSuffix(host, ".microsoftonline.com") || host == "microsoftonline.com",
		strings.HasSuffix(host, ".windows.net") || host == "windows.net":
		return "azure", nil
	case strings.HasSuffix(host, ".amazoncognito.com") || host == "amazoncognito.com":
		return "cognito", nil
	default:
		return "", fmt.Errorf("unable to auto-detect provider for domain %q; known: okta, auth0, azure, cognito", domain)
	}
}

// DetectFederationType determines federation mode from config fields.
func DetectFederationType(cfg *ProfileConfig) {
	if cfg.FederationType != "" {
		return
	}
	if cfg.FederatedRoleARN != "" {
		cfg.FederationType = "direct"
	} else {
		cfg.FederationType = "cognito"
	}
}

// LoadEnvFile reads a KEY=VALUE env file and returns a map.
func LoadEnvFile(path string) (map[string]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open env file: %w", err)
	}
	defer f.Close()

	env := make(map[string]string)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		env[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
	}
	return env, scanner.Err()
}

// LoadFromEnvFile builds an AppConfig from an env.bedrock file.
func LoadFromEnvFile(path string) (*AppConfig, error) {
	env, err := LoadEnvFile(path)
	if err != nil {
		return nil, err
	}

	providerType := or2(env["PROVIDER_TYPE"], "auto")
	if providerType == "auto" {
		detected, err := DetectProviderType(env["PROVIDER_DOMAIN"])
		if err != nil {
			return nil, fmt.Errorf("provider detection: %w", err)
		}
		providerType = detected
	}

	fedType := or2(env["FEDERATION_TYPE"], "cognito")
	maxSession := 28800
	if fedType == "direct" {
		maxSession = 43200
	}

	cfg := &AppConfig{
		Profile: ProfileConfig{
			ProfileName:        env["AWS_PROFILE"],
			ProviderDomain:     env["PROVIDER_DOMAIN"],
			ClientID:           env["CLIENT_ID"],
			AWSRegion:          or2(env["AWS_REGION_PROFILE"], env["AWS_REGION"], "us-east-1"),
			ProviderType:       providerType,
			CredentialStorage:  or2(env["CREDENTIAL_STORAGE"], "session"),
			CrossRegionProfile: env["CROSS_REGION_PROFILE"],
			IdentityPoolID:     env["IDENTITY_POOL_ID"],
			FederationType:     fedType,
			CognitoUserPoolID:  env["COGNITO_USER_POOL_ID"],
			SelectedModel:      env["ANTHROPIC_MODEL"],
			FederatedRoleARN:   env["FEDERATED_ROLE_ARN"],
			MaxSessionDuration: maxSession,
			QuotaAPIEndpoint:   env["QUOTA_API_ENDPOINT"],
			QuotaCheckInterval: 1,
			QuotaFailMode:      or2(env["QUOTA_FAIL_MODE"], "open"),
			QuotaCheckTimeout:  5,
			AuditTableName:     env["AUDIT_TABLE_NAME"],
			InstallerURLClaude: env["INSTALLER_URL_CLAUDE"],
			InstallerURLGit:    env["INSTALLER_URL_GIT"],
		},
		ClaudeEnv: ClaudeEnvVars{
			AWSRegion:                 or2(env["AWS_REGION"], "us-east-1"),
			ClaudeCodeUseBedrock:      or2(env["CLAUDE_CODE_USE_BEDROCK"], "1"),
			AWSProfile:                env["AWS_PROFILE"],
			AnthropicModel:            env["ANTHROPIC_MODEL"],
			AnthropicSmallFastModel:   or2(env["ANTHROPIC_SMALL_FAST_MODEL"], env["ANTHROPIC_MODEL"]),
			ClaudeCodeEnableTelemetry: or2(env["CLAUDE_CODE_ENABLE_TELEMETRY"], "1"),
			OTELMetricsExporter:       or2(env["OTEL_METRICS_EXPORTER"], "otlp"),
			OTELExporterProtocol:      or2(env["OTEL_EXPORTER_OTLP_PROTOCOL"], "http/protobuf"),
			OTELExporterEndpoint:      env["OTEL_EXPORTER_OTLP_ENDPOINT"],
		},
	}
	return cfg, nil
}

// FindEnvFile searches for an env.* file in standard locations.
// It checks $CCWB_ENV_FILE first, then looks next to the binary,
// then in the current directory, then in ~/claude-code-with-bedrock/.
func FindEnvFile() (string, error) {
	// Explicit env var takes priority
	if envPath := os.Getenv("CCWB_ENV_FILE"); envPath != "" {
		if _, err := os.Stat(envPath); err == nil {
			return envPath, nil
		}
		return "", fmt.Errorf("CCWB_ENV_FILE=%q not found", envPath)
	}

	exe, _ := os.Executable()
	exeDir := filepath.Dir(exe)

	searchDirs := []string{
		exeDir,
		".",
		filepath.Join(HomeDir(), "claude-code-with-bedrock"),
	}

	for _, dir := range searchDirs {
		matches, _ := filepath.Glob(filepath.Join(dir, "env.*"))
		for _, m := range matches {
			// Skip common non-config patterns like env.example
			base := filepath.Base(m)
			if base == "env.example" || strings.HasSuffix(base, ".bak") {
				continue
			}
			return m, nil
		}
	}

	return "", fmt.Errorf("no env.* file found in: %s", strings.Join(searchDirs, ", "))
}

// Load finds and parses the env file. If envFile is non-empty it is used
// directly; otherwise FindEnvFile() searches the standard locations.
func Load(envFile string) (*AppConfig, error) {
	path := envFile
	if path == "" {
		var err error
		path, err = FindEnvFile()
		if err != nil {
			return nil, err
		}
	}
	// Use logging instead of raw stderr — this keeps silent modes (credential-process,
	// get-otel-headers, hooks) clean. The path is captured in structured logs and in
	// the log file when --log-file is used.
	logging.Debug("using env file", "path", path)
	return LoadFromEnvFile(path)
}

// HomeDir returns the user's home directory.
func HomeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return os.Getenv("HOME")
	}
	return home
}

// InstallDir returns the standard install directory.
func InstallDir() string {
	return filepath.Join(HomeDir(), "claude-code-with-bedrock")
}

// ClaudeDir returns ~/.claude
func ClaudeDir() string {
	return filepath.Join(HomeDir(), ".claude")
}

// AWSDir returns ~/.aws
func AWSDir() string {
	return filepath.Join(HomeDir(), ".aws")
}

// SessionDir returns ~/.claude-code-session
func SessionDir() string {
	return filepath.Join(HomeDir(), ".claude-code-session")
}

// BinaryName returns the expected binary name for the current OS.
func BinaryName() string {
	if runtime.GOOS == "windows" {
		return "claude-bedrock.exe"
	}
	return "claude-bedrock"
}

// or2 returns the first non-empty string.
func or2(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// EnvToMap converts ClaudeEnvVars to a string map for settings.json.
func (e *ClaudeEnvVars) EnvToMap() map[string]string {
	m := make(map[string]string)
	if e.AWSRegion != "" {
		m["AWS_REGION"] = e.AWSRegion
	}
	if e.ClaudeCodeUseBedrock != "" {
		m["CLAUDE_CODE_USE_BEDROCK"] = e.ClaudeCodeUseBedrock
	}
	if e.AWSProfile != "" {
		m["AWS_PROFILE"] = e.AWSProfile
	}
	if e.AnthropicModel != "" {
		m["ANTHROPIC_MODEL"] = e.AnthropicModel
	}
	if e.AnthropicSmallFastModel != "" {
		m["ANTHROPIC_SMALL_FAST_MODEL"] = e.AnthropicSmallFastModel
	}
	if e.ClaudeCodeEnableTelemetry != "" {
		m["CLAUDE_CODE_ENABLE_TELEMETRY"] = e.ClaudeCodeEnableTelemetry
	}
	if e.OTELMetricsExporter != "" {
		m["OTEL_METRICS_EXPORTER"] = e.OTELMetricsExporter
	}
	if e.OTELExporterProtocol != "" {
		m["OTEL_EXPORTER_OTLP_PROTOCOL"] = e.OTELExporterProtocol
	}
	if e.OTELExporterEndpoint != "" {
		m["OTEL_EXPORTER_OTLP_ENDPOINT"] = e.OTELExporterEndpoint
	}
	return m
}

// LoadConfigJSON loads an old-format config.json file.
func LoadConfigJSON(path string) (map[string]json.RawMessage, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config.json: %w", err)
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse config.json: %w", err)
	}
	return raw, nil
}
