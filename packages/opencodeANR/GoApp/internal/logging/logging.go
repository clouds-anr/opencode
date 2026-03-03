package logging

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

var (
	// Logger is the global structured logger used throughout the application.
	Logger *slog.Logger

	logFile  *os.File
	initOnce sync.Once
)

// Setup initialises the global Logger.
//
// Parameters:
//   - verbose: if true, log at DEBUG to stderr (otherwise WARN to stderr only)
//   - logFilePath: if non-empty, also log to this file at DEBUG level
//     The special value "default" uses the platform default path.
//
// This function is safe to call multiple times; only the first call takes effect.
func Setup(verbose bool, logFilePath string) {
	initOnce.Do(func() {
		setup(verbose, logFilePath)
	})
}

func setup(verbose bool, logFilePath string) {
	var handlers []slog.Handler

	// ---- stderr handler (always present) ----
	stderrLevel := slog.LevelError
	if verbose {
		stderrLevel = slog.LevelDebug
	}
	handlers = append(handlers, slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: stderrLevel,
	}))

	// ---- file handler (optional) ----
	if logFilePath != "" {
		if logFilePath == "default" {
			logFilePath = defaultLogPath()
		}
		dir := filepath.Dir(logFilePath)
		if err := os.MkdirAll(dir, 0700); err != nil {
			// Silently skip file logging if directory creation fails
			// (in --get-otel-headers mode, we can't pollute stderr)
		} else {
			// Rotate if file > 5 MB
			if info, err := os.Stat(logFilePath); err == nil && info.Size() > 5*1024*1024 {
				_ = os.Rename(logFilePath, logFilePath+".1")
			}
			f, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
			if err != nil {
				// Silently skip file logging if file open fails
			} else {
				logFile = f
				handlers = append(handlers, slog.NewTextHandler(f, &slog.HandlerOptions{
					Level: slog.LevelDebug,
				}))
			}
		}
	}

	if len(handlers) == 1 {
		Logger = slog.New(handlers[0])
	} else {
		Logger = slog.New(&multiHandler{handlers: handlers})
	}
	slog.SetDefault(Logger)
}

// Close flushes and closes the log file (if any).
func Close() {
	if logFile != nil {
		_ = logFile.Sync()
		_ = logFile.Close()
	}
}

// defaultLogPath returns a platform-appropriate log file location.
func defaultLogPath() string {
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(homeDir(), "Library", "Logs", "claude-code", "launcher.log")
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = filepath.Join(homeDir(), "AppData", "Roaming")
		}
		return filepath.Join(appData, "claude-code", "launcher.log")
	default:
		return filepath.Join(homeDir(), ".local", "share", "claude-code", "launcher.log")
	}
}

func homeDir() string {
	h, err := os.UserHomeDir()
	if err != nil {
		return os.Getenv("HOME")
	}
	return h
}

// --- multiHandler fans slog records out to N handlers ---

type multiHandler struct {
	handlers []slog.Handler
}

func (m *multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range m.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (m *multiHandler) Handle(ctx context.Context, r slog.Record) error {
	var errs []string
	for _, h := range m.handlers {
		if h.Enabled(ctx, r.Level) {
			if err := h.Handle(ctx, r); err != nil {
				errs = append(errs, err.Error())
			}
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("log: %s", strings.Join(errs, "; "))
	}
	return nil
}

func (m *multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	hs := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		hs[i] = h.WithAttrs(attrs)
	}
	return &multiHandler{handlers: hs}
}

func (m *multiHandler) WithGroup(name string) slog.Handler {
	hs := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		hs[i] = h.WithGroup(name)
	}
	return &multiHandler{handlers: hs}
}

// Convenience helpers so callers don't need to import log/slog everywhere.
// All are nil-safe: if Setup() has not been called yet, the call is a no-op.

func Debug(msg string, args ...any) {
	if Logger != nil {
		Logger.Debug(msg, args...)
	}
}
func Info(msg string, args ...any) {
	if Logger != nil {
		Logger.Info(msg, args...)
	}
}
func Warn(msg string, args ...any) {
	if Logger != nil {
		Logger.Warn(msg, args...)
	}
}
func Error(msg string, args ...any) {
	if Logger != nil {
		Logger.Error(msg, args...)
	}
}

// Writer returns an io.Writer that writes each line as a DEBUG log message.
func Writer() io.Writer { return &logWriter{} }

type logWriter struct{}

func (w *logWriter) Write(p []byte) (int, error) {
	if Logger != nil {
		Logger.Debug(strings.TrimRight(string(p), "\n"))
	}
	return len(p), nil
}
