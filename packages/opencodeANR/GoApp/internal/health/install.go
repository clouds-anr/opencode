package health

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/clouds-anr/GovClaudeClient/internal/logging"
	"github.com/clouds-anr/GovClaudeClient/internal/ui"
)

// InstallerInfo describes how to obtain and silently install a dependency.
type InstallerInfo struct {
	// LocalFilenames is the installer filename to look for in the "installers" folder.
	// Keyed by GOOS.
	LocalFilenames map[string]string

	// ScriptInstall is a shell command to pipe-install (e.g. curl | bash).
	// Use %s as a placeholder for the download URL.
	// Keyed by GOOS.
	ScriptInstall map[string][]string

	// PostInstallPaths are directories that should be added to PATH after install.
	// Keyed by GOOS. May contain ~ which is expanded.
	PostInstallPaths map[string][]string
}

// DefaultInstallerURLs are the public download URLs used when no override is set.
// For Git on Windows, set to "" so we resolve dynamically via GitHub API.
var DefaultInstallerURLs = map[string]map[string]string{
	"claude": {
		"darwin":  "https://claude.ai/install.sh",
		"linux":   "https://claude.ai/install.sh",
		"windows": "https://claude.ai/install.ps1",
	},
	"git": {
		"windows": "", // resolved dynamically by resolveGitForWindowsURL()
	},
}

// installerRegistry maps dependency binary names to their install instructions.
var installerRegistry = map[string]InstallerInfo{
	"claude": {
		LocalFilenames: map[string]string{
			"darwin":  "claude-installer.sh",
			"linux":   "claude-installer.sh",
			"windows": "claude-installer.cmd",
		},
		ScriptInstall: map[string][]string{
			"darwin":  {"bash", "-c", "curl -fsSL %s | bash"},
			"linux":   {"bash", "-c", "curl -fsSL %s | bash"},
			"windows": {"powershell", "-NoProfile", "-Command", "irm %s | iex"},
		},
		PostInstallPaths: map[string][]string{
			"darwin": {"~/.local/bin"},
			"linux":  {"~/.local/bin"},
			"windows": {
				`%USERPROFILE%\.local\bin`,
				`%LOCALAPPDATA%\.claude\bin`,
				`%LOCALAPPDATA%\Programs\claude-code`,
				`%APPDATA%\npm`,
			},
		},
	},
	"git": {
		LocalFilenames: map[string]string{
			"darwin":  "git-installer.pkg",
			"linux":   "git-installer.deb",
			"windows": "git-installer.exe",
		},
		ScriptInstall: map[string][]string{
			"darwin": {"bash", "-c", "xcode-select --install 2>/dev/null || brew install git"},
			"linux":  {"bash", "-c", "sudo apt-get update -qq && sudo apt-get install -y -qq git"},
		},
		PostInstallPaths: map[string][]string{
			"windows": {`C:\Program Files\Git\cmd`, `C:\Program Files\Git\bin`},
		},
	},
}

// InstallerURLOverrides maps binary names to custom download URLs from the env file.
type InstallerURLOverrides map[string]string

// installerMetadata is the JSON schema for claude-installer.json bundled
// in the installers/ directory. This mirrors the Python launcher convention.
type installerMetadata struct {
	Filename string `json:"filename"`
	Version  string `json:"version,omitempty"`
	Checksum string `json:"checksum,omitempty"`
}

// EnsureDependencies checks each dependency and attempts to install any that
// are missing. It returns the updated check results and whether all required
// deps are now present. The caller's process PATH is refreshed after installs.
// urlOverrides allows the env file to supply custom download URLs per binary.
func EnsureDependencies(deps []Dependency, urlOverrides InstallerURLOverrides) ([]CheckResult, bool) {
	results, allOK := CheckDependencies(deps)
	if allOK {
		return results, true
	}

	// Locate the "installers" folder next to the running binary.
	installersDir := findInstallersDir()
	if installersDir != "" {
		logging.Info("local installers directory found", "path", installersDir)
	} else {
		logging.Info("no local installers directory; will download as needed")
	}

	installed := false
	for i, r := range results {
		if r.Found {
			continue
		}
		info, ok := installerRegistry[r.Dep.Binary]
		if !ok {
			logging.Warn("no installer registered for dependency", "binary", r.Dep.Binary)
			continue
		}

		ui.DepInstalling(r.Dep.Name)
		logging.Info("attempting auto-install", "name", r.Dep.Name, "binary", r.Dep.Binary)

		overrideURL := ""
		if urlOverrides != nil {
			overrideURL = urlOverrides[r.Dep.Binary]
		}
		err := installDependency(r.Dep, info, installersDir, overrideURL)
		if err != nil {
			ui.DepInstallFailed(r.Dep.Name, err)
			logging.Error("auto-install failed", "name", r.Dep.Name, "error", err)
			continue
		}

		// On Windows, refresh PATH from registry to pick up installer changes.
		// This must happen BEFORE addPostInstallPaths so the registry-based
		// PATH doesn't overwrite the post-install directories we prepend.
		refreshPathFromRegistry()

		// Add post-install paths for this dependency.
		addPostInstallPaths(info)

		// Re-check this specific dependency (LookPath then common paths).
		path, err := exec.LookPath(r.Dep.Binary)
		if err != nil {
			path = probeCommonPaths(r.Dep.Binary)
		}
		// Last resort on Windows: ask the shell to locate the binary.
		if path == "" && runtime.GOOS == "windows" {
			path = whereCommand(r.Dep.Binary)
		}
		if path != "" {
			results[i].Found = true
			results[i].Path = path
			results[i].Version = getVersion(path)
			installed = true
			ui.DepInstalled(r.Dep.Name, results[i].Version)
			logging.Info("auto-install succeeded", "name", r.Dep.Name, "path", path)

			// Persist post-install directories to the user's permanent PATH
			// so future sessions find the binary without re-install.
			if paths, ok := info.PostInstallPaths[runtime.GOOS]; ok {
				persistUserPATH(paths)
			}

			// Set CLAUDE_CODE_GIT_BASH_PATH on Windows after installing git.
			if r.Dep.Binary == "git" && runtime.GOOS == "windows" {
				setGitBashPath(path)
			}
		} else {
			ui.DepInstallFailed(r.Dep.Name, fmt.Errorf("not found in PATH after install"))
			logging.Error("installed but not in PATH", "name", r.Dep.Name)
		}
	}

	if installed {
		logging.Info("PATH after installs", "PATH", os.Getenv("PATH"))
	}

	// Final pass: check if all required deps are now present.
	allRequired := true
	for _, r := range results {
		if !r.Found && r.Dep.Required {
			allRequired = false
		}
	}
	return results, allRequired
}

// installDependency tries local installer first, then download/script.
func installDependency(dep Dependency, info InstallerInfo, installersDir string, overrideURL string) error {
	goos := runtime.GOOS

	// 1. Try local installer from "installers" folder.
	if installersDir != "" {
		// 1a. Check for JSON metadata file (e.g. claude-installer.json).
		//     This mirrors the Python launcher convention where a metadata file
		//     names the actual installer binary to use.
		metaPath := filepath.Join(installersDir, dep.Binary+"-installer.json")
		if fileExists(metaPath) {
			if resolved := resolveInstallerFromMetadata(metaPath, installersDir); resolved != "" {
				logging.Info("using installer from metadata", "meta", metaPath, "installer", resolved)
				return runLocalInstaller(resolved, goos)
			}
		}

		   // 1b. Fallback to hardcoded filenames.
		   if localFile, ok := info.LocalFilenames[goos]; ok {
			   localPath := filepath.Join(installersDir, localFile)
			   if fileExists(localPath) {
				   logging.Info("using local installer", "path", localPath)
				   return runLocalInstaller(localPath, goos)
			   }
			   logging.Debug("local installer not found", "expected", localPath)
		   }

		   // Special handling for Claude Code on Windows: download and run .cmd or .exe installer if not present
		   if dep.Binary == "claude" && goos == "windows" {
			   // 1. Try to run the .cmd installer directly if present
			   if localFile, ok := info.LocalFilenames[goos]; ok && strings.HasSuffix(localFile, ".cmd") {
				   localPath := filepath.Join(installersDir, localFile)
				   if fileExists(localPath) {
					   logging.Info("using .cmd installer fallback for Claude Code", "path", localPath)
					   return runLocalInstaller(localPath, goos)
				   }
			   }
			   // 2. If not present, download the latest installer (EXE or CMD) and run it
			   // Prefer EXE if available, fallback to CMD
			   var installerURL string
			   // Try to get EXE URL from official Claude download page (hardcoded for now)
			   installerURL = "https://claude.ai/installer/ClaudeCodeSetup.exe"
			   tmpPath, err := downloadFile(installerURL)
			   if err == nil {
				   logging.Info("downloaded Claude Code EXE installer", "path", tmpPath)
				   return runLocalInstaller(tmpPath, goos)
			   }
			   // If EXE fails, fallback to install.ps1 or .cmd
			   installerURL = "https://claude.ai/install.ps1"
			   tmpPath, err = downloadFile(installerURL)
			   if err == nil {
				   // Save as .cmd and run
				   cmdPath := strings.TrimSuffix(tmpPath, filepath.Ext(tmpPath)) + ".cmd"
				   os.Rename(tmpPath, cmdPath)
				   logging.Info("downloaded Claude Code CMD installer", "path", cmdPath)
				   return runLocalInstaller(cmdPath, goos)
			   }
			   return fmt.Errorf("Could not auto-install Claude Code CLI. Download attempts failed: %v", err)
		   }
	}

	// 2. Resolve the download URL: env override → default registry → dynamic.
	dlURL := overrideURL
	if dlURL == "" {
		if defaults, ok := DefaultInstallerURLs[dep.Binary]; ok {
			dlURL = defaults[goos]
		}
	}
	// For Git on Windows with no URL, resolve dynamically from GitHub releases.
	if dlURL == "" && dep.Binary == "git" && goos == "windows" {
		resolved, err := resolveGitForWindowsURL()
		if err != nil {
			logging.Warn("could not resolve latest Git for Windows URL", "error", err)
		} else {
			dlURL = resolved
			logging.Info("resolved latest Git for Windows", "url", dlURL)
		}
	}

	// 3. If the URL points to an installer binary (exe/msi/pkg/deb), download and run.
	if dlURL != "" && isDirectInstaller(dlURL) {
		logging.Info("downloading installer", "url", dlURL)
		tmpPath, err := downloadFile(dlURL)
		if err != nil {
			return fmt.Errorf("download failed: %w", err)
		}
		defer os.Remove(tmpPath)
		return runLocalInstaller(tmpPath, goos)
	}

	   // 4. Try script-based install, injecting the URL into the command template.
	   if scriptArgs, ok := info.ScriptInstall[goos]; ok && len(scriptArgs) > 0 {
		   resolved := resolveScriptArgs(scriptArgs, dlURL)
		   logging.Info("running script install", "command", resolved[0])
		   err := runScriptInstall(resolved)
		   if err == nil {
			   return nil
		   }
		   // If PowerShell is missing, try .cmd fallback for Claude Code (handled above)
		   return fmt.Errorf("Could not auto-install %s: %v", dep.Name, err)
	   }

	   return fmt.Errorf("no install method available for %s on %s", dep.Name, goos)
}

// isDirectInstaller returns true if the URL points to a downloadable installer binary.
func isDirectInstaller(url string) bool {
	lower := strings.ToLower(url)
	for _, ext := range []string{".exe", ".msi", ".pkg", ".deb", ".rpm"} {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

// resolveScriptArgs replaces %s placeholders in script commands with the URL.
func resolveScriptArgs(args []string, url string) []string {
	resolved := make([]string, len(args))
	for i, a := range args {
		if strings.Contains(a, "%s") && url != "" {
			resolved[i] = fmt.Sprintf(a, url)
		} else {
			resolved[i] = a
		}
	}
	return resolved
}

// runLocalInstaller executes a local installer file based on its extension and OS.
func runLocalInstaller(path string, goos string) error {
	ext := strings.ToLower(filepath.Ext(path))

	var cmd *exec.Cmd
	switch {
	case ext == ".sh":
		_ = os.Chmod(path, 0755)
		cmd = exec.Command("bash", path)
	case ext == ".pkg" && goos == "darwin":
		// macOS .pkg installer — requires sudo, install silently.
		cmd = exec.Command("sudo", "installer", "-pkg", path, "-target", "/")
	case ext == ".deb" && goos == "linux":
		cmd = exec.Command("sudo", "dpkg", "-i", path)
	case ext == ".exe" && goos == "windows":
		// Git for Windows supports /VERYSILENT; generic fallback.
		cmd = exec.Command(path, "/VERYSILENT", "/NORESTART", "/NOCANCEL", "/SP-")
	case ext == ".cmd" && goos == "windows":
		cmd = exec.Command("cmd", "/C", path)
	case ext == ".msi" && goos == "windows":
		cmd = exec.Command("msiexec", "/i", path, "/qn", "/norestart")
	default:
		return fmt.Errorf("unsupported installer format: %s", ext)
	}

	cmd.Stdout = os.Stderr // Show install output on stderr so we don't pollute stdout.
	cmd.Stderr = os.Stderr
	logging.Debug("running installer", "cmd", cmd.String())
	return cmd.Run()
}

// runScriptInstall runs a script-based installation command.
func runScriptInstall(args []string) error {
	   // On Windows, if the command is 'powershell' and not found, try the absolute path fallback
	   if runtime.GOOS == "windows" && len(args) > 0 && strings.ToLower(args[0]) == "powershell" {
		   _, err := exec.LookPath("powershell")
		   if err != nil {
			   absPath := `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
			   if fileExists(absPath) {
				   args[0] = absPath
			   }
		   }
	   }
	   cmd := exec.Command(args[0], args[1:]...)
	   cmd.Stdout = os.Stderr
	   cmd.Stderr = os.Stderr
	   cmd.Env = append(os.Environ(), "NONINTERACTIVE=1")
	   logging.Debug("running script install", "cmd", cmd.String())
	   return cmd.Run()
}

// downloadFile fetches a URL to a temporary file and returns its path.
// On SSL errors it retries with certificate verification disabled (for
// isolated environments like Windows Sandbox), mirroring the Python launcher.
func downloadFile(rawURL string) (string, error) {
	// Determine extension from URL.
	ext := filepath.Ext(rawURL)
	if ext == "" || len(ext) > 5 {
		ext = ".tmp"
	}

	tmpFile, err := os.CreateTemp("", "claude-install-*"+ext)
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()

	// Try with default TLS first.
	if err := doDownload(rawURL, tmpFile, nil); err != nil {
		tmpFile.Close()

		if isSSLError(err) {
			logging.Warn("SSL error downloading installer, retrying without verification", "url", rawURL, "error", err)
			fmt.Fprintln(os.Stderr, "    (SSL error, retrying without certificate verification...)")

			// Reopen the temp file truncated.
			f, reopenErr := os.OpenFile(tmpPath, os.O_WRONLY|os.O_TRUNC, 0644)
			if reopenErr != nil {
				os.Remove(tmpPath)
				return "", fmt.Errorf("reopen temp file: %w", reopenErr)
			}

			insecureTransport := &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // intentional fallback for isolated envs
			}
			if err := doDownload(rawURL, f, insecureTransport); err != nil {
				f.Close()
				os.Remove(tmpPath)
				return "", fmt.Errorf("download failed even without SSL verification: %w", err)
			}
			f.Close()
		} else {
			os.Remove(tmpPath)
			return "", err
		}
	} else {
		tmpFile.Close()
	}

	// Make executable on Unix.
	if runtime.GOOS != "windows" {
		_ = os.Chmod(tmpPath, 0755)
	}

	return tmpPath, nil
}

// doDownload performs the actual HTTP GET and writes the body to w.
// If transport is nil the default transport is used.
func doDownload(rawURL string, w io.Writer, transport http.RoundTripper) error {
	client := &http.Client{Timeout: 5 * time.Minute}
	if transport != nil {
		client.Transport = transport
	}

	resp, err := client.Get(rawURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d from %s", resp.StatusCode, rawURL)
	}

	if _, err := io.Copy(w, resp.Body); err != nil {
		return fmt.Errorf("download write: %w", err)
	}
	return nil
}

// isSSLError checks whether an error is TLS/SSL related.
func isSSLError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "tls") ||
		strings.Contains(msg, "ssl") ||
		strings.Contains(msg, "certificate") ||
		strings.Contains(msg, "x509")
}

// gitRelease is just enough of the GitHub Releases API response to find the
// 64-bit Git for Windows installer.
type gitRelease struct {
	Assets []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

// resolveGitForWindowsURL queries the GitHub Releases API for the latest
// git-for-windows release and returns the download URL for the 64-bit exe.
func resolveGitForWindowsURL() (string, error) {
	const apiURL = "https://api.github.com/repos/git-for-windows/git/releases/latest"

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("GitHub API request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub API returned HTTP %d", resp.StatusCode)
	}

	var release gitRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", fmt.Errorf("decode GitHub release: %w", err)
	}

	// Look for the 64-bit portable or full installer exe.
	for _, asset := range release.Assets {
		name := strings.ToLower(asset.Name)
		if strings.HasSuffix(name, "-64-bit.exe") && !strings.Contains(name, "portable") {
			return asset.BrowserDownloadURL, nil
		}
	}

	return "", fmt.Errorf("no 64-bit exe found in latest git-for-windows release (%d assets)", len(release.Assets))
}

// resolveInstallerFromMetadata reads a JSON metadata file and returns the
// full path to the installer binary it references, or "" if not found.
// Example JSON: {"filename": "claude.exe", "version": "2.0.30"}
func resolveInstallerFromMetadata(metaPath, installersDir string) string {
	data, err := os.ReadFile(metaPath)
	if err != nil {
		logging.Debug("could not read installer metadata", "path", metaPath, "error", err)
		return ""
	}
	var meta installerMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		logging.Warn("invalid installer metadata JSON", "path", metaPath, "error", err)
		return ""
	}
	if meta.Filename == "" {
		logging.Debug("installer metadata has no filename", "path", metaPath)
		return ""
	}
	resolved := filepath.Join(installersDir, meta.Filename)
	if fileExists(resolved) {
		return resolved
	}
	logging.Debug("installer metadata filename not found on disk", "expected", resolved)
	return ""
}

// addPostInstallPaths adds the dependency's known install directories to the
// current process PATH so subsequent LookPath calls find the new binary.
func addPostInstallPaths(info InstallerInfo) {
	goos := runtime.GOOS
	paths, ok := info.PostInstallPaths[goos]
	if !ok {
		return
	}

	currentPATH := os.Getenv("PATH")
	var added []string
	for _, p := range paths {
		expanded := expandPath(p)
		if !strings.Contains(currentPATH, expanded) {
			added = append(added, expanded)
		}
	}

	if len(added) > 0 {
		sep := ":"
		if goos == "windows" {
			sep = ";"
		}
		newPATH := strings.Join(added, sep) + sep + currentPATH
		os.Setenv("PATH", newPATH)
		logging.Debug("PATH updated", "added", added)
	}
}

// findInstallersDir looks for an "installers" directory next to the running
// binary, then falls back to the current working directory.
func findInstallersDir() string {
	// Next to the running binary.
	exe, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exe)
		candidate := filepath.Join(exeDir, "installers")
		if dirExists(candidate) {
			return candidate
		}
	}

	// Current working directory.
	cwd, err := os.Getwd()
	if err == nil {
		candidate := filepath.Join(cwd, "installers")
		if dirExists(candidate) {
			return candidate
		}
	}

	return ""
}

// expandPath replaces ~ and common Windows env-style placeholders.
// Delegates to expandEnvPath in deps.go for consistency.
func expandPath(p string) string {
	return expandEnvPath(p)
}

// whereCommand uses the OS "where" (Windows) or "which" (Unix) command
// to locate a binary. Returns the first result or "" if not found.
func whereCommand(binary string) string {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("where", binary)
	} else {
		cmd = exec.Command("which", binary)
	}
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) > 0 && lines[0] != "" {
		found := strings.TrimSpace(lines[0])
		// Add to PATH for future LookPath calls.
		dir := filepath.Dir(found)
		currentPATH := os.Getenv("PATH")
		sep := ":"
		if runtime.GOOS == "windows" {
			sep = ";"
		}
		if !strings.Contains(currentPATH, dir) {
			os.Setenv("PATH", dir+sep+currentPATH)
			logging.Debug("whereCommand: added to PATH", "dir", dir, "binary", binary)
		}
		return found
	}
	return ""
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
