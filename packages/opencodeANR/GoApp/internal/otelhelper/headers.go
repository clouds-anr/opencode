package otelhelper

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/clouds-anr/GovClaudeClient/internal/auth"
	"github.com/clouds-anr/GovClaudeClient/internal/aws"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// UserInfo holds extracted user attributes from a JWT.
type UserInfo struct {
	Email          string `json:"email"`
	UserID         string `json:"user_id"`
	Username       string `json:"username"`
	OrganizationID string `json:"organization_id"`
	Department     string `json:"department"`
	Team           string `json:"team"`
	CostCenter     string `json:"cost_center"`
	Manager        string `json:"manager"`
	Location       string `json:"location"`
	Role           string `json:"role"`
}

// headerMapping maps UserInfo fields to HTTP header names.
var headerMapping = map[string]string{
	"email":           "x-user-email",
	"user_id":         "x-user-id",
	"username":        "x-user-name",
	"department":      "x-department",
	"team":            "x-team-id",
	"cost_center":     "x-cost-center",
	"organization_id": "x-organization",
	"location":        "x-location",
	"role":            "x-role",
	"manager":         "x-manager",
}

// RunOTELHeaders outputs OTEL user attribution headers as JSON to stdout.
// This is called non-interactively by Claude Code on each telemetry send.
// It MUST produce valid JSON on stdout and exit 0, or Claude Code will
// log an error and disable telemetry enrichment for the session.
//
// If the monitoring token is unavailable (auth hasn't completed yet) or
// cannot be decoded, we still output default headers and return nil so
// that Claude Code always gets a usable response.
//
// RunOTELHeaders can work with a full AppConfig OR with just a profile name.
// When called from otelHeadersHelper, config loading may fail (env file not
// found from Claude Code's cwd), so RunOTELHeadersByProfile provides a
// lightweight path that only needs the profile name to locate the monitoring
// token.
func RunOTELHeaders(cfg *config.AppConfig) error {
	return RunOTELHeadersByProfile(cfg.Profile.ProfileName)
}

// RunOTELHeadersByProfile outputs OTEL user attribution headers using only
// the profile name. It does NOT require an env file or full config — just
// the profile name to locate the cached monitoring token.
func RunOTELHeadersByProfile(profileName string) error {
	// This function MUST always output valid JSON to stdout and return nil.
	// If anything goes wrong, output empty headers {} rather than returning
	// an error, which would cause Claude Code to log
	// "otelHeadersHelper did not return a valid value" and disable
	// telemetry enrichment for the session.

	logging.Debug("RunOTELHeadersByProfile starting", 
		"profile_param", profileName,
		"session_dir", config.SessionDir(),
	)

	// If no profile specified, try to read from AWS config default
	originalProfile := profileName
	if profileName == "" {
		profileName = os.Getenv("AWS_PROFILE")
		logging.Debug("profile empty, checked AWS_PROFILE env", "value", profileName)
	}
	if profileName == "" {
		// Still empty - use a safe default
		// This will result in looking for "-monitoring.json" which won't exist,
		// but that's fine - we'll use default headers
		profileName = "default"
		logging.Debug("profile still empty, using default")
	}
	if originalProfile != profileName {
		logging.Debug("profile name resolved", "from", originalProfile, "to", profileName)
	}

	profile := &config.ProfileConfig{ProfileName: profileName}

	// 1. Try strict (non-expired) monitoring token.
	token := os.Getenv("CLAUDE_CODE_MONITORING_TOKEN")
	tokenSource := "none"
	if token != "" {
		tokenSource = "env_var"
		logging.Debug("monitoring token found in environment variable")
	}

	if token == "" {
		token = aws.GetMonitoringToken(profile)
		if token != "" {
			tokenSource = "strict_cache"
			logging.Debug("monitoring token found in cache (strict, non-expired)")
		}
	}

	// 2. If strict lookup failed, use relaxed (ignore expiry). The JWT
	//    claims we're extracting (email, org, etc.) don't change over the
	//    session lifetime, so a slightly stale token is perfectly fine for
	//    user attribution headers.
	if token == "" {
		token = aws.GetMonitoringTokenRelaxed(profile)
		if token != "" {
			tokenSource = "relaxed_cache"
			logging.Debug("using relaxed (possibly expired) monitoring token for OTEL headers")
		}
	}

	var info *UserInfo

	if token == "" {
		// No token at all — auth hasn't completed yet. Use defaults.
		logging.Debug("no monitoring token available; using default OTEL headers")
		info = extractUserInfo(nil)
	} else {
		// Decode JWT and extract user info
		logging.Debug("decoding JWT token", "source", tokenSource, "token_length", len(token))
		claims, err := auth.DecodeJWTPayload(token)
		if err != nil {
			// Token exists but can't be decoded — use defaults rather than failing.
			logging.Debug("could not decode monitoring token; using default OTEL headers", "error", err)
			info = extractUserInfo(nil)
		} else {
			logging.Debug("JWT decoded successfully", "claims_count", len(claims))
			info = extractUserInfo(claims)
		}
	}

	headers := formatAsHeaders(info)

	logging.Debug("generated OTEL headers",
		"user", info.Email,
		"org", info.OrganizationID,
		"header_count", len(headers),
		"headers", headers,
	)

	return writeJSON(headers)
}

// writeJSON marshals v to stdout as a single line of JSON and returns nil.
// On any error it writes "{}" so the caller always gets valid output.
// Note: We don't sync stdout because it can fail on Windows with "invalid handle"
// errors, and the OS will flush stdout when the process exits anyway.
func writeJSON(v interface{}) error {
	defer func() {
		if r := recover(); r != nil {
			// Panic during marshal or write - output minimal valid JSON
			_, _ = os.Stdout.WriteString("{}\n")
		}
	}()

	logging.Debug("writeJSON marshaling", "type", fmt.Sprintf("%T", v))
	data, err := json.Marshal(v)
	if err != nil {
		logging.Debug("JSON marshal failed", "error", err)
		data = []byte("{}")
	} else {
		logging.Debug("JSON marshaled successfully", "size", len(data))
	}

	_, err = os.Stdout.Write(data)
	if err != nil {
		logging.Debug("stdout write failed", "error", err)
	}
	_, _ = os.Stdout.Write([]byte("\n"))
	
	logging.Debug("writeJSON completed", "total_bytes", len(data)+1)
	return nil
}

func extractUserInfo(claims map[string]interface{}) *UserInfo {
	info := &UserInfo{
		Email:          stringClaim(claims, "email", "preferred_username", "mail"),
		Username:       stringClaim(claims, "cognito:username", "preferred_username"),
		Department:     stringClaim(claims, "department", "dept", "division"),
		Team:           stringClaim(claims, "team", "team_id", "group"),
		CostCenter:     stringClaim(claims, "cost_center", "costCenter", "cost_code"),
		Manager:        stringClaim(claims, "manager", "manager_email"),
		Location:       stringClaim(claims, "location", "office_location", "office"),
		Role:           stringClaim(claims, "role", "job_title", "title"),
		OrganizationID: "amazon-internal",
	}

	// Set defaults for empty fields
	if info.Email == "" {
		info.Email = "unknown@example.com"
	}
	if info.Username == "" {
		info.Username = strings.SplitN(info.Email, "@", 2)[0]
	}
	if info.Department == "" {
		info.Department = "unspecified"
	}
	if info.Team == "" {
		info.Team = "default-team"
	}
	if info.CostCenter == "" {
		info.CostCenter = "general"
	}
	if info.Manager == "" {
		info.Manager = "unassigned"
	}
	if info.Location == "" {
		info.Location = "remote"
	}
	if info.Role == "" {
		info.Role = "user"
	}

	// Hash user ID for privacy
	if sub, ok := claims["sub"].(string); ok && sub != "" {
		h := sha256.Sum256([]byte(sub))
		hex := fmt.Sprintf("%x", h[:16])
		info.UserID = fmt.Sprintf("%s-%s-%s-%s-%s",
			hex[:8], hex[8:12], hex[12:16], hex[16:20], hex[20:32])
	}
	if info.UserID == "" {
		info.UserID = "00000000-0000-0000-0000-000000000000"
	}

	// Detect organization from issuer
	if iss, ok := claims["iss"].(string); ok {
		urlStr := iss
		if !strings.HasPrefix(urlStr, "http") {
			urlStr = "https://" + urlStr
		}
		if parsed, err := url.Parse(urlStr); err == nil && parsed.Hostname() != "" {
			h := strings.ToLower(parsed.Hostname())
			switch {
			case strings.HasSuffix(h, ".okta.com"):
				info.OrganizationID = "okta"
			case strings.HasSuffix(h, ".auth0.com"):
				info.OrganizationID = "auth0"
			case strings.HasSuffix(h, ".microsoftonline.com"):
				info.OrganizationID = "azure"
			}
		}
	}

	return info
}

func formatAsHeaders(info *UserInfo) map[string]string {
	headers := make(map[string]string)
	fields := map[string]string{
		"email":           info.Email,
		"user_id":         info.UserID,
		"username":        info.Username,
		"department":      info.Department,
		"team":            info.Team,
		"cost_center":     info.CostCenter,
		"organization_id": info.OrganizationID,
		"location":        info.Location,
		"role":            info.Role,
		"manager":         info.Manager,
	}
	for field, value := range fields {
		if headerName, ok := headerMapping[field]; ok && value != "" {
			headers[headerName] = value
		}
	}
	return headers
}

func stringClaim(claims map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := claims[k].(string); ok && v != "" {
			return v
		}
	}
	return ""
}
