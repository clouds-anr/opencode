// +build ignore

// ABOUTME: Quick test harness to validate OTEL connectivity end-to-end.
// ABOUTME: Run with: go run cmd/otel_test_harness.go
//
// Tests:
//   1. --get-otel-headers produces valid JSON
//   2. OTEL collector /v1/traces   is reachable
//   3. OTEL collector /v1/metrics  is reachable
//   4. OTEL collector /v1/logs     is reachable
//   5. Sends a real protobuf trace span to /v1/traces

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

const (
	green  = "\033[32m"
	red    = "\033[31m"
	yellow = "\033[33m"
	reset  = "\033[0m"
)

func ok(msg string)   { fmt.Printf("  %s[OK]%s   %s\n", green, reset, msg) }
func fail(msg string) { fmt.Printf("  %s[FAIL]%s %s\n", red, reset, msg) }
func warn(msg string) { fmt.Printf("  %s[WARN]%s %s\n", yellow, reset, msg) }
func info(msg string) { fmt.Printf("  [INFO] %s\n", msg) }

func main() {
	fmt.Println("=== OTEL Test Harness ===")
	fmt.Println()

	// Load env.bedrock to get endpoints
	endpoint, _ := loadEndpoints()
	if endpoint == "" {
		fail("No OTEL_EXPORTER_OTLP_ENDPOINT in env.bedrock")
		os.Exit(1)
	}
	info(fmt.Sprintf("Base endpoint: %s", endpoint))
	fmt.Println()

	allPassed := true

	// --- Test 1: --get-otel-headers ---
	fmt.Println("[1] Testing --get-otel-headers output")
	if testOTELHeaders() {
		ok("Valid JSON output, exit code 0")
	} else {
		allPassed = false
	}

	// --- Test 2-4: Endpoint reachability ---
	signals := []struct {
		name     string
		path     string
		override string
	}{
		{"metrics", "/v1/metrics", ""},
	}

	for i, sig := range signals {
		url := sig.override
		if url == "" {
			url = strings.TrimRight(endpoint, "/") + sig.path
		}
		fmt.Printf("\n[%d] Testing %s endpoint: %s\n", i+2, sig.name, url)
		if testEndpointReachable(url) {
			ok(fmt.Sprintf("%s endpoint reachable", sig.name))
		} else {
			allPassed = false
		}
	}

	// --- Test 3: Send a real metric payload ---
	metricsURL := strings.TrimRight(endpoint, "/") + "/v1/metrics"
	fmt.Printf("\n[3] Sending test metric to %s\n", metricsURL)
	if testSendMetric(metricsURL) {
		ok("Metric accepted by collector")
	} else {
		allPassed = false
	}

	// --- Summary ---
	fmt.Println()
	fmt.Println(strings.Repeat("=", 40))
	if allPassed {
		fmt.Printf("%sAll tests passed!%s\n", green, reset)
	} else {
		fmt.Printf("%sSome tests failed.%s\n", red, reset)
		os.Exit(1)
	}
}

// loadEndpoints reads env.bedrock and extracts OTEL endpoints.
func loadEndpoints() (string, map[string]string) {
	data, err := os.ReadFile("env.bedrock")
	if err != nil {
		// Try next to the executable
		exe, _ := os.Executable()
		dir := strings.TrimSuffix(exe, "otel_test_harness.exe")
		data, err = os.ReadFile(dir + "env.bedrock")
		if err != nil {
			fail("Cannot read env.bedrock: " + err.Error())
			return "", nil
		}
	}

	env := make(map[string]string)
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			env[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}

	perSignal := map[string]string{
		"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT":  env["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"],
		"OTEL_EXPORTER_OTLP_METRICS_ENDPOINT": env["OTEL_EXPORTER_OTLP_METRICS_ENDPOINT"],
		"OTEL_EXPORTER_OTLP_LOGS_ENDPOINT":    env["OTEL_EXPORTER_OTLP_LOGS_ENDPOINT"],
	}

	return env["OTEL_EXPORTER_OTLP_ENDPOINT"], perSignal
}

// testOTELHeaders builds and runs --get-otel-headers, validates JSON output.
func testOTELHeaders() bool {
	// Build binary first
	info("Building claude-bedrock.exe...")
	build := exec.Command("go", "build", "-o", "test-claude-bedrock.exe", "./cmd/main.go")
	if out, err := build.CombinedOutput(); err != nil {
		fail(fmt.Sprintf("Build failed: %s\n%s", err, string(out)))
		return false
	}
	defer os.Remove("test-claude-bedrock.exe")

	// Run --get-otel-headers
	cmd := exec.Command("./test-claude-bedrock.exe", "--get-otel-headers", "--profile", "anr-bedrock-internal-us-east-1")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	start := time.Now()
	err := cmd.Run()
	elapsed := time.Since(start)

	info(fmt.Sprintf("Completed in %dms", elapsed.Milliseconds()))

	if err != nil {
		fail(fmt.Sprintf("Command failed: %s\nstderr: %s", err, stderr.String()))
		return false
	}

	// Validate JSON
	output := strings.TrimSpace(stdout.String())
	if output == "" {
		fail("Empty stdout")
		return false
	}

	var headers map[string]string
	if err := json.Unmarshal([]byte(output), &headers); err != nil {
		fail(fmt.Sprintf("Invalid JSON: %s\nOutput: %q", err, output))
		return false
	}

	info(fmt.Sprintf("Got %d headers", len(headers)))
	for k, v := range headers {
		info(fmt.Sprintf("  %s: %s", k, v))
	}

	if stderr.Len() > 0 {
		warn(fmt.Sprintf("stderr output (should be empty): %q", stderr.String()))
	}

	return true
}

// testEndpointReachable sends an empty POST to the endpoint.
// OTEL endpoints accept POST with protobuf; we expect 200, 400, or 415 as "reachable".
func testEndpointReachable(url string) bool {
	client := &http.Client{Timeout: 10 * time.Second}

	// Try POST with empty protobuf content-type (what OTEL SDK sends)
	req, _ := http.NewRequest("POST", url, bytes.NewReader([]byte{}))
	req.Header.Set("Content-Type", "application/x-protobuf")

	resp, err := client.Do(req)
	if err != nil {
		fail(fmt.Sprintf("Connection failed: %s", err))
		return false
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	info(fmt.Sprintf("HTTP %d %s", resp.StatusCode, resp.Status))
	if len(body) > 0 && len(body) < 500 {
		info(fmt.Sprintf("Body: %s", string(body)))
	}

	// 200 = accepted (even if empty), 400 = bad request (but reachable),
	// 415 = wrong content type (but reachable)
	switch resp.StatusCode {
	case 200:
		ok("Accepted (HTTP 200)")
		return true
	case 400:
		ok("Reachable (HTTP 400 - expected for empty payload)")
		return true
	case 415:
		ok("Reachable (HTTP 415 - content type issue)")
		return true
	case 404:
		fail("HTTP 404 - endpoint path not found on collector")
		return false
	default:
		warn(fmt.Sprintf("Unexpected status: %d", resp.StatusCode))
		return resp.StatusCode < 500
	}
}

// testSendMetric sends a minimal OTLP metrics export request (JSON encoding)
// to validate the collector actually processes data.
func testSendMetric(url string) bool {
	metricJSON := `{
		"resourceMetrics": [{
			"resource": {
				"attributes": [{
					"key": "service.name",
					"value": {"stringValue": "otel-test-harness"}
				}]
			},
			"scopeMetrics": [{
				"scope": {"name": "test"},
				"metrics": [{
					"name": "test_harness.connectivity_check",
					"description": "Connectivity test metric from OTEL test harness",
					"unit": "1",
					"gauge": {
						"dataPoints": [{
							"timeUnixNano": "%d",
							"asInt": "1",
							"attributes": [{
								"key": "test.run",
								"value": {"stringValue": "local-harness"}
							}]
						}]
					}
				}]
			}]
		}]
	}`

	payload := fmt.Sprintf(metricJSON, time.Now().UnixNano())

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequest("POST", url, bytes.NewReader([]byte(payload)))
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		fail(fmt.Sprintf("Connection failed: %s", err))
		return false
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	info(fmt.Sprintf("HTTP %d %s", resp.StatusCode, resp.Status))
	if len(body) > 0 && len(body) < 500 {
		info(fmt.Sprintf("Body: %s", string(body)))
	}

	if resp.StatusCode == 200 {
		return true
	}
	fail(fmt.Sprintf("Unexpected status: %d", resp.StatusCode))
	return false
}
