/**
 * OTEL Test Harness
 * End-to-end test of OTEL metrics export with proper OIDC auth and AWS credentials
 */

import { loadANRConfig } from "../config/env-loader"
import type { ANRConfig } from "../config/types"
import { authenticateWithOIDC } from "../integrations/oidc-auth"
import { exchangeTokenForAWSCredentials } from "../integrations/aws-federation"
import { getTelemetryContext } from "../integrations/otel"

// Simple UUID generator
const uuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

export interface TestHarnessResult {
  success: boolean
  auth?: {
    oidcToken?: string
    tokenType?: string
    expiresIn?: number
  }
  aws?: {
    accessKeyId?: string
    secretAccessKey?: string
    sessionToken?: string
  }
  otel?: {
    endpoint?: string
    httpStatus?: number
    responseBody?: any
    requestBody?: any
    headers?: Record<string, string>
    error?: string
  }
  logs: string[]
}

const log = (msg: string, data?: any) => {
  const timestamp = new Date().toISOString()
  const line = data ? `${timestamp} ${msg}\n  ${JSON.stringify(data, null, 2)}` : `${timestamp} ${msg}`
  console.log(line)
}

export async function runOTELTestHarness(): Promise<TestHarnessResult> {
  const result: TestHarnessResult = {
    success: false,
    logs: [],
  }

  try {
    log("🔍 OTEL Test Harness Starting")
    log("═".repeat(80))

    // Step 1: Load configuration
    log("📋 Step 1: Loading ANR configuration...")
    const config = await loadANRConfig()
    if (!config) {
      throw new Error("Failed to load ANR configuration")
    }
    log("✅ Configuration loaded", {
      region: config.awsRegion,
      domain: config.providerDomain,
      otelEndpoint: config.otelEndpoint,
    })

    // Step 2: Perform OIDC Authentication
    log("\n🔐 Step 2: Performing OIDC authentication...")
    log(`📍 OIDC Domain: ${config.cognitoDomain}`)

    let oidcToken: string
    try {
      const oidcResult = await authenticateWithOIDC(config)
      oidcToken = oidcResult.idToken
      result.auth = {
        oidcToken: oidcToken.substring(0, 50) + "...",
        tokenType: "Bearer",
        expiresIn: oidcResult.expiresIn,
      }
      log("✅ OIDC authentication successful", {
        tokenLength: oidcToken.length,
        expiresIn: oidcResult.expiresIn,
      })
    } catch (error) {
      throw new Error(`OIDC auth failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Step 3: Exchange token for AWS credentials
    log("\n☁️  Step 3: Exchanging Cognito token for AWS credentials...")
    let awsCredentials: any
    try {
      awsCredentials = await exchangeTokenForAWSCredentials(config, oidcToken)
      result.aws = {
        accessKeyId: awsCredentials.accessKeyId?.substring(0, 10) + "...",
        sessionToken: awsCredentials.sessionToken?.substring(0, 30) + "...",
      }
      log("✅ AWS credentials obtained", {
        accessKey: result.aws.accessKeyId,
        hasSessionToken: !!awsCredentials.sessionToken,
      })
    } catch (error) {
      throw new Error(`AWS credential exchange failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Step 4: Prepare OTEL metrics payload
    log("\n📊 Step 4: Preparing OTEL metrics payload...")
    const context = getTelemetryContext()
    const metricsPayload = buildOTELMetricsPayload(config, context)
    log("✅ Metrics payload prepared", {
      payloadSize: JSON.stringify(metricsPayload).length,
      resourceMetrics: metricsPayload.resourceMetrics?.length,
    })
    result.otel = {
      requestBody: metricsPayload,
      endpoint: `${config.otelEndpoint}/v1/metrics`,
    }

    // Step 5: Send OTEL metrics with AWS credentials
    log("\n📤 Step 5: Sending OTEL metrics to endpoint...")
    log(`🌐 Endpoint: ${config.otelEndpoint}/v1/metrics`)

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "opencode-otel-test-harness/1.0",
      // Include AWS credentials as headers (not signed - this is test mode)
      "x-aws-access-key-id": awsCredentials.accessKeyId,
      "x-aws-session-token": awsCredentials.sessionToken,
    }

    if (context.userEmail) headers["x-user-email"] = context.userEmail
    if (context.userId) headers["x-user-id"] = context.userId

    result.otel.headers = {
      ...headers,
      "x-aws-access-key-id": headers["x-aws-access-key-id"]?.substring(0, 10) + "...",
      "x-aws-session-token": headers["x-aws-session-token"]?.substring(0, 30) + "...",
    }

    try {
      const response = await fetch(`${config.otelEndpoint}/v1/metrics`, {
        method: "POST",
        headers,
        body: JSON.stringify(metricsPayload),
      })

      result.otel.httpStatus = response.status
      const responseBody = await response.text()
      result.otel.responseBody = responseBody ? JSON.parse(responseBody) : null

      if (response.ok) {
        log(`✅ OTEL metrics accepted: ${response.status} ${response.statusText}`, {
          responseBody: result.otel.responseBody,
        })
        result.success = true
      } else {
        log(`❌ OTEL endpoint error: ${response.status} ${response.statusText}`, {
          responseBody: result.otel.responseBody,
        })
        result.otel.error = `HTTP ${response.status}: ${responseBody}`
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      log(`❌ Network error sending OTEL metrics: ${errorMsg}`)
      result.otel.error = errorMsg
    }

    log("\n" + "═".repeat(80))
    log("🏁 Test Harness Complete")
    log(
      `Result: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`,
      result
    )

    return result
  } catch (error) {
    log(`\n❌ Test harness failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      log("Stack:", error.stack)
    }
    return result
  }
}

/**
 * Build OTEL metrics payload in proper format
 */
function buildOTELMetricsPayload(config: ANRConfig, context: any) {
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "opencode-anr" } },
            { key: "telemetry.sdk.language", value: { stringValue: "nodejs" } },
            { key: "telemetry.sdk.name", value: { stringValue: "opentelemetry" } },
            { key: "deployment.environment", value: { stringValue: config.awsRegion || "unknown" } },
            { key: "user.id", value: { stringValue: context.userId } },
            { key: "user.email", value: { stringValue: context.userEmail || "unknown" } },
            { key: "session.id", value: { stringValue: context.sessionId } },
          ],
        },
        scopeMetrics: [
          {
            scope: {
              name: "opencode-test-harness",
              version: "1.0.0",
            },
            metrics: [
              {
                name: "claude_code.test.metric",
                description: "Test metric from harness",
                unit: "1",
                sum: {
                  dataPoints: [
                    {
                      attributes: [
                        { key: "test_type", value: { stringValue: "end_to_end" } },
                        { key: "timestamp", value: { stringValue: new Date().toISOString() } },
                      ],
                      startTimeUnixNano: (Date.now() - 1000) * 1_000_000,
                      timeUnixNano: Date.now() * 1_000_000,
                      asInt: "1",
                    },
                  ],
                  aggregationTemporality: 2, // CUMULATIVE
                  isMonotonic: true,
                },
              },
            ],
          },
        ],
      },
    ],
  }
}

// Export for CLI usage
if (import.meta.main) {
  runOTELTestHarness().then((result) => {
    process.exit(result.success ? 0 : 1)
  })
}
