/**
 * Demo-mode initialization without AWS authentication
 * Use this for testing without real AWS credentials
 */

import type { ANRConfig } from "./config/types"
import { getValidatedANRConfig } from "./config/env-loader"
import { initializeOTEL, registerOTELShutdownHandlers } from "./integrations/otel"
import { createQuotaMiddleware } from "./middleware/quota-policy"

export interface ANRDemoSession {
  config: ANRConfig
  userId: string
  checkQuota: ReturnType<typeof createQuotaMiddleware>
}

/**
 * Initialize ANR OpenCode in demo mode (skips AWS auth)
 */
export async function initializeANRDemo(envPath?: string): Promise<ANRDemoSession> {
  console.log("🧪 Initializing ANR OpenCode (Demo Mode - No AWS Auth)...\n")

  // Load config
  console.log("📋 Loading configuration...")
  const config = await getValidatedANRConfig(envPath)
  console.log("✅ Configuration loaded\n")

  // Initialize OpenTelemetry (if endpoint is reachable)
  console.log("📊 Initializing OpenTelemetry...")
  if (config.enableTelemetry) {
    initializeOTEL(config)
    registerOTELShutdownHandlers()
  } else {
    console.log("⏭️  Skipped (telemetry disabled)\n")
  }

  // Create quota middleware
  console.log("🎯 Creating quota middleware...")
  const checkQuota = createQuotaMiddleware(config)
  console.log("✅ Ready\n")

  const userId = process.env.USER || process.env.USERNAME || "demo-user"

  console.log("✅ ANR OpenCode (Demo Mode) initialized!")
  console.log(`   User: ${userId}`)
  console.log(`   Region: ${config.awsRegion}`)
  console.log(`   Model: ${config.anthropicModel}`)
  console.log()
  console.log("⚠️  Note: Running in demo mode")
  console.log("   - AWS Cognito: Skipped")
  console.log("   - DynamoDB Audit: Skipped")
  console.log("   - OpenTelemetry: " + (config.enableTelemetry ? "Active" : "Disabled"))
  console.log("   - Quota API: Active")
  console.log()

  return {
    config,
    userId,
    checkQuota,
  }
}

/**
 * Start ANR OpenCode in demo mode
 */
export async function startANRDemo(envPath?: string): Promise<void> {
  try {
    const session = await initializeANRDemo(envPath)

    console.log("💡 Demo mode features available:")
    console.log("   - Config loading from .env files")
    console.log("   - Quota API integration")
    console.log("   - OpenTelemetry metrics (if enabled)")
    console.log("   - Dependency detection")
    console.log()
    console.log("🔐 For full AWS integration, configure:")
    console.log("   - Cognito Identity Pool with unauthenticated access")
    console.log("   - OR provide an authenticated identity token")
    console.log("   - See README.md for details")
    console.log()

  } catch (error) {
    console.error("\n❌ Demo mode initialization failed\n")
    if (error instanceof Error) {
      console.error("Error:", error.message)
    }
    process.exit(1)
  }
}
