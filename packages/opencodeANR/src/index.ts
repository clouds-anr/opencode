/**
 * OpenCode ANR - Alaska Northstar Resources Edition
 * 
 * Standalone distribution of OpenCode with automatic AWS Cognito OIDC authentication.
 */

import { getValidatedANRConfig } from "./config/env-loader"
import { authenticateWithOIDC } from "./integrations/oidc-auth"
import { exchangeTokenForAWSCredentials } from "./integrations/aws-federation"

/**
 * Main entry point - authenticate then launch OpenCode CLI
 */
async function main() {
  // Import OpenCode CLI function at runtime using workspace module resolution
  const { main: opencodeCLI } = await import("opencode")
  try {
    // Check if this is an info-only flag (--help, --version)
    const args = process.argv.slice(2)
    const isInfoFlag = args.includes("--help") || args.includes("-h") || 
                       args.includes("--version") || args.includes("-v")
    
    // Try to load ANR configuration
    if (!isInfoFlag) {
      console.log("🔍 Checking for ANR configuration...")
    }
    
    const config = await getValidatedANRConfig(undefined, isInfoFlag)
    let tokens
    let awsCredentials
    
    if (!isInfoFlag) {
      console.log("✅ ANR configuration found")
      console.log(`   Domain: ${config.providerDomain}`)
      console.log(`   Client: ${config.clientId.substring(0, 10)}...`)
      console.log()
      
      // Authenticate with OIDC (will open browser for login)
      console.log("🔐 Authenticating with Cognito OIDC...")
      tokens = await authenticateWithOIDC(config)
      
      console.log("✅ OIDC authentication successful")
      console.log()
      
      // Exchange Cognito token for AWS credentials
      console.log("🔄 Exchanging token for AWS credentials...")
      awsCredentials = await exchangeTokenForAWSCredentials(tokens.idToken, config)
      
      console.log("✅ AWS credentials obtained")
      console.log()
      
      // Determine what's being launched
      const hasCommand = args.length > 0 && !args[0].startsWith("-")
      
      // Only show TUI startup message for actual commands (not info flags)
      if (!hasCommand) {
        console.log("🚀 Starting OpenCode TUI (Terminal User Interface)...")
        console.log("   The TUI will take over your terminal in 3 seconds.")
        console.log()
        console.log("   💡 Tip: Use these commands instead for better experience:")
        console.log("      bun dev:anr run \"your message here\"")
        console.log("      bun dev:anr models")
        console.log("      bun dev:anr serve")
        console.log("      bun dev:anr --help")
        console.log()
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    } else {
      // For info flags, still authenticate but silently
      tokens = await authenticateWithOIDC(config)
      awsCredentials = await exchangeTokenForAWSCredentials(tokens.idToken, config)
    }
    
    // Set up environment with AWS credentials from Cognito token exchange
    // Copy parent env except AWS_PROFILE to avoid credential source conflicts
    const prevEnv = { ...process.env }
    
    // Set the credentials directly in process.env for the CLI to use
    process.env.OPENCODE_FLAVOR = "anr"
    process.env.AWS_ACCESS_KEY_ID = awsCredentials.accessKeyId
    process.env.AWS_SECRET_ACCESS_KEY = awsCredentials.secretAccessKey
    process.env.AWS_SESSION_TOKEN = awsCredentials.sessionToken
    process.env.AWS_REGION = config.awsRegion
    
    // Explicitly delete AWS_PROFILE to avoid credential source conflicts
    delete process.env.AWS_PROFILE
    
    // Call the OpenCode CLI directly (no subprocess spawning)
    // Pass the CLI arguments directly
    await opencodeCLI(args)
    
  } catch (error) {
    // Check if this is an info-only flag
    const args = process.argv.slice(2)
    const isInfoFlag = args.includes("--help") || args.includes("-h") || 
                       args.includes("--version") || args.includes("-v")
    
    // If no config found, run without authentication
    if (error instanceof Error && error.message.includes("configuration")) {
      if (!isInfoFlag) {
        console.log("ℹ️  No ANR configuration found, running in standard mode")
        console.log("   (Create .env.bedrock for OIDC authentication)\n")
      }
      
      // Call OpenCode CLI directly without authentication
      process.env.OPENCODE_FLAVOR = "anr"
      delete process.env.AWS_PROFILE
      
      await opencodeCLI(args)
    } else {
      // Real error
      if (!isInfoFlag) {
        console.error("❌ Authentication failed:", error instanceof Error ? error.message : error)
        console.error()
      }
      process.exit(1)
    }
  }
}

// Run main function
main()

// Export ANR-specific functionality for library usage
export * from "./config/types"
export * from "./config/env-loader"
export * from "./integrations/oidc-auth"
export * from "./integrations/aws-federation"
export * from "./integrations/otel"
export * from "./middleware/quota-policy"
export * from "./middleware/audit-logger"
export * from "./middleware/dependency-detector"
