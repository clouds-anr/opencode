/**
 * OpenCode ANR - Alaska Northstar Resources Edition CLI Wrapper
 * 
 * Handles authentication, telemetry, quota management, and database initialization
 * Then spawns the OpenCode CLI as a separate process with the configured environment.
 */

import { spawn } from "child_process"
import { resolve } from "path"
import { getValidatedANRConfig, authenticateWithOIDC, exchangeTokenForAWSCredentials, initializeOTEL } from "@opencode-ai/anr-core"

/**
 * Main entry point - authenticate and initialize ANR context, then spawn OpenCode CLI
 */
async function main() {
  try {
    // Resolve paths once at startup
    const workspaceRoot = resolve(__dirname, "../../..")
    const opencodePath = resolve(workspaceRoot, "packages/opencode")
    const args = process.argv.slice(2)
    const isInfoFlag = args.includes("--help") || args.includes("-h") || 
                       args.includes("--version") || args.includes("-v")
    
    // For info flags, skip auth and go straight to OpenCode
    if (isInfoFlag) {
      const env = {
        ...process.env,
        OPENCODE_FLAVOR: "anr",
      }
      delete env.AWS_PROFILE
      
      const opencode = spawn("bun", ["run", "--cwd", opencodePath, "--conditions=browser", "src/index.ts", ...args], {
        env,
        stdio: "inherit",
        cwd: workspaceRoot,
      })
      
      opencode.on("exit", (code) => {
        process.exit(code || 0)
      })
      
      opencode.on("error", (error) => {
        console.error("❌ Failed to spawn OpenCode:", error)
        process.exit(1)
      })
      
      return
    }
    
    // Try to load ANR configuration
    console.log("🔍 Checking for ANR configuration...")
    const config = await getValidatedANRConfig(undefined, false)
    
    console.log("✅ ANR configuration found")
    console.log(`   Domain: ${config.providerDomain}`)
    console.log(`   Client: ${config.clientId.substring(0, 10)}...`)
    console.log()
    
    // Set up OpenTelemetry
    if (config.enableTelemetry) {
      console.log("📊 Initializing telemetry...")
      initializeOTEL(config)
      console.log("✅ Telemetry initialized")
      console.log()
    }
    
    // Authenticate with OIDC (will open browser for login)
    console.log("🔐 Authenticating with Cognito OIDC...")
    const tokens = await authenticateWithOIDC(config)
    
    console.log("✅ OIDC authentication successful")
    console.log()
    
    // Exchange Cognito token for AWS credentials
    console.log("🔄 Exchanging token for AWS credentials...")
    const awsCredentials = await exchangeTokenForAWSCredentials(tokens.idToken, config)
    
    console.log("✅ AWS credentials obtained")
    console.log()
    
    // Determine what's being launched
    const hasCommand = args.length > 0 && !args[0].startsWith("-")
    
    // Only show TUI startup message for actual commands
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
    
    // Build environment with AWS credentials from Cognito token exchange
    const env = {
      ...process.env,
      OPENCODE_FLAVOR: "anr",
      AWS_ACCESS_KEY_ID: awsCredentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: awsCredentials.secretAccessKey,
      AWS_SESSION_TOKEN: awsCredentials.sessionToken,
      AWS_REGION: config.awsRegion,
    }
    
    // Remove AWS_PROFILE to avoid credential source conflicts
    delete env.AWS_PROFILE
    
    // Spawn OpenCode CLI as a separate process
    const opencode = spawn("bun", ["run", "--cwd", opencodePath, "--conditions=browser", "src/index.ts", ...args], {
      env,
      stdio: "inherit",
      cwd: workspaceRoot,
    })
    
    // Wait for OpenCode process to exit
    opencode.on("exit", (code) => {
      process.exit(code || 0)
    })
    
    opencode.on("error", (error) => {
      console.error("❌ Failed to spawn OpenCode:", error)
      process.exit(1)
    })
    
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
      
      // Spawn OpenCode CLI in standard mode
      const env = {
        ...process.env,
        OPENCODE_FLAVOR: "anr",
      }
      delete env.AWS_PROFILE
      
      const opencode = spawn("bun", ["run", "--cwd", opencodePath, "--conditions=browser", "src/index.ts", ...args], {
        env,
        stdio: "inherit",
        cwd: workspaceRoot,
      })
      
      opencode.on("exit", (code) => {
        process.exit(code || 0)
      })
      
      opencode.on("error", (error) => {
        console.error("❌ Failed to spawn OpenCode:", error)
        process.exit(1)
      })
    } else {
      // Real error
      if (!isInfoFlag) {
        console.error("❌ ANR initialization failed:", error instanceof Error ? error.message : error)
        console.error()
      }
      process.exit(1)
    }
  }
}

// Run main function
main()

// Export ANR core types for library usage
export * from "@opencode-ai/anr-core"
