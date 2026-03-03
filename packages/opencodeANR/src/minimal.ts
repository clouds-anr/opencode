/**
 * Minimal ANR initialization - just auth and config
 * Use this while debugging integration issues
 */

import { getValidatedANRConfig } from "./config/env-loader"
import { authenticateWithCognito, setAWSCredentialsEnv } from "./integrations/cognito-sso"

async function startMinimal() {
  console.log("🚀 Starting ANR OpenCode (Minimal Mode)\n")

  try {
    // Step 1: Load config
    console.log("📋 Loading configuration...")
    const config = await getValidatedANRConfig()
    console.log("✅ Config loaded")
    console.log(`   Region: ${config.awsRegion}`)
    console.log(`   Model: ${config.anthropicModel}\n`)

    // Step 2: Authenticate
    console.log("🔐 Authenticating with AWS...")
    const credentials = await authenticateWithCognito(config)
    setAWSCredentialsEnv(credentials)
    console.log("✅ Authenticated successfully\n")

    console.log("✨ Ready! AWS credentials are set in environment.")
    console.log("   You can now use AWS SDK clients with these credentials.")
    console.log()
    console.log("Credentials expire:", credentials.expiration)
    console.log()

  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  }
}

startMinimal()
