package health

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/clouds-anr/GovClaudeClient/internal/logging"
	"github.com/clouds-anr/GovClaudeClient/internal/ui"
)

// Dependency describes a required external program.
type Dependency struct {
	Name     string // Human-readable name
	Binary   string // Binary name to look up in PATH
	Required bool   // If true, missing dependency is a hard error
	HelpURL  string // Where to get it
}

// DefaultDependencies returns the list of programs the launcher expects.
// Order matters: dependencies are installed sequentially, so items that
// other tools depend on (e.g. Git, which Claude Code CLI requires) must
// appear first.
func DefaultDependencies() []Dependency {
	deps := []Dependency{
		{
			Name:     "Git",
			Binary:   "git",
			Required: true,
			HelpURL:  "https://git-scm.com/downloads",
		},
		{
			Name:     "Claude Code CLI",
			Binary:   "claude",
			Required: true,
			HelpURL:  "https://docs.anthropic.com/en/docs/claude-code/getting-started",
		},
	}
	return deps
}

// CheckResult is the outcome of checking one dependency.
type CheckResult struct {
	Dep     Dependency
	Found   bool
	Path    string
	Version string
}

// commonInstallPaths lists well-known installation directories per binary per OS.
// These are probed when exec.LookPath fails, mirroring the Python launcher behavior.
var commonInstallPaths = map[string]map[string][]string{
	"claude": {
		"windows": {
			`%USERPROFILE%\.local\bin\claude.exe`,
			`%LOCALAPPDATA%\.claude\bin\claude.exe`,
			`%LOCALAPPDATA%\Programs\claude-code\claude.exe`,
			`%APPDATA%\npm\claude.cmd`,
			`%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\Anthropic.Claude_*\claude.exe`,
		},
		"darwin": {
			"~/.local/bin/claude",
			"/usr/local/bin/claude",
		},
		"linux": {
			"~/.local/bin/claude",
			"/usr/local/bin/claude",
		},
	},
	"git": {
		"windows": {
			`C:\Program Files\Git\cmd\git.exe`,
			`C:\Program Files (x86)\Git\cmd\git.exe`,
		},
	},
	"aws": {
		"windows": {
			`C:\Program Files\Amazon\AWSCLIV2\aws.exe`,
		},
	},
}

// gitBashPaths are common locations for bash.exe shipped with Git for Windows.
var gitBashPaths = []string{
	`C:\Program Files\Git\bin\bash.exe`,
	`C:\Program Files (x86)\Git\bin\bash.exe`,
}

// CheckDependencies verifies that all expected binaries are available.
// It first tries exec.LookPath, then probes well-known install directories.
// On Windows, finding Git also sets CLAUDE_CODE_GIT_BASH_PATH if bash is
// available (required by Claude Code).
// Returns the list of results and whether all *required* deps are present.
func CheckDependencies(deps []Dependency) ([]CheckResult, bool) {
	allRequired := true
	var results []CheckResult

	for _, d := range deps {
		r := CheckResult{Dep: d}

		// 1. Standard PATH lookup.
		path, err := exec.LookPath(d.Binary)
		if err != nil {
			// 2. Probe common install locations.
			path = probeCommonPaths(d.Binary)
		}

		if path != "" {
			r.Found = true
			r.Path = path
			r.Version = getVersion(path)
			logging.Debug("dependency found", "name", d.Name, "path", path, "version", r.Version)
			ui.DepFound(d.Name, r.Version)

			// On Windows, set CLAUDE_CODE_GIT_BASH_PATH when we find git.
			if d.Binary == "git" && runtime.GOOS == "windows" {
				setGitBashPath(path)
			}
		} else {
			logging.Warn("dependency not found", "name", d.Name, "binary", d.Binary, "required", d.Required)
			ui.DepMissing(d.Name, d.Required, d.HelpURL)
			if d.Required {
				allRequired = false
			}
		}
		results = append(results, r)
	}
	return results, allRequired
}

// probeCommonPaths checks well-known install directories for the given binary.
// If found, the binary's directory is prepended to PATH and the full path is returned.
// Supports glob patterns (e.g. for WinGet paths containing *).
func probeCommonPaths(binary string) string {
	goos := runtime.GOOS
	osPaths, ok := commonInstallPaths[binary]
	if !ok {
		return ""
	}
	candidates, ok := osPaths[goos]
	if !ok {
		return ""
	}

	for _, raw := range candidates {
		expanded := expandEnvPath(raw)

		// If the path contains a glob character, use filepath.Glob.
		var matches []string
		if strings.ContainsAny(expanded, "*?[") {
			matches, _ = filepath.Glob(expanded)
		} else if fileExists(expanded) {
			matches = []string{expanded}
		}

		for _, match := range matches {
			if fileExists(match) {
				// Add its directory to PATH for this process.
				dir := filepath.Dir(match)
				currentPATH := os.Getenv("PATH")
				sep := ":"
				if goos == "windows" {
					sep = ";"
				}
				if !strings.Contains(currentPATH, dir) {
					os.Setenv("PATH", dir+sep+currentPATH)
					logging.Debug("added common path to PATH", "dir", dir, "binary", binary)
				}
				return match
			}
		}
	}
	return ""
}

// setGitBashPath sets CLAUDE_CODE_GIT_BASH_PATH if bash.exe can be found
// relative to the git binary or in well-known locations.
func setGitBashPath(gitPath string) {
	// Already set by user?
	if os.Getenv("CLAUDE_CODE_GIT_BASH_PATH") != "" {
		return
	}

	// Try relative to the git binary: ..\bin\bash.exe
	gitDir := filepath.Dir(gitPath)                                        // e.g. C:\Program Files\Git\cmd
	bashRelative := filepath.Join(filepath.Dir(gitDir), "bin", "bash.exe") // ..\bin\bash.exe
	if fileExists(bashRelative) {
		os.Setenv("CLAUDE_CODE_GIT_BASH_PATH", bashRelative)
		logging.Debug("set CLAUDE_CODE_GIT_BASH_PATH", "path", bashRelative)
		return
	}

	// Try well-known paths.
	for _, p := range gitBashPaths {
		if fileExists(p) {
			os.Setenv("CLAUDE_CODE_GIT_BASH_PATH", p)
			logging.Debug("set CLAUDE_CODE_GIT_BASH_PATH", "path", p)
			return
		}
	}
}

// expandEnvPath expands ~, %USERPROFILE%, and %LOCALAPPDATA% in a path string.
func expandEnvPath(p string) string {
	home, _ := os.UserHomeDir()
	p = strings.ReplaceAll(p, "~", home)
	p = strings.ReplaceAll(p, "%USERPROFILE%", home)
	if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
		p = strings.ReplaceAll(p, "%LOCALAPPDATA%", localAppData)
	} else {
		p = strings.ReplaceAll(p, "%LOCALAPPDATA%", filepath.Join(home, "AppData", "Local"))
	}
	return p
}

// PrintDependencyReport writes a human-readable dependency summary to stderr.
// Note: CheckDependencies already prints per-dep results as they run, so this
// is only needed when you want a standalone summary (e.g. --status mode).
func PrintDependencyReport(results []CheckResult) {
	fmt.Fprintln(os.Stderr)
	ui.Divider()
	for _, r := range results {
		if r.Found {
			ui.DepFound(r.Dep.Name, r.Version)
		} else {
			ui.DepMissing(r.Dep.Name, r.Dep.Required, r.Dep.HelpURL)
		}
	}
}

// getVersion runs --version on a binary and returns the first line.
// Accepts either a bare binary name or a full path.
func getVersion(binary string) string {
	out, err := exec.Command(binary, "--version").CombinedOutput()
	if err != nil {
		// Some tools use -v instead
		out, err = exec.Command(binary, "-v").CombinedOutput()
		if err != nil {
			return ""
		}
	}
	line := strings.TrimSpace(strings.Split(string(out), "\n")[0])
	// Truncate long output
	if len(line) > 60 {
		line = line[:57] + "..."
	}
	return line
}

// PlatformNote returns a hint about the best install method for the current OS.
func PlatformNote() string {
	switch runtime.GOOS {
	case "darwin":
		return "Tip: use 'brew install' for most dependencies on macOS"
	case "linux":
		return "Tip: use your package manager (apt, yum, dnf) to install dependencies"
	case "windows":
		return "Tip: use 'winget install' or download installers from the URLs above"
	default:
		return ""
	}
}
