package otelhelper

import (
	"fmt"
	"os"
	"time"

	"github.com/clouds-anr/GovClaudeClient/internal/auth"
	"github.com/clouds-anr/GovClaudeClient/internal/aws"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// PromptTelemetry captures per-prompt telemetry data sent with OTEL headers.
type PromptTelemetry struct {
	Timestamp    string            `json:"timestamp"`
	UserEmail    string            `json:"user_email"`
	UserID       string            `json:"user_id"`
	Organization string            `json:"organization"`
	Department   string            `json:"department"`
	Team         string            `json:"team"`
	CostCenter   string            `json:"cost_center"`
	Headers      map[string]string `json:"headers"`
}

// RunOTELStatsHook runs as a Claude Code hook that sends user-attribution
// telemetry with each prompt. This is installed alongside the quota hook
// so that every prompt is tracked for usage analytics.
//
// It outputs the OTEL headers JSON to stdout (which Claude Code uses as
// additional context), and logs the event for the OTEL collector.
func RunOTELStatsHook(cfg *config.AppConfig) error {
	profile := &cfg.Profile

	// Only run if OTEL is configured
	if cfg.ClaudeEnv.OTELExporterEndpoint == "" {
		logging.Debug("otel stats hook: no endpoint configured, skipping")
		return writeJSON(map[string]string{})
	}

	token := os.Getenv("CLAUDE_CODE_MONITORING_TOKEN")
	if token == "" {
		token = aws.GetMonitoringToken(profile)
	}
	if token == "" {
		logging.Debug("otel stats hook: no monitoring token available")
		return writeJSON(map[string]string{})
	}

	claims, err := auth.DecodeJWTPayload(token)
	if err != nil {
		logging.Warn("otel stats hook: JWT decode failed", "error", err)
		return writeJSON(map[string]string{})
	}

	info := extractUserInfo(claims)
	headers := formatAsHeaders(info)

	// Build telemetry record
	telemetry := PromptTelemetry{
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		UserEmail:    info.Email,
		UserID:       info.UserID,
		Organization: info.OrganizationID,
		Department:   info.Department,
		Team:         info.Team,
		CostCenter:   info.CostCenter,
		Headers:      headers,
	}

	logging.Debug("otel stats hook: sending telemetry",
		"user", info.Email,
		"org", info.OrganizationID,
		"department", info.Department,
	)

	// Log the telemetry event (picked up by OTEL collector if configured)
	logging.Info("prompt_telemetry",
		"user_email", telemetry.UserEmail,
		"user_id", telemetry.UserID,
		"organization", telemetry.Organization,
		"department", telemetry.Department,
		"team", telemetry.Team,
		"cost_center", telemetry.CostCenter,
		"timestamp", telemetry.Timestamp,
	)

	// Output headers for Claude Code to use
	return writeJSON(headers)
}

// EnsureOTELHook ensures the OTEL stats hook is installed in
// ~/.claude/settings.json alongside the quota hook.
func EnsureOTELHook(cfg *config.AppConfig, binaryPath string) map[string]interface{} {
	if cfg.ClaudeEnv.OTELExporterEndpoint == "" {
		return nil
	}

	quotedBin := quoteBinPath(binaryPath)
	profile := cfg.Profile.ProfileName

	hookCmd := fmt.Sprintf("%s --otel-stats-hook --profile %s", quotedBin, profile)
	return ensureHookEntry("PreToolUse", hookCmd)
}

// ensureHookEntry adds a hook command to a hook type if not already present.
func ensureHookEntry(hookType, hookCmd string) map[string]interface{} {
	hooks := map[string]interface{}{
		hookType: []interface{}{
			map[string]interface{}{
				"hooks": []interface{}{
					map[string]interface{}{
						"type":    "command",
						"command": hookCmd,
						"timeout": 10,
					},
				},
			},
		},
	}
	return hooks
}

func quoteBinPath(p string) string {
	for _, c := range p {
		if c == ' ' {
			return `"` + p + `"`
		}
	}
	return p
}
