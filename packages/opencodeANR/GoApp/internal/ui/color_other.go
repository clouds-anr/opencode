//go:build !windows

package ui

import (
	"os"
)

// shouldEnableColor returns true on Unix-like systems when stderr is a
// terminal and the NO_COLOR env var is not set.
func shouldEnableColor() bool {
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	// Check if stderr is a terminal.
	info, err := os.Stderr.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
}
