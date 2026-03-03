//go:build windows

package ui

import (
	"os"

	"golang.org/x/sys/windows"
)

// shouldEnableColor tries to enable Virtual Terminal Processing on the
// stderr console handle. Returns true if ANSI escapes will be rendered.
func shouldEnableColor() bool {
	// NO_COLOR convention (https://no-color.org/).
	if os.Getenv("NO_COLOR") != "" {
		return false
	}

	// If stderr is not a terminal (piped/redirected), skip colour.
	h := windows.Handle(os.Stderr.Fd())
	var mode uint32
	if err := windows.GetConsoleMode(h, &mode); err != nil {
		// Not a console — probably redirected to a file.
		return false
	}

	// Try enabling ENABLE_VIRTUAL_TERMINAL_PROCESSING (0x0004).
	if err := windows.SetConsoleMode(h, mode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING); err != nil {
		// Old Windows version that doesn't support VT — no colour.
		return false
	}

	return true
}
