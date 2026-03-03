package proxy

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/creack/pty"
	"golang.org/x/term"
)

// Run starts the real Claude CLI, forwarding all stdio and signals.
// On platforms that support PTY (Linux, macOS), it uses a pseudo-terminal.
// On Windows (or if PTY fails), it falls back to direct stdin/stdout piping.
func Run(ctx context.Context, claudePath string, args []string, env []string) error {
	if runtime.GOOS == "windows" {
		return runDirect(ctx, claudePath, args, env)
	}

	cmd := exec.CommandContext(ctx, claudePath, args...)
	cmd.Env = env

	ptmx, err := pty.Start(cmd)
	if err != nil {
		// Fallback to direct execution if PTY fails
		return runDirect(ctx, claudePath, args, env)
	}
	defer func() { _ = ptmx.Close() }()

	// Set terminal to raw mode for proper interactive input handling
	oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err == nil {
		defer func() { _ = term.Restore(int(os.Stdin.Fd()), oldState) }()
	}

	// Set terminal size on the PTY
	if ws, err := pty.GetsizeFull(os.Stdin); err == nil {
		_ = pty.Setsize(ptmx, ws)
	}

	// Bidirectional copy: stdin to PTY and PTY to stdout
	// Both run concurrently
	done := make(chan error, 2)
	go func() {
		_, err := io.Copy(ptmx, os.Stdin)
		done <- err
	}()
	go func() {
		_, err := io.Copy(os.Stdout, ptmx)
		done <- err
	}()

	// Wait for command to complete
	err = cmd.Wait()

	// Close PTY to trigger both goroutines to exit
	// This causes the stdout copy to get EOF and the stdin copy to fail on write
	_ = ptmx.Close()
	
	// Close stdin to unblock the stdin copy goroutine if it's waiting for input
	_ = os.Stdin.Close()

	// Drain any remaining copy goroutine errors (with timeout to prevent hanging)
	timeout := time.After(1 * time.Second)
	for i := 0; i < 2; i++ {
		select {
		case <-done:
		case <-timeout:
			return err
		}
	}

	return err
}

// runDirect runs the Claude CLI without a PTY, attaching stdin/stdout/stderr directly.
func runDirect(ctx context.Context, claudePath string, args []string, env []string) error {
	cmd := exec.CommandContext(ctx, claudePath, args...)
	cmd.Env = env
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("claude process exited: %w", err)
	}
	return nil
}
