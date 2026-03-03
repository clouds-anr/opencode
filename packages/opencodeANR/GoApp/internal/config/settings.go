package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ClaudeSettings represents ~/.claude/settings.json.
type ClaudeSettings struct {
	Env               map[string]string      `json:"env,omitempty"`
	AWSAuthRefresh    string                 `json:"awsAuthRefresh,omitempty"`
	OTELHeadersHelper string                 `json:"otelHeadersHelper,omitempty"`
	Hooks             map[string]interface{} `json:"hooks,omitempty"`
}

// WriteClaudeSettings writes ~/.claude/settings.json with the launcher's config.
// It merges env vars, credential refresh command, OTEL header helper, and quota
// hooks into the existing file so that user-added keys are preserved.
func WriteClaudeSettings(cfg *AppConfig) error {
	claudeDir := ClaudeDir()
	if err := os.MkdirAll(claudeDir, 0755); err != nil {
		return fmt.Errorf("create claude dir: %w", err)
	}

	binaryPath, err := InstalledBinaryPath()
	if err != nil {
		return fmt.Errorf("determine binary path: %w", err)
	}
	quotedBin := quotePath(binaryPath)
	profile := cfg.Profile.ProfileName

	settingsPath := filepath.Join(claudeDir, "settings.json")

	// Load existing settings to preserve user keys (e.g. hooks, custom env)
	var raw map[string]interface{}
	if data, err := os.ReadFile(settingsPath); err == nil {
		_ = json.Unmarshal(data, &raw)
	}
	if raw == nil {
		raw = make(map[string]interface{})
	}

	// Merge env vars — add ours on top of any user-specified ones
	existingEnv, _ := raw["env"].(map[string]interface{})
	if existingEnv == nil {
		existingEnv = make(map[string]interface{})
	}
	for k, v := range cfg.ClaudeEnv.EnvToMap() {
		existingEnv[k] = v
	}
	raw["env"] = existingEnv

	// Set credential refresh and OTEL header helper commands
	raw["awsAuthRefresh"] = fmt.Sprintf("%s --profile %s", quotedBin, profile)

	if cfg.ClaudeEnv.OTELExporterEndpoint != "" {
		// otelHeadersHelper invoked by Claude Code for telemetry attribution
		// Users can add --log-file flag to capture logs if troubleshooting is needed
		raw["otelHeadersHelper"] = fmt.Sprintf("%s --get-otel-headers --profile %s", quotedBin, profile)
	}

	// Install quota hooks inline if a quota endpoint is configured
	if cfg.Profile.QuotaAPIEndpoint != "" {
		hookCmd := fmt.Sprintf("%s --quota-hook --profile %s", quotedBin, profile)
		raw["hooks"] = ensureQuotaHook(raw["hooks"], hookCmd)
	}

	// NOTE: OTEL headers are provided via otelHeadersHelper (--get-otel-headers) above.
	// The --otel-stats-hook should NOT be on UserPromptSubmit as it returns headers,
	// not decision validation. Remove any legacy otel-stats-hook entries.
	raw["hooks"] = removeOTELStatsHook(raw["hooks"])

	return atomicWriteJSON(settingsPath, raw, 0644)
}

// ensureQuotaHook ensures a --quota-hook entry exists in the hooks structure,
// returning the updated hooks value.
func ensureQuotaHook(hooksVal interface{}, hookCmd string) map[string]interface{} {
	hooks, _ := hooksVal.(map[string]interface{})
	if hooks == nil {
		hooks = make(map[string]interface{})
	}

	userPromptHooks, _ := hooks["UserPromptSubmit"].([]interface{})

	// Check if already installed
	for _, h := range userPromptHooks {
		if hm, ok := h.(map[string]interface{}); ok {
			if hooksList, ok := hm["hooks"].([]interface{}); ok {
				for _, hl := range hooksList {
					if hlm, ok := hl.(map[string]interface{}); ok {
						if cmd, ok := hlm["command"].(string); ok && strings.Contains(cmd, "--quota-hook") {
							return hooks // Already present
						}
					}
				}
			}
		}
	}

	newHook := map[string]interface{}{
		"matcher": "",
		"hooks": []interface{}{
			map[string]interface{}{
				"type":    "command",
				"command": hookCmd,
				"timeout": 10,
			},
		},
	}
	userPromptHooks = append(userPromptHooks, newHook)
	hooks["UserPromptSubmit"] = userPromptHooks
	return hooks
}

// ensureOTELHook ensures a --otel-stats-hook entry exists in the hooks structure.
// It installs on UserPromptSubmit so telemetry is sent with each prompt.
//
// DEPRECATED: This is no longer used. OTEL headers are provided via otelHeadersHelper
// (--get-otel-headers) instead. Keeping this function for reference but it should not
// be called, as --otel-stats-hook returns headers not decision validation.
func ensureOTELHook(hooksVal interface{}, hookCmd string) map[string]interface{} {
	hooks, _ := hooksVal.(map[string]interface{})
	if hooks == nil {
		hooks = make(map[string]interface{})
	}

	userPromptHooks, _ := hooks["UserPromptSubmit"].([]interface{})

	// Check if already installed
	for _, h := range userPromptHooks {
		if hm, ok := h.(map[string]interface{}); ok {
			if hooksList, ok := hm["hooks"].([]interface{}); ok {
				for _, hl := range hooksList {
					if hlm, ok := hl.(map[string]interface{}); ok {
						if cmd, ok := hlm["command"].(string); ok && strings.Contains(cmd, "--otel-stats-hook") {
							return hooks // Already present
						}
					}
				}
			}
		}
	}

	newHook := map[string]interface{}{
		"matcher": "",
		"hooks": []interface{}{
			map[string]interface{}{
				"type":    "command",
				"command": hookCmd,
				"timeout": 10,
			},
		},
	}
	userPromptHooks = append(userPromptHooks, newHook)
	hooks["UserPromptSubmit"] = userPromptHooks
	return hooks
}

// removeOTELStatsHook removes any --otel-stats-hook entries from UserPromptSubmit hooks.
// This cleans up legacy configurations where otel-stats-hook was incorrectly registered
// as a prompt validation hook instead of using otelHeadersHelper.
func removeOTELStatsHook(hooksVal interface{}) map[string]interface{} {
	hooks, _ := hooksVal.(map[string]interface{})
	if hooks == nil {
		return hooks
	}

	userPromptHooks, _ := hooks["UserPromptSubmit"].([]interface{})
	if userPromptHooks == nil {
		return hooks
	}

	// Filter out any hooks containing --otel-stats-hook
	var filtered []interface{}
	for _, h := range userPromptHooks {
		if hm, ok := h.(map[string]interface{}); ok {
			if hooksList, ok := hm["hooks"].([]interface{}); ok {
				keep := true
				for _, hl := range hooksList {
					if hlm, ok := hl.(map[string]interface{}); ok {
						if cmd, ok := hlm["command"].(string); ok && strings.Contains(cmd, "--otel-stats-hook") {
							keep = false
							break
						}
					}
				}
				if keep {
					filtered = append(filtered, h)
				}
			}
		}
	}

	hooks["UserPromptSubmit"] = filtered
	return hooks
}

// WriteAWSConfig writes credential_process entries to ~/.aws/config.
func WriteAWSConfig(cfg *AppConfig) error {
	awsDir := AWSDir()
	if err := os.MkdirAll(awsDir, 0700); err != nil {
		return fmt.Errorf("create aws dir: %w", err)
	}

	configPath := filepath.Join(awsDir, "config")
	binaryPath, err := InstalledBinaryPath()
	if err != nil {
		return fmt.Errorf("determine binary path: %w", err)
	}
	quotedBin := quotePath(binaryPath)
	profile := cfg.Profile.ProfileName
	region := cfg.Profile.AWSRegion

	// Read existing config or start fresh
	lines, sections := parseINI(configPath)

	sectionName := "profile " + profile
	credCmd := fmt.Sprintf("%s --credential-process --profile %s", quotedBin, profile)

	if _, exists := sections[sectionName]; exists {
		// Update existing section
		lines = updateINIKey(lines, sectionName, "credential_process", credCmd)
		lines = updateINIKey(lines, sectionName, "region", region)
	} else {
		// Append new section
		lines = append(lines, "")
		lines = append(lines, fmt.Sprintf("[%s]", sectionName))
		lines = append(lines, "credential_process = "+credCmd)
		lines = append(lines, "region = "+region)
	}

	return atomicWriteFile(configPath, []byte(strings.Join(lines, "\n")+"\n"), 0600)
}

// InstalledBinaryPath returns the path to the installed binary.
func InstalledBinaryPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(exe)
}

// InstallQuotaHooks adds UserPromptSubmit hooks to ~/.claude/settings.json.
// This is a standalone entry point for --install-hooks; WriteClaudeSettings
// already installs quota hooks when a quota endpoint is configured.
func InstallQuotaHooks(cfg *AppConfig) error {
	settingsPath := filepath.Join(ClaudeDir(), "settings.json")
	binaryPath, err := InstalledBinaryPath()
	if err != nil {
		return err
	}
	quotedBin := quotePath(binaryPath)
	hookCmd := fmt.Sprintf("%s --quota-hook --profile %s", quotedBin, cfg.Profile.ProfileName)

	// Load existing settings
	var raw map[string]interface{}
	data, err := os.ReadFile(settingsPath)
	if err == nil {
		_ = json.Unmarshal(data, &raw)
	}
	if raw == nil {
		raw = make(map[string]interface{})
	}

	raw["hooks"] = ensureQuotaHook(raw["hooks"], hookCmd)

	return atomicWriteJSON(settingsPath, raw, 0644)
}

// --- helpers ---

func quotePath(p string) string {
	// Claude Code invokes these commands via bash, which doesn't understand
	// Windows backslashes. Windows itself accepts forward slashes just fine.
	p = strings.ReplaceAll(p, `\`, `/`)
	if strings.Contains(p, " ") {
		return `"` + p + `"`
	}
	return p
}

func atomicWriteJSON(path string, v interface{}, perm os.FileMode) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return atomicWriteFile(path, append(data, '\n'), perm)
}

func atomicWriteFile(path string, data []byte, perm os.FileMode) error {
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

// parseINI reads an INI file and returns lines + map of section names to line indices.
func parseINI(path string) ([]string, map[string]int) {
	sections := make(map[string]int)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, sections
	}
	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			name := trimmed[1 : len(trimmed)-1]
			sections[name] = i
		}
	}
	return lines, sections
}

// updateINIKey updates a key within a section of an INI file.
func updateINIKey(lines []string, section, key, value string) []string {
	inSection := false
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			name := trimmed[1 : len(trimmed)-1]
			inSection = (name == section)
			continue
		}
		if inSection && strings.HasPrefix(trimmed, key+" ") || inSection && strings.HasPrefix(trimmed, key+"=") {
			lines[i] = key + " = " + value
			return lines
		}
	}
	// Key not found, find section end and insert
	inSection = false
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			name := trimmed[1 : len(trimmed)-1]
			if inSection {
				// Insert before next section
				newLines := make([]string, 0, len(lines)+1)
				newLines = append(newLines, lines[:i]...)
				newLines = append(newLines, key+" = "+value)
				newLines = append(newLines, lines[i:]...)
				return newLines
			}
			inSection = (name == section)
		}
	}
	// Section was last, append to end
	if inSection {
		lines = append(lines, key+" = "+value)
	}
	return lines
}
