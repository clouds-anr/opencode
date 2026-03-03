//go:build !windows

package auth

// allowCallbackPort is a no-op on non-Windows platforms where
// loopback firewall rules are not an issue.
func allowCallbackPort(_ int) {}
