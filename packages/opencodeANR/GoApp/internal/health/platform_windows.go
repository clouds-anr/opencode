//go:build windows

package health

import (
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/windows/registry"

	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// EnsureSystemPATH ensures that critical Windows system directories are
// present in the process PATH. In environments like Windows Sandbox the
// inherited PATH can be severely stripped, missing directories for cmd.exe,
// powershell.exe, rundll32.exe, and other tools the launcher relies on.
// Call this once at startup before any exec.LookPath or exec.Command calls.
func EnsureSystemPATH() {
	sysRoot := os.Getenv("SystemRoot")
	if sysRoot == "" {
		sysRoot = `C:\Windows`
	}

	// Essential system directories that must be in PATH.
	essentialDirs := []string{
		filepath.Join(sysRoot, "System32"),
		filepath.Join(sysRoot, "System32", "WindowsPowerShell", "v1.0"),
		filepath.Join(sysRoot, "System32", "Wbem"),
		sysRoot,
	}

	currentPATH := os.Getenv("PATH")
	var added []string
	for _, dir := range essentialDirs {
		if !strings.Contains(strings.ToLower(currentPATH), strings.ToLower(dir)) {
			added = append(added, dir)
		}
	}

	if len(added) > 0 {
		newPATH := currentPATH + ";" + strings.Join(added, ";")
		os.Setenv("PATH", newPATH)
		logging.Debug("ensured system directories in PATH", "added", added)
	}
}

// refreshPathFromRegistry reads the current user and system PATH from the
// Windows registry and updates os.Environ so that exec.LookPath picks up
// paths added by freshly-run installers (which modify the registry but don't
// affect the current process environment).
func refreshPathFromRegistry() {
	var parts []string

	// System PATH
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE,
		`SYSTEM\CurrentControlSet\Control\Session Manager\Environment`,
		registry.QUERY_VALUE); err == nil {
		defer k.Close()
		if sysPath, _, err := k.GetStringValue("Path"); err == nil {
			parts = append(parts, sysPath)
		}
	}

	// User PATH
	if k, err := registry.OpenKey(registry.CURRENT_USER,
		`Environment`, registry.QUERY_VALUE); err == nil {
		defer k.Close()
		if userPath, _, err := k.GetStringValue("Path"); err == nil {
			parts = append(parts, userPath)
		}
	}

	if len(parts) > 0 {
		newPATH := strings.Join(parts, ";")
		os.Setenv("PATH", newPATH)
		logging.Debug("refreshed PATH from Windows registry")
	}
}

// persistUserPATH ensures the given directories are in the user's permanent
// PATH in the Windows registry. This prevents warnings like "X is not in
// your PATH" from installers and makes binaries available in future sessions.
func persistUserPATH(dirs []string) {
	if len(dirs) == 0 {
		return
	}

	k, err := registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		logging.Debug("could not open user Environment key for writing", "error", err)
		return
	}
	defer k.Close()

	userPath, _, err := k.GetStringValue("Path")
	if err != nil {
		userPath = ""
	}

	lowerPath := strings.ToLower(userPath)
	var toAdd []string
	for _, dir := range dirs {
		expanded := expandPath(dir)
		if !strings.Contains(lowerPath, strings.ToLower(expanded)) {
			toAdd = append(toAdd, expanded)
		}
	}

	if len(toAdd) == 0 {
		return
	}

	newPath := userPath
	if newPath != "" && !strings.HasSuffix(newPath, ";") {
		newPath += ";"
	}
	newPath += strings.Join(toAdd, ";")

	if err := k.SetStringValue("Path", newPath); err != nil {
		logging.Warn("could not persist PATH to registry", "error", err)
		return
	}
	logging.Info("persisted directories to user PATH in registry", "added", toAdd)
}
