//go:build windows

package auth

import (
	"fmt"
	"os/exec"

	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// allowCallbackPort adds a Windows Firewall rule allowing inbound TCP on
// the given port. This prevents the "Windows Security Alert" popup and
// avoids silent blocking in sandbox/locked-down environments.
// Requires admin rights; failure is non-fatal (best-effort).
func allowCallbackPort(port int) {
	ruleName := fmt.Sprintf("ClaudeBedrock-OAuthCallback-%d", port)

	// Delete any stale rule from a prior run, ignore errors.
	_ = exec.Command("netsh", "advfirewall", "firewall", "delete", "rule",
		fmt.Sprintf("name=%s", ruleName)).Run()

	err := exec.Command("netsh", "advfirewall", "firewall", "add", "rule",
		fmt.Sprintf("name=%s", ruleName),
		"dir=in",
		"action=allow",
		"protocol=tcp",
		fmt.Sprintf("localport=%d", port),
		"profile=any",
	).Run()
	if err != nil {
		logging.Debug("firewall rule add failed (non-fatal)", "port", port, "error", err)
	} else {
		logging.Debug("firewall rule added for callback port", "port", port)
	}
}
