// Package ui provides coloured, user-friendly console output for the launcher.
//
// On Windows it attempts to enable Virtual Terminal Processing so ANSI escape
// codes render correctly. If the terminal does not support VT sequences
// (older cmd.exe, piped output, etc.) colours are silently disabled and
// the output falls back to plain text with ASCII symbols.
package ui

import (
	"fmt"
	"os"
	"strings"
	"sync"
)

// colour / style values — populated by init(). When colour is disabled
// every value is the empty string, producing clean plain-text output.
var (
	cReset     string
	cBold      string
	cDim       string
	cRed       string
	cGreen     string
	cYellow    string
	cCyan      string
	cBoldCyan  string
	cBoldGreen string
	cBoldRed   string
)

// Symbols used in output. Plain ASCII so they work everywhere.
var (
	symOK   = "+"
	symFail = "x"
	symWarn = "!"
	symDot  = ">"
	symRun  = "~"
	symArr  = "->"
	symBox  = "-"
)

var initOnce sync.Once

// Init detects colour support and enables VT processing on Windows.
// It is called automatically on first use, but callers may invoke it
// explicitly at startup to fail-fast.
func Init() {
	initOnce.Do(func() {
		if shouldEnableColor() {
			enableColor()
		}
	})
}

func enableColor() {
	cReset = "\033[0m"
	cBold = "\033[1m"
	cDim = "\033[2m"
	cRed = "\033[31m"
	cGreen = "\033[32m"
	cYellow = "\033[33m"
	cCyan = "\033[36m"
	cBoldCyan = cBold + cCyan
	cBoldGreen = cBold + cGreen
	cBoldRed = cBold + cRed
	// upgrade symbols to Unicode when colour is available (implies modern terminal)
	symOK = "\u2714"  // ✔
	symFail = "\u2718" // ✘
	symWarn = "\u26A0" // ⚠
	symDot = "\u2022"  // •
	symRun = "\u25B6"  // ▶
	symArr = "\u2192"  // →
	symBox = "\u2500"  // ─
}

// ensure calls Init so every public function is safe to call without setup.
func ensure() { Init() }

// --- public API ---

// Banner prints the application header.
func Banner(title string) {
	ensure()
	width := 48
	pad := width - 4 - len(title)
	if pad < 0 {
		pad = 0
	}
	bar := strings.Repeat(symBox, width-2)
	if cReset != "" {
		// box-drawing mode
		fmt.Fprintf(os.Stderr, "\n%s\u256D%s\u256E%s\n", cDim, bar, cReset)
		fmt.Fprintf(os.Stderr, "%s\u2502%s  %s%s%s%s \u2502%s\n", cDim, cReset, cBoldCyan, title, cReset, strings.Repeat(" ", pad), cReset)
		fmt.Fprintf(os.Stderr, "%s\u2570%s\u256F%s\n\n", cDim, bar, cReset)
	} else {
		// plain-text mode
		fmt.Fprintf(os.Stderr, "\n%s\n  %s\n%s\n\n", bar, title, bar)
	}
}

// Step prints a numbered step header: [1/4] Checking dependencies...
func Step(current, total int, msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "%s[%d/%d]%s %s%s%s\n", cBoldCyan, current, total, cReset, cBold, msg, cReset)
}

// Success prints a green success line with a check symbol.
func Success(msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "  %s%s%s %s\n", cGreen, symOK, cReset, msg)
}

// Fail prints a red failure line with cross symbol.
func Fail(msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "  %s%s%s %s\n", cRed, symFail, cReset, msg)
}

// Warn prints a yellow warning line.
func Warn(msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "  %s%s%s %s\n", cYellow, symWarn, cReset, msg)
}

// Info prints a dimmed info/detail line.
func Info(msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "  %s%s%s %s\n", cDim, symDot, cReset, msg)
}

// Progress prints an in-progress line.
func Progress(msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "  %s%s%s %s\n", cCyan, symRun, cReset, msg)
}

// Hint prints an indented hint with an arrow.
func Hint(msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "    %s%s %s%s\n", cDim, symArr, msg, cReset)
}

// DepFound prints a dependency found line with name, version, and optional path.
func DepFound(name, version string) {
	ensure()
	ver := version
	if ver == "" {
		ver = "installed"
	}
	fmt.Fprintf(os.Stderr, "  %s%s%s %-22s %s%s%s\n", cGreen, symOK, cReset, name, cDim, ver, cReset)
}

// DepMissing prints a dependency missing line (required or optional).
func DepMissing(name string, required bool, helpURL string) {
	ensure()
	if required {
		fmt.Fprintf(os.Stderr, "  %s%s%s %-22s %snot found (required)%s\n", cRed, symFail, cReset, name, cRed, cReset)
	} else {
		fmt.Fprintf(os.Stderr, "  %s%s%s %-22s %snot found (optional)%s\n", cYellow, symWarn, cReset, name, cYellow, cReset)
	}
	if helpURL != "" {
		Hint("Install: " + helpURL)
	}
}

// DepInstalling prints an installing-in-progress line.
func DepInstalling(name string) {
	ensure()
	fmt.Fprintf(os.Stderr, "  %s%s%s Installing %s...\n", cCyan, symRun, cReset, name)
}

// DepInstalled prints a successful installation line.
func DepInstalled(name, version string) {
	ensure()
	ver := version
	if ver == "" {
		ver = "installed"
	}
	fmt.Fprintf(os.Stderr, "  %s%s%s %-22s %s (just installed)\n", cGreen, symOK, cReset, name, ver)
}

// DepInstallFailed prints a failed installation line.
func DepInstallFailed(name string, err error) {
	ensure()
	fmt.Fprintf(os.Stderr, "  %s%s%s %-22s install failed: %v\n", cRed, symFail, cReset, name, err)
}

// Error prints a red error message.
func Error(msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "\n%s%s Error: %s%s\n", cBoldRed, symFail, msg, cReset)
}

// Complete prints a final success summary.
func Complete(msg string) {
	ensure()
	fmt.Fprintf(os.Stderr, "\n%s%s %s%s\n", cBoldGreen, symOK, msg, cReset)
}

// Divider prints a thin separator.
func Divider() {
	ensure()
	fmt.Fprintf(os.Stderr, "%s%s%s\n", cDim, strings.Repeat(symBox, 48), cReset)
}

// Keyval prints an indented key: value pair.
func Keyval(key, value string) {
	ensure()
	fmt.Fprintf(os.Stderr, "  %s%-14s%s %s\n", cDim, key+":", cReset, value)
}
