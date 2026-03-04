/**
 * OpenCode ANR - Alaska Northstar Resources Edition CLI Wrapper
 * 
 * Handles authentication, telemetry, quota management, and database initialization
 * Then spawns the OpenCode CLI as a separate process with the configured environment.
 */

import { spawn } from "child_process"
import { resolve } from "path"
import { platform, arch, release } from "os"
import { randomUUID } from "crypto"
import { getValidatedANRConfig, authenticateWithOIDC, exchangeTokenForAWSCredentials, initializeOTEL, trackSessionStart, trackSessionEnd, trackCommand, trackModelCall, shutdownOTEL, type TelemetryContext, initializeAuditLogger, logAuthEvent, logSessionStart, logSessionEnd, logCommandExecution, checkQuota, getWarningColor, logQuotaCheck, type QuotaCheckResponse } from "@opencode-ai/anr-core"

/**
 * Detect terminal type based on environment variables
 */
function detectTerminalType(): string {
  if (process.env.WT_SESSION) return "windows-terminal"
  if (process.env.ITERM_SESSION_ID) return "iterm2"
  if (process.env.GNOME_TERMINAL_SCREEN) return "gnome-terminal"
  if (process.env.VTE_VERSION) return "vte-based"
  if (process.env.KITTY_WINDOW_ID) return "kitty"
  if (process.env.TERM_PROGRAM === "iTerm.app") return "iterm2"
  if (process.env.TERM === "screen" && process.env.TMUX) return "tmux"
  if (process.env.TERM === "screen") return "screen"
  if (process.env.WSL_DISTRO_NAME) return `wsl-${process.env.WSL_DISTRO_NAME}`
  if (process.env.WSL_INTEROP) return "wsl"
  return process.env.TERM || "unknown"
}

/**
 * Extract OIDC token claims
 */
function extractTokenClaims(idToken: string): Record<string, any> {
  const parts = idToken.split(".")
  if (parts.length !== 3) return {}
  try {
    const payload = parts[1]
    if (!payload) return {}
    return JSON.parse(Buffer.from(payload, "base64").toString())
  } catch {
    return {}
  }
}

/**
 * Build comprehensive telemetry context from all sources
 */
function buildTelemetryContext(
  idToken: string,
  config: any,
  sessionId: string
): TelemetryContext {
  // Phase 1: Extract from OIDC token
  const claims = extractTokenClaims(idToken)
  const userId = claims.sub || claims.cognito_username || "unknown"

  // Phase 2: Detect system context
  const ctx: TelemetryContext = {
    userId,
    userEmail: claims.email,
    userName: claims.name || claims.preferred_username,
    osType: platform(),
    osVersion: release(),
    hostArch: arch(),
    terminalType: detectTerminalType(),
    sessionId,
    organization: claims.organization || claims["custom:organization"],
  }

  // Phase 3: Enrich from config
  if (config.department) ctx.department = config.department
  if (config.teamId) ctx.teamId = config.teamId
  if (config.costCenter) ctx.costCenter = config.costCenter
  if (config.manager) ctx.manager = config.manager
  if (config.role) ctx.role = config.role
  if (config.location) ctx.location = config.location
  if (config.organization) ctx.organization = config.organization
  if (config.accountId) ctx.accountId = config.accountId

  return ctx
}

/**
 * Perform quota check and return environment variables
 */
async function performQuotaCheck(config: any, telemetryContext: TelemetryContext, idToken: string): Promise<Record<string, string>> {
  try {
    console.log(`📊 Checking quota for: ${telemetryContext.userEmail || telemetryContext.userId}`)
    
    const response = await checkQuota(
      {
        userEmail: telemetryContext.userEmail || telemetryContext.userId,
        organization: telemetryContext.organization,
        teamId: telemetryContext.teamId,
      },
      config.quotaApiEndpoint,
      config.quotaFailMode,
      idToken
    )

    if (!response || !response.usage) {
      console.warn("⚠️  No quota response received")
      return {}
    }

    const { usage, policy } = response
    const warningColor = getWarningColor(usage.warningLevel)

    // Log quota details
    console.log(`   Daily: ${Math.round(usage.dailyUsagePercent)}% (${usage.dailyTokens.toLocaleString()} / ${policy.dailyTokenLimit.toLocaleString()} tokens)`)
    console.log(`   Monthly: ${Math.round(usage.monthlyUsagePercent)}% (${usage.monthlyTokens.toLocaleString()} / ${policy.monthlyTokenLimit.toLocaleString()} tokens)`)
    console.log(`   Warning Level: ${usage.warningLevel}`)

    // Log quota check event
    await logQuotaCheck(config, telemetryContext.userId, usage.allowed, telemetryContext, {
      dailyUsagePercent: usage.dailyUsagePercent,
      monthlyUsagePercent: usage.monthlyUsagePercent,
      warningLevel: usage.warningLevel,
      dailyLimit: policy.dailyTokenLimit,
      monthlyLimit: policy.monthlyTokenLimit,
    })

    // If quota exceeded and fail mode is closed, print warning
    if (!usage.allowed && config.quotaFailMode === "closed") {
      console.warn(`❌ Quota exceeded: ${usage.reason}`)
      return {}
    }

    if (!usage.allowed) {
      console.warn(`⚠️  Quota check failed (fail mode: ${config.quotaFailMode}): ${usage.reason}`)
    } else {
      console.log(`✅ Quota check passed`)
    }

    return {
      OPENCODE_ANR_QUOTA_DAILY_TOKENS: String(usage.dailyTokens),
      OPENCODE_ANR_QUOTA_MONTHLY_TOKENS: String(usage.monthlyTokens),
      OPENCODE_ANR_QUOTA_DAILY_PERCENT: String(Math.round(usage.dailyUsagePercent)),
      OPENCODE_ANR_QUOTA_MONTHLY_PERCENT: String(Math.round(usage.monthlyUsagePercent)),
      OPENCODE_ANR_QUOTA_DAILY_LIMIT: String(policy.dailyTokenLimit),
      OPENCODE_ANR_QUOTA_MONTHLY_LIMIT: String(policy.monthlyTokenLimit),
      OPENCODE_ANR_QUOTA_WARNING_LEVEL: usage.warningLevel,
      OPENCODE_ANR_QUOTA_WARNING_COLOR: warningColor,
      OPENCODE_ANR_QUOTA_ALLOWED: String(usage.allowed),
    }
  } catch (error) {
    console.error("❌ Quota check failed:", error instanceof Error ? error.message : error)
    return {}
  }
}

/**
 * Setup interval-based quota checking
 */
function setupQuotaInterval(
  intervalSeconds: number,
  config: any,
  telemetryContext: TelemetryContext,
  idToken: string,
  env: Record<string, string | undefined>
): NodeJS.Timeout | null {
  if (intervalSeconds <= 0) return null

  console.log(`⏱️  Quota background refresh: every ${intervalSeconds} seconds`)

  return setInterval(async () => {
    console.log(`🔄 Refreshing quota (background check)...`)
    const quotaEnv = await performQuotaCheck(config, telemetryContext, idToken)
    // Update env vars with latest quota info
    Object.assign(env, quotaEnv)
  }, intervalSeconds * 1000)
}

async function main() {
  // Resolve paths once at startup (available to catch blocks)
  const workspaceRoot = resolve(__dirname, "../../..")
  const opencodePath = resolve(workspaceRoot, "packages/opencode")
  const args = process.argv.slice(2)
  const isInfoFlag = args.includes("--help") || args.includes("-h") || 
                     args.includes("--version") || args.includes("-v")
  
  // Log to file
  const { appendFileSync, mkdirSync, existsSync: fsExistsSync } = await import("fs")
  const logDir = resolve(process.env.HOME || process.env.USERPROFILE || "~", ".config", "opencode-anr", "logs")
  const logFile = resolve(logDir, "otel-metrics.log")
  
  function logStart(message: string) {
    try {
      if (!fsExistsSync(logDir)) {
        mkdirSync(logDir, { recursive: true })
      }
      const timestamp = new Date().toISOString()
      appendFileSync(logFile, `${timestamp} ${message}\n`)
    } catch {
      // Silently fail
    }
  }
  
  logStart("═══════════════════════════════════════════════════════════════════════════════")
  logStart("🚀 ANR WRAPPER START - Beginning authentication flow")
  logStart("═══════════════════════════════════════════════════════════════════════════════")
  
  // Override console to redirect all ANR wrapper output to log file
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  
  console.log = (...args: any[]) => {
    logStart(args.join(" "))
  }
  console.error = (...args: any[]) => {
    logStart(`ERROR: ${args.join(" ")}`)
  }
  console.warn = (...args: any[]) => {
    logStart(`WARN: ${args.join(" ")}`)
  }
  
  try {
    // For info flags, skip auth and go straight to OpenCode
    if (isInfoFlag) {
      const env = {
        ...process.env,
        OPENCODE_FLAVOR: "anr",
      } as Record<string, string | undefined>
      // Remove AWS_PROFILE to avoid credential source conflicts
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
    
    // Generate session ID for this session
    const sessionId = randomUUID()
    
    // Authenticate with OIDC (will open browser for login)
    console.log("🔐 Authenticating with Cognito OIDC...")
    const tokens = await authenticateWithOIDC(config)
    
    console.log("✅ OIDC authentication successful")
    console.log()
    
    // Build comprehensive telemetry context (all 3 phases)
    const telemetryContext = buildTelemetryContext(tokens.idToken, config, sessionId)
    
    // Exchange Cognito token for AWS credentials FIRST (before audit logging)
    console.log("🔄 Exchanging token for AWS credentials...")
    const awsCredentials = await exchangeTokenForAWSCredentials(tokens.idToken, config)
    
    console.log("✅ AWS credentials obtained")
    console.log()
    
    // NOW initialize audit logging (with AWS credentials available)
    initializeAuditLogger(config, {
      accessKeyId: awsCredentials.accessKeyId,
      secretAccessKey: awsCredentials.secretAccessKey,
      sessionToken: awsCredentials.sessionToken,
    })
    
    // Log authentication event (now we have AWS creds for DynamoDB)
    await logAuthEvent(config, telemetryContext.userId, "success", telemetryContext)
    
    // Set up OpenTelemetry with enriched context
    if (config.enableTelemetry) {
      console.log("📊 Initializing telemetry...")
      initializeOTEL(config, telemetryContext)
      console.log("✅ Telemetry initialized")
      console.log()
    }
    
    // Track and log session start
    if (config.enableTelemetry) {
      trackSessionStart(telemetryContext.userId)
    }
    await logSessionStart(config, telemetryContext.userId, telemetryContext, { sessionId })

    // Perform quota check based on interval setting
    console.log("🎯 Checking quota...")
    const quotaEnv = await performQuotaCheck(config, telemetryContext, tokens.idToken)
    
    // If PROMPT mode, check before allowing execution
    if (config.quotaCheckInterval === "PROMPT" && quotaEnv.OPENCODE_ANR_QUOTA_ALLOWED === "false") {
      console.error("❌ Quota exceeded. Access denied.")
      await logSessionEnd(config, telemetryContext.userId, 0, telemetryContext)
      process.exit(1)
    }
    
    console.log("✅ Quota check passed")
    console.log()
    
    // Setup interval-based quota checking if configured
    let quotaTimer: NodeJS.Timeout | null = null
    if (config.quotaCheckInterval !== "PROMPT" && typeof config.quotaCheckInterval === "number") {
      quotaTimer = setupQuotaInterval(config.quotaCheckInterval, config, telemetryContext, tokens.idToken, {})
    }
    
    // Determine what's being launched
    const hasCommand = args.length > 0 && args[0] && !args[0].startsWith("-")
    
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
      // Pass OTEL configuration to OpenCode so it can track with same context
      OPENCODE_ENABLE_TELEMETRY: String(config.enableTelemetry ? "1" : "0"),
      OTEL_METRICS_EXPORTER: config.otelMetricsExporter,
      OTEL_EXPORTER_OTLP_PROTOCOL: config.otelProtocol,
      OTEL_EXPORTER_OTLP_ENDPOINT: config.otelEndpoint,
      OPENCODE_METRICS_INTERVAL_SECONDS: String(config.metricsIntervalSeconds),
      OPENCODE_METRICS_BATCH_SIZE: String(config.metricsBatchSize),
      // Pass all telemetry context fields to OpenCode
      OPENCODE_ANR_USER_ID: telemetryContext.userId,
      OPENCODE_ANR_USER_EMAIL: telemetryContext.userEmail || "",
      OPENCODE_ANR_USER_NAME: telemetryContext.userName || "",
      OPENCODE_ANR_SESSION_ID: telemetryContext.sessionId,
      OPENCODE_ANR_OS_TYPE: telemetryContext.osType || "",
      OPENCODE_ANR_OS_VERSION: telemetryContext.osVersion || "",
      OPENCODE_ANR_TERMINAL_TYPE: telemetryContext.terminalType || "",
      OPENCODE_ANR_DEPARTMENT: telemetryContext.department || "",
      OPENCODE_ANR_TEAM_ID: telemetryContext.teamId || "",
      OPENCODE_ANR_COST_CENTER: telemetryContext.costCenter || "",
      OPENCODE_ANR_MANAGER: telemetryContext.manager || "",
      OPENCODE_ANR_ROLE: telemetryContext.role || "",
      OPENCODE_ANR_LOCATION: telemetryContext.location || "",
      OPENCODE_ANR_ORGANIZATION: telemetryContext.organization || "",
      OPENCODE_ANR_ACCOUNT_ID: telemetryContext.accountId || "",
      // Pass JWT token and quota API for TUI quota refresh
      OPENCODE_ANR_ID_TOKEN: tokens.idToken,
      OPENCODE_ANR_QUOTA_API_ENDPOINT: config.quotaApiEndpoint,
      OPENCODE_QUOTA_CHECK_INTERVAL: String(config.quotaCheckInterval === "PROMPT" ? 0 : config.quotaCheckInterval),
      // Add quota information
      ...quotaEnv,
    } as Record<string, string | undefined>
    
    // Remove AWS_PROFILE to avoid credential source conflicts
    delete env.AWS_PROFILE
    
    // ========== VALIDATE CLEAN STARTUP ==========
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("✅ ANR Startup Complete - All Systems Ready")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    
    // Validation checklist
    const validations = {
      "Authentication": !!tokens.idToken,
      "Telemetry": config.enableTelemetry,
      "Quota": Object.keys(quotaEnv).length > 0,
      "AWS Credentials": !!(env.AWS_ACCESS_KEY_ID && env.AWS_SESSION_TOKEN),
    }
    
    const allValid = Object.values(validations).every(v => v)
    if (!allValid) {
      console.warn("⚠️  Some systems not fully initialized:")
      Object.entries(validations).forEach(([name, valid]) => {
        console.log(`   ${valid ? "✅" : "⚠️"} ${name}`)
      })
      console.log()
    }
    
    // Required checks
    if (!tokens.idToken) {
      console.error("❌ FATAL: No authentication token. Cannot continue.")
      process.exit(1)
    }
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SESSION_TOKEN) {
      console.error("❌ FATAL: AWS credentials not obtained. Cannot continue.")
      process.exit(1)
    }
    
    console.log("🚀 Forwarding to OpenCode process...\n")
    
    // Track command execution
    const commandStartTime = Date.now()
    const commandName = hasCommand && args[0] ? args[0] : "tui"
    if (config.enableTelemetry) {
      trackCommand(commandName, 0) // Duration will be minimal at spawn time
    }
    
    // Spawn OpenCode CLI as a separate process
    const opencode = spawn("bun", ["run", "--cwd", opencodePath, "--conditions=browser", "src/index.ts", ...args], {
      env,
      stdio: "inherit",
      cwd: workspaceRoot,
    })
    
    // Wait for OpenCode process to exit
    opencode.on("exit", async (code) => {
      // Clean up quota timer
      if (quotaTimer) {
        clearInterval(quotaTimer)
      }
      
      // Track session end with duration
      const commandDuration = Date.now() - commandStartTime
      const sessionDuration = commandDuration / 1000
      
      if (config.enableTelemetry) {
        trackSessionEnd(telemetryContext.userId, sessionDuration)
        // Await shutdown to flush metrics before exiting
        await shutdownOTEL()
      }
      
      // Log command execution
      logCommandExecution(config, telemetryContext.userId, commandName, commandDuration, telemetryContext, {
        exitCode: code || 0,
      })
      
      // Log session end
      logSessionEnd(config, telemetryContext.userId, sessionDuration, telemetryContext)
      
      process.exit(code || 0)
    })
    
    opencode.on("error", async (error) => {
      // Clean up quota timer
      if (quotaTimer) {
        clearInterval(quotaTimer)
      }
      
      console.error("❌ Failed to spawn OpenCode:", error)
      if (config.enableTelemetry) {
        // Await shutdown to flush metrics before exiting
        await shutdownOTEL()
      }
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
      } as Record<string, string | undefined>
      // Remove AWS_PROFILE to avoid credential source conflicts
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
      // Await shutdown to flush metrics before exiting
      await shutdownOTEL()
      process.exit(1)
    }
  }
}

// Run main function
main()

// Export ANR core types for library usage
export * from "@opencode-ai/anr-core"
