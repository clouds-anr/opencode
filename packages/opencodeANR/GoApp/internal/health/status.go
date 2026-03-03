package health

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/clouds-anr/GovClaudeClient/internal/aws"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
)

// RunHealthCheck performs connectivity diagnostics.
func RunHealthCheck(cfg *config.AppConfig) bool {
	fmt.Println("Claude Code with Bedrock - Health Check")
	fmt.Println(strings.Repeat("=", 50))
	fmt.Printf("\nProfile: %s\n", cfg.Profile.ProfileName)
	fmt.Println(strings.Repeat("-", 50))

	allOK := true
	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
		},
	}

	// 1. Cognito/OIDC endpoint
	fmt.Println("\n[1] Cognito/OIDC Endpoint")
	if domain := cfg.Profile.ProviderDomain; domain != "" {
		url := "https://" + domain + "/.well-known/openid-configuration"
		fmt.Printf("    URL: %s\n", url)
		if ok := checkHTTP(client, url); ok {
			fmt.Println("    [OK] Reachable")
		} else {
			fmt.Println("    [!!] Connection failed")
			allOK = false
		}
	} else {
		fmt.Println("    [SKIP] No provider_domain configured")
	}

	// 2. OTEL endpoint
	fmt.Println("\n[2] OTEL Collector Endpoint")
	if endpoint := cfg.ClaudeEnv.OTELExporterEndpoint; endpoint != "" {
		fmt.Printf("    URL: %s\n", endpoint)
		if ok := checkHTTP(client, endpoint); ok {
			fmt.Println("    [OK] Reachable")
		} else {
			fmt.Println("    [!!] Connection failed")
			allOK = false
		}
	} else {
		fmt.Println("    [SKIP] No OTEL endpoint configured (telemetry disabled)")
	}

	// 3. Bedrock endpoint
	region := cfg.ClaudeEnv.AWSRegion
	if region == "" {
		region = "us-east-1"
	}
	bedrockURL := fmt.Sprintf("https://bedrock-runtime.%s.amazonaws.com", region)
	fmt.Println("\n[3] Bedrock Runtime Endpoint")
	fmt.Printf("    URL: %s\n", bedrockURL)
	if ok := checkHTTP(client, bedrockURL); ok {
		fmt.Println("    [OK] Reachable")
	} else {
		fmt.Println("    [!!] Connection failed")
		allOK = false
	}

	// 4. Cached credentials
	fmt.Println("\n[4] AWS Credentials")
	if cached, err := aws.GetCachedCredentials(&cfg.Profile); err == nil && cached != nil {
		fmt.Printf("    [OK] Cached credentials found (expires: %s)\n", cached.Expiration)
	} else {
		fmt.Println("    [INFO] No cached credentials (will authenticate on launch)")
	}

	// 5. Dependencies
	fmt.Println("\n[5] Dependencies")
	checkDep("Claude Code", "claude")
	checkDep("Git", "git")

	// Summary
	fmt.Println("\n" + strings.Repeat("=", 50))
	if allOK {
		fmt.Println("Health check: ALL PASSED")
	} else {
		fmt.Println("Health check: SOME ISSUES DETECTED")
	}
	return allOK
}

// PrintVersionInfo prints version information for all components.
func PrintVersionInfo(launcherVersion string) {
	fmt.Println("Claude Code with Bedrock - Component Versions")
	fmt.Println(strings.Repeat("=", 50))
	fmt.Printf("  Launcher:     %s\n", launcherVersion)
	fmt.Printf("  Claude Code:  %s\n", getCommandVersion("claude", "--version"))
	fmt.Printf("  Node.js:      %s\n", getCommandVersion("node", "--version"))
	fmt.Printf("  AWS CLI:      %s\n", getCommandVersion("aws", "--version"))
}

func checkHTTP(client *http.Client, url string) bool {
	resp, err := client.Get(url)
	if err != nil {
		// For OTEL and Bedrock, certain HTTP errors indicate reachability
		return false
	}
	resp.Body.Close()
	// 2xx, 3xx, 4xx all indicate the endpoint is reachable
	return resp.StatusCode < 500
}

func checkDep(name, binary string) {
	if _, err := exec.LookPath(binary); err != nil {
		fmt.Printf("    [!!] %s not found\n", name)
	} else {
		fmt.Printf("    [OK] %s installed\n", name)
	}
}

func getCommandVersion(binary string, args ...string) string {
	out, err := exec.Command(binary, args...).Output()
	if err != nil {
		return "Not installed"
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) > 0 {
		return lines[0]
	}
	return "Unknown"
}
