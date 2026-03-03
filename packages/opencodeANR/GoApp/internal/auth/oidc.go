package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/clouds-anr/GovClaudeClient/internal/audit"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// OIDCTokens holds the result of an OIDC authentication.
type OIDCTokens struct {
	IDToken     string
	AccessToken string
	Claims      map[string]interface{}
}

// AuthenticateOIDC performs OIDC authentication with PKCE.
// It opens a browser, runs a local callback server on port 8400,
// and exchanges the authorization code for tokens.
func AuthenticateOIDC(ctx context.Context, cfg *config.ProfileConfig) (*OIDCTokens, error) {
	providerCfg, ok := config.ProviderConfigs[cfg.ProviderType]
	if !ok {
		return nil, fmt.Errorf("unknown provider type: %s", cfg.ProviderType)
	}

	redirectPort := 8400
	redirectURI := fmt.Sprintf("http://localhost:%d/callback", redirectPort)

	// Generate PKCE parameters
	state := randomURLSafe(16)
	nonce := randomURLSafe(16)
	codeVerifier := randomURLSafe(32)
	codeChallenge := computeS256Challenge(codeVerifier)

	// Build authorization URL
	domain := cfg.ProviderDomain
	if cfg.ProviderType == "azure" && strings.HasSuffix(domain, "/v2.0") {
		domain = domain[:len(domain)-5]
	}
	baseURL := "https://" + domain

	params := url.Values{
		"client_id":             {cfg.ClientID},
		"response_type":         {providerCfg.ResponseType},
		"scope":                 {providerCfg.Scopes},
		"redirect_uri":          {redirectURI},
		"state":                 {state},
		"nonce":                 {nonce},
		"code_challenge_method": {"S256"},
		"code_challenge":        {codeChallenge},
	}
	if cfg.ProviderType == "azure" {
		params.Set("response_mode", "query")
		params.Set("prompt", "select_account")
	}

	authURL := baseURL + providerCfg.AuthorizeEndpoint + "?" + params.Encode()
	logging.Debug("OIDC auth URL built",
		"provider", cfg.ProviderType,
		"domain", cfg.ProviderDomain,
		"redirect_port", redirectPort,
	)

	// Set up callback server.
	// Listen on 127.0.0.1 (loopback only) for the OAuth callback. We also
	// add a Windows Firewall rule before binding to prevent the system from
	// prompting and/or blocking the connection in sandbox environments.
	result := &callbackResult{}
	var wg sync.WaitGroup
	wg.Add(1)

	handler := createCallbackHandler(state, result, &wg)
	srv := &http.Server{Handler: handler}

	// On Windows, pre-authorise inbound TCP on the callback port so the
	// firewall dialog doesn't pop up (and doesn't block us in sandbox).
	allowCallbackPort(redirectPort)

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", redirectPort))
	if err != nil {
		// Fallback: try [::1] in case IPv4 loopback is unavailable.
		listener, err = net.Listen("tcp6", fmt.Sprintf("[::1]:%d", redirectPort))
	}
	if err != nil {
		// Last resort: all interfaces.
		listener, err = net.Listen("tcp", fmt.Sprintf(":%d", redirectPort))
	}
	if err != nil {
		logging.Warn("cannot bind callback port", "port", redirectPort, "error", err)
		return nil, fmt.Errorf("cannot bind to port %d (another auth in progress?): %w", redirectPort, err)
	}
	logging.Debug("callback server listening", "addr", listener.Addr().String())
	fmt.Fprintf(os.Stderr, "  Callback server ready on %s\n", listener.Addr().String())

	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(listener) }()

	// Verify the server is actually accepting before opening the browser.
	verifyConn, err := net.DialTimeout("tcp", listener.Addr().String(), 2*time.Second)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Warning: callback self-check failed: %v\n", err)
		logging.Warn("callback server self-check failed", "error", err)
	} else {
		verifyConn.Close()
		logging.Debug("callback self-check passed")
	}

	// Also check if srv.Serve returned immediately with an error.
	select {
	case err := <-serveErr:
		return nil, fmt.Errorf("callback server failed immediately: %w", err)
	default:
		// Server is running — proceed.
	}

	// Open browser
	if err := openBrowser(authURL); err != nil {
		fmt.Fprintf(os.Stderr, "Could not open browser: %v\n", err)
		fmt.Fprintf(os.Stderr, "Please visit this URL to authenticate:\n  %s\n", authURL)
	}

	// Wait for callback with timeout
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Minute):
		_ = srv.Close()
		logging.Error("OIDC authentication timed out")
		return nil, fmt.Errorf("authentication timeout - no callback received within 5 minutes")
	}

	// Give the HTTP response time to flush to the browser before
	// shutting down. Without this, srv.Close() kills the connection
	// before the success HTML reaches the browser, causing
	// ERR_CONNECTION_RESET even though the auth code was captured.
	shutdownCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)

	if result.err != "" {
		logging.Error("OIDC callback error", "error", result.err)
		// Audit failed authentication
		_ = audit.LogAuthEvent(ctx, cfg, "unknown", audit.EventAuthFailed, false, map[string]interface{}{
			"error":    result.err,
			"provider": cfg.ProviderType,
		}, errors.New(result.err))
		return nil, fmt.Errorf("authentication error: %s", result.err)
	}
	if result.code == "" {
		logging.Error("no authorization code in callback")
		return nil, fmt.Errorf("no authorization code received")
	}

	logging.Debug("authorization code received, exchanging for tokens")

	// Exchange code for tokens
	tokenURL := baseURL + providerCfg.TokenEndpoint
	tokenData := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {result.code},
		"redirect_uri":  {redirectURI},
		"client_id":     {cfg.ClientID},
		"code_verifier": {codeVerifier},
	}

	resp, err := http.Post(tokenURL, "application/x-www-form-urlencoded", strings.NewReader(tokenData.Encode()))
	if err != nil {
		return nil, fmt.Errorf("token exchange request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		IDToken     string `json:"id_token"`
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("parse token response: %w", err)
	}

	// Decode ID token claims (no signature verification - HTTPS transport relied upon)
	claims, err := DecodeJWTPayload(tokenResp.IDToken)
	if err != nil {
		return nil, fmt.Errorf("decode id token: %w", err)
	}

	// Validate nonce
	if claimNonce, ok := claims["nonce"].(string); ok && claimNonce != nonce {
		return nil, fmt.Errorf("invalid nonce in ID token")
	}

	logging.Debug("OIDC authentication complete",
		"provider", cfg.ProviderType,
		"has_id_token", tokenResp.IDToken != "",
	)

	return &OIDCTokens{
		IDToken:     tokenResp.IDToken,
		AccessToken: tokenResp.AccessToken,
		Claims:      claims,
	}, nil
}

// WaitForAuthCompletion waits for another process to finish authentication
// by polling the redirect port and checking cached credentials.
func WaitForAuthCompletion(redirectPort int, timeout time.Duration) bool {
	start := time.Now()
	for time.Since(start) < timeout {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", redirectPort))
		if err == nil {
			// Port is free — other process finished
			ln.Close()
			return true
		}
		time.Sleep(500 * time.Millisecond)
	}
	return false
}

// --- internal helpers ---

type callbackResult struct {
	code string
	err  string
}

func createCallbackHandler(expectedState string, result *callbackResult, wg *sync.WaitGroup) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		defer wg.Done()

		q := r.URL.Query()
		if errMsg := q.Get("error"); errMsg != "" {
			result.err = q.Get("error_description")
			if result.err == "" {
				result.err = errMsg
			}
			sendCallbackHTML(w, http.StatusBadRequest, "Authentication failed")
			return
		}

		if q.Get("state") != expectedState || q.Get("code") == "" {
			result.err = "invalid state or missing code"
			sendCallbackHTML(w, http.StatusBadRequest, "Invalid response")
			return
		}

		result.code = q.Get("code")
		sendCallbackHTML(w, http.StatusOK, "Authentication successful! You can close this window.")
	})
	return mux
}

func sendCallbackHTML(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(code)
	fmt.Fprintf(w, `<html>
<head><title>Authentication</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
    <h1>%s</h1>
    <p>Return to your terminal to continue.</p>
</body>
</html>`, message)
}

func randomURLSafe(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func computeS256Challenge(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", url).Start()

	case "windows":
		// Try multiple approaches — Windows Sandbox and other locked-down
		// environments may have a severely stripped PATH.
		strategies := []struct {
			name string
			cmd  *exec.Cmd
		}{
			// 1. rundll32 via PATH (handles & in URLs safely).
			{"rundll32", exec.Command("rundll32", "url.dll,FileProtocolHandler", url)},
			// 2. rundll32 at absolute path.
			{"rundll32-abs", exec.Command(
				filepath.Join(os.Getenv("SystemRoot"), "System32", "rundll32.exe"),
				"url.dll,FileProtocolHandler", url,
			)},
			// 3. PowerShell Start-Process (works even without rundll32).
			{"powershell", exec.Command("powershell", "-NoProfile", "-Command",
				fmt.Sprintf("Start-Process '%s'", url))},
			// 4. explorer.exe as last resort.
			{"explorer", exec.Command("explorer", url)},
		}
		var lastErr error
		for _, s := range strategies {
			if err := s.cmd.Start(); err == nil {
				return nil
			} else {
				lastErr = fmt.Errorf("%s: %w", s.name, err)
			}
		}
		return lastErr

	default:
		return exec.Command("xdg-open", url).Start()
	}
}
