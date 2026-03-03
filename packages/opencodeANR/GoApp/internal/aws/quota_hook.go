package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/clouds-anr/GovClaudeClient/internal/auth"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// QuotaLevel represents the severity of a quota warning.
type QuotaLevel string

const (
	QuotaOK       QuotaLevel = "ok"
	QuotaWarn80   QuotaLevel = "warn80"
	QuotaWarn90   QuotaLevel = "warn90"
	QuotaExceeded QuotaLevel = "exceeded"
)

// QuotaHookResult is the JSON output of the quota hook.
type QuotaHookResult struct {
	Decision string `json:"decision"`       // "allow" or "block"
	Reason   string `json:"reason,omitempty"` // Shown to user when blocked
}

// RunQuotaHook executes the quota check for a Claude Code UserPromptSubmit hook.
// It checks usage via the API endpoint and emits:
//   - 80% usage: warning to stderr, allow prompt
//   - 90% usage: stronger warning to stderr, allow prompt
//   - 100% usage: error to stderr, block prompt (exit 2)
//
// Returns the exit code (0 = allow, 2 = block).
func RunQuotaHook(cfg *config.AppConfig) int {
	profile := &cfg.Profile

	if !ShouldCheckQuota(profile) {
		logging.Debug("quota hook: no endpoint configured, allowing")
		writeHookResult(QuotaHookResult{Decision: "allow"})
		return 0
	}

	token := GetMonitoringToken(profile)
	if token == "" {
		logging.Debug("quota hook: no monitoring token, allowing")
		writeHookResult(QuotaHookResult{Decision: "allow"})
		return 0
	}

	result, err := CheckQuotaAPI(context.Background(), profile, token)
	if err != nil {
		logging.Warn("quota hook: API error, fail-open", "error", err)
		writeHookResult(QuotaHookResult{Decision: "allow"})
		return 0
	}

	SaveQuotaCheckTimestamp(profile)

	// Determine usage percentages from the result
	monthlyPct := getUsageFloat(result.Usage, "monthly_percent")
	dailyPct := getUsageFloat(result.Usage, "daily_percent")

	// Use the higher of monthly/daily percentages
	effectivePct := monthlyPct
	which := "monthly"
	if dailyPct > effectivePct {
		effectivePct = dailyPct
		which = "daily"
	}

	level := classifyUsage(effectivePct, !result.Allowed)

	logging.Debug("quota hook: checked",
		"monthly_pct", monthlyPct,
		"daily_pct", dailyPct,
		"level", string(level),
		"allowed", result.Allowed,
	)

	switch level {
	case QuotaExceeded:
		msg := result.Message
		if msg == "" {
			msg = "Quota exceeded"
		}
		// Detailed warning to stderr (visible in terminal)
		emitQuotaWarning(result, which, effectivePct, level)
		// Structured block response to stdout (exit 0, but decision=block)
		writeHookResult(QuotaHookResult{
			Decision: "block",
			Reason:   fmt.Sprintf("⛔ %s quota exceeded (%.0f%%). Contact your administrator.", which, effectivePct),
		})
		saveQuotaWarningLevel(profile, level)
		return 0 // Exit 0 (success) with decision=block in JSON

	case QuotaWarn90:
		emitQuotaWarning(result, which, effectivePct, level)
		writeHookResult(QuotaHookResult{Decision: "allow"})
		saveQuotaWarningLevel(profile, level)
		return 0

	case QuotaWarn80:
		// Only emit 80% warning if we haven't shown it recently (avoid spam)
		if !wasWarningSuppressed(profile, QuotaWarn80, 5*time.Minute) {
			emitQuotaWarning(result, which, effectivePct, level)
			saveQuotaWarningLevel(profile, level)
		}
		writeHookResult(QuotaHookResult{Decision: "allow"})
		return 0

	default:
		writeHookResult(QuotaHookResult{Decision: "allow"})
		return 0
	}
}

// classifyUsage maps a percentage + allowed flag to a QuotaLevel.
func classifyUsage(pct float64, blocked bool) QuotaLevel {
	if blocked || pct >= 100 {
		return QuotaExceeded
	}
	if pct >= 90 {
		return QuotaWarn90
	}
	if pct >= 80 {
		return QuotaWarn80
	}
	return QuotaOK
}

// emitQuotaWarning writes a formatted warning block to stderr.
func emitQuotaWarning(result *QuotaResult, which string, pct float64, level QuotaLevel) {
	bar := usageBar(pct)

	switch level {
	case QuotaExceeded:
		fmt.Fprintln(os.Stderr)
		fmt.Fprintln(os.Stderr, "╔══════════════════════════════════════════════════╗")
		fmt.Fprintf(os.Stderr, "║  ⛔ %s QUOTA EXCEEDED                         ║\n", capitalize(which))
		fmt.Fprintln(os.Stderr, "╠══════════════════════════════════════════════════╣")
		fmt.Fprintf(os.Stderr, "║  Usage: %s %5.1f%%  ║\n", bar, pct)
		printUsageDetails(result.Usage)
		fmt.Fprintln(os.Stderr, "║                                                  ║")
		fmt.Fprintln(os.Stderr, "║  Prompts are blocked until quota resets.          ║")
		fmt.Fprintln(os.Stderr, "║  Contact your administrator for assistance.       ║")
		fmt.Fprintln(os.Stderr, "╚══════════════════════════════════════════════════╝")
		fmt.Fprintln(os.Stderr)

	case QuotaWarn90:
		fmt.Fprintln(os.Stderr)
		fmt.Fprintln(os.Stderr, "┌──────────────────────────────────────────────────┐")
		fmt.Fprintf(os.Stderr, "│  ⚠️  %s quota at %.0f%% — approaching limit      │\n", capitalize(which), pct)
		fmt.Fprintf(os.Stderr, "│  %s %5.1f%%  │\n", bar, pct)
		printUsageDetails(result.Usage)
		fmt.Fprintln(os.Stderr, "│  Consider reducing usage to avoid being blocked.  │")
		fmt.Fprintln(os.Stderr, "└──────────────────────────────────────────────────┘")
		fmt.Fprintln(os.Stderr)

	case QuotaWarn80:
		fmt.Fprintf(os.Stderr, "⚠️  %s quota at %.0f%% [%s]\n", capitalize(which), pct, bar)
	}
}

// usageBar returns a simple ASCII progress bar (30 chars wide).
func usageBar(pct float64) string {
	const width = 30
	filled := int(pct / 100 * float64(width))
	if filled > width {
		filled = width
	}
	if filled < 0 {
		filled = 0
	}
	bar := make([]byte, width)
	for i := 0; i < width; i++ {
		if i < filled {
			bar[i] = '#'
		} else {
			bar[i] = '-'
		}
	}
	return "[" + string(bar) + "]"
}

// printUsageDetails writes monthly/daily token lines if present.
func printUsageDetails(usage map[string]interface{}) {
	monthlyTokens := getUsageFloat(usage, "monthly_tokens")
	monthlyLimit := getUsageFloat(usage, "monthly_limit")
	dailyTokens := getUsageFloat(usage, "daily_tokens")
	dailyLimit := getUsageFloat(usage, "daily_limit")

	if monthlyLimit > 0 {
		fmt.Fprintf(os.Stderr, "║  Monthly: %s / %s tokens                ║\n",
			formatTokens(int64(monthlyTokens)), formatTokens(int64(monthlyLimit)))
	}
	if dailyLimit > 0 {
		fmt.Fprintf(os.Stderr, "║  Daily:   %s / %s tokens                ║\n",
			formatTokens(int64(dailyTokens)), formatTokens(int64(dailyLimit)))
	}
}

// formatTokens returns a compact human-readable token count.
func formatTokens(n int64) string {
	switch {
	case n >= 1_000_000_000:
		return fmt.Sprintf("%.1fB", float64(n)/1e9)
	case n >= 1_000_000:
		return fmt.Sprintf("%.1fM", float64(n)/1e6)
	case n >= 1_000:
		return fmt.Sprintf("%.1fK", float64(n)/1e3)
	default:
		return fmt.Sprintf("%d", n)
	}
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return fmt.Sprintf("%c%s", s[0]-32, s[1:])
}

// --- quota warning dedup ---

type quotaWarningState struct {
	Level string `json:"level"`
	Time  string `json:"time"`
}

func saveQuotaWarningLevel(cfg *config.ProfileConfig, level QuotaLevel) {
	dir := config.SessionDir()
	_ = os.MkdirAll(dir, 0700)

	data, _ := json.Marshal(quotaWarningState{
		Level: string(level),
		Time:  time.Now().UTC().Format(time.RFC3339),
	})
	path := filepath.Join(dir, cfg.ProfileName+"-quota-warning.json")
	_ = atomicWrite(path, data, 0600)
}

func wasWarningSuppressed(cfg *config.ProfileConfig, level QuotaLevel, cooldown time.Duration) bool {
	path := filepath.Join(config.SessionDir(), cfg.ProfileName+"-quota-warning.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	var state quotaWarningState
	if err := json.Unmarshal(data, &state); err != nil {
		return false
	}
	if state.Level != string(level) {
		return false
	}
	t, err := time.Parse(time.RFC3339, state.Time)
	if err != nil {
		return false
	}
	return time.Since(t) < cooldown
}

// getUsageFloat extracts a float64 from the usage map.
func getUsageFloat(usage map[string]interface{}, key string) float64 {
	if usage == nil {
		return 0
	}
	switch v := usage[key].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	default:
		return 0
	}
}

func writeHookResult(r QuotaHookResult) {
	_ = json.NewEncoder(os.Stdout).Encode(r)
}

// RunQuotaCheckDuringCredentialProcess checks quota status during the
// credential-process flow. If quota is exceeded (and fail mode is "closed"),
// it returns an error to prevent credential issuance.
func RunQuotaCheckDuringCredentialProcess(cfg *config.AppConfig) error {
	profile := &cfg.Profile
	if !ShouldCheckQuota(profile) {
		return nil
	}

	token := GetMonitoringToken(profile)
	if token == "" {
		logging.Debug("cred-process quota: no token, skipping check")
		return nil
	}

	// Also try to get email for logging
	claims, _ := auth.DecodeJWTPayload(token)
	email := auth.ExtractEmail(claims)

	result, err := CheckQuotaAPI(context.Background(), profile, token)
	if err != nil {
		logging.Warn("cred-process quota: API error",
			"error", err, "email", email)
		return nil // fail-open unless configured otherwise
	}

	SaveQuotaCheckTimestamp(profile)

	if !result.Allowed {
		msg := result.Message
		if msg == "" {
			msg = "quota exceeded"
		}
		logging.Warn("cred-process quota: access blocked",
			"email", email, "reason", result.Reason, "message", msg)
		fmt.Fprintf(os.Stderr, "⛔ Quota exceeded: %s\n", msg)
		return fmt.Errorf("quota exceeded: %s", msg)
	}

	// Emit warnings to stderr even in credential-process mode
	monthlyPct := getUsageFloat(result.Usage, "monthly_percent")
	dailyPct := getUsageFloat(result.Usage, "daily_percent")
	effectivePct := monthlyPct
	which := "monthly"
	if dailyPct > effectivePct {
		effectivePct = dailyPct
		which = "daily"
	}

	level := classifyUsage(effectivePct, false)
	if level == QuotaWarn90 || level == QuotaExceeded {
		fmt.Fprintf(os.Stderr, "⚠️  %s quota at %.0f%%\n", capitalize(which), effectivePct)
	}

	return nil
}
