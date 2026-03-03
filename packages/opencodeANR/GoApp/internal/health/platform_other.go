//go:build !windows

package health

// EnsureSystemPATH is a no-op on non-Windows platforms.
// On Windows, this ensures critical system directories (System32,
// WindowsPowerShell, etc.) are in PATH for stripped environments
// like Windows Sandbox.
func EnsureSystemPATH() {
	// no-op: Unix systems have standard PATH set by shell init
}

// refreshPathFromRegistry is a no-op on non-Windows platforms.
// On Windows, this reads PATH from the registry to pick up changes
// made by installers that modify the registry but not the current process.
func refreshPathFromRegistry() {
	// no-op: Unix shells inherit PATH from the current environment
}

// persistUserPATH is a no-op on non-Windows platforms.
// On Windows, this writes directories to the user's registry PATH.
func persistUserPATH(dirs []string) {
	// no-op: Unix shells use profile scripts for persistent PATH changes
}
