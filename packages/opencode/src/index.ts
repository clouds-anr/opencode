import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
import { Log } from "./util/log"
import { AuthCommand } from "./cli/cmd/auth"
import { AgentCommand } from "./cli/cmd/agent"
import { UpgradeCommand } from "./cli/cmd/upgrade"
import { UninstallCommand } from "./cli/cmd/uninstall"
import { ModelsCommand } from "./cli/cmd/models"
import { UI } from "./cli/ui"
import { Installation } from "./installation"
import { NamedError } from "@opencode-ai/util/error"
import { FormatError } from "./cli/error"
import { ServeCommand } from "./cli/cmd/serve"
import { WorkspaceServeCommand } from "./cli/cmd/workspace-serve"
import { Filesystem } from "./util/filesystem"
import { DebugCommand } from "./cli/cmd/debug"
import { StatsCommand } from "./cli/cmd/stats"
import { McpCommand } from "./cli/cmd/mcp"
import { GithubCommand } from "./cli/cmd/github"
import { ExportCommand } from "./cli/cmd/export"
import { ImportCommand } from "./cli/cmd/import"
import { AttachCommand } from "./cli/cmd/tui/attach"
import { TuiThreadCommand } from "./cli/cmd/tui/thread"
import { AcpCommand } from "./cli/cmd/acp"
import { EOL } from "os"
import { WebCommand } from "./cli/cmd/web"
import { PrCommand } from "./cli/cmd/pr"
import { SessionCommand } from "./cli/cmd/session"
import { DbCommand } from "./cli/cmd/db"
import path from "path"
import { Global } from "./global"
import { JsonMigration } from "./storage/json-migration"
import { Database } from "./storage/db"
import { 
  getValidatedANRConfig, 
  authenticateWithOIDC, 
  exchangeTokenForAWSCredentials, 
  initializeOTEL, 
  shutdownOTEL, 
  trackSessionStart, 
  trackSessionEnd,
  trackCommand,
  initializeAuditLogger,
  logAuthEvent,
  logSessionStart,
  logSessionEnd,
  checkQuota,
  type TelemetryContext 
} from "@opencode-ai/anr-core"
import { randomUUID } from "crypto"
import { platform, arch, release } from "os"

// ANR mode state (when running with OPENCODE_FLAVOR=anr)
let anrContext: {
  telemetryContext: TelemetryContext
  config: any
  sessionStartTime: number
  commandName: string
} | null = null

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
 * Build comprehensive telemetry context from OIDC token and config
 */
function buildTelemetryContext(idToken: string, config: any, sessionId: string): TelemetryContext {
  const claims = extractTokenClaims(idToken)
  const userId = claims.sub || claims.cognito_username || "unknown"

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

  // Enrich from config
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
 * Initialize ANR mode: authentication, quota, telemetry
 */
async function initializeANR(): Promise<void> {
  console.log("\n🚀 OpenCode ANR - Alaska Northstar Resources Edition\n")
  
  // Load configuration
  console.log("🔍 Loading ANR configuration...")
  const config = await getValidatedANRConfig(undefined, false)
  console.log("✅ Configuration loaded")
  console.log(`   Domain: ${config.providerDomain}`)
  console.log(`   Region: ${config.awsRegion}\n`)
  
  // Generate session ID
  const sessionId = randomUUID()
  
  // Authenticate with OIDC
  console.log("🔐 Authenticating with Cognito OIDC...")
  const tokens = await authenticateWithOIDC(config)
  console.log("✅ Authentication successful\n")
  
  // Build telemetry context
  const telemetryContext = buildTelemetryContext(tokens.idToken, config, sessionId)
  
  // Exchange token for AWS credentials
  console.log("🔄 Exchanging token for AWS credentials...")
  const awsCredentials = await exchangeTokenForAWSCredentials(tokens.idToken, config)
  console.log("✅ AWS credentials obtained\n")
  
  // Set AWS credentials in environment for model calls
  process.env.AWS_ACCESS_KEY_ID = awsCredentials.accessKeyId
  process.env.AWS_SECRET_ACCESS_KEY = awsCredentials.secretAccessKey
  process.env.AWS_SESSION_TOKEN = awsCredentials.sessionToken
  process.env.AWS_REGION = config.awsRegion
  delete process.env.AWS_PROFILE // Avoid credential conflicts
  
  // Initialize audit logging
  initializeAuditLogger(config, {
    accessKeyId: awsCredentials.accessKeyId,
    secretAccessKey: awsCredentials.secretAccessKey,
    sessionToken: awsCredentials.sessionToken,
  })
  await logAuthEvent(config, telemetryContext.userId, "success", telemetryContext)
  
  // Initialize telemetry
  if (config.enableTelemetry) {
    console.log("📊 Initializing telemetry...")
    initializeOTEL(config, telemetryContext)
    trackSessionStart(telemetryContext.userId)
    console.log("✅ Telemetry initialized\n")
  }
  await logSessionStart(config, telemetryContext.userId, telemetryContext, { sessionId })
  
  // Check quota
  console.log("🎯 Checking quota...")
  const quotaResult = await checkQuota(
    {
      userEmail: telemetryContext.userEmail || telemetryContext.userId,
      organization: telemetryContext.organization,
      teamId: telemetryContext.teamId,
    },
    config.quotaApiEndpoint,
    config.quotaFailMode,
    tokens.idToken
  )
  
  if (!quotaResult.usage.allowed) {
    console.error("❌ Quota exceeded. Access denied.")
    await logSessionEnd(config, telemetryContext.userId, 0, telemetryContext)
    if (config.enableTelemetry) {
      trackSessionEnd(telemetryContext.userId, 0)
      await shutdownOTEL()
    }
    process.exit(1)
  }
  
  console.log("✅ Quota check passed")
  if (quotaResult.usage) {
    console.log(`   Daily: ${Math.round(quotaResult.usage.dailyUsagePercent)}% (${quotaResult.usage.dailyTokens.toLocaleString()} tokens)`)
    console.log(`   Monthly: ${Math.round(quotaResult.usage.monthlyUsagePercent)}% (${quotaResult.usage.monthlyTokens.toLocaleString()} tokens)`)
  }
  console.log()
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("✅ ANR Initialization Complete")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
  
  // Store context for later use
  anrContext = {
    telemetryContext,
    config,
    sessionStartTime: Date.now(),
    commandName: process.argv[2] || "tui",
  }
  
  // Also store in global for cross-module access (logToFile happens in initializeOTEL)
  ;(global as any).__ANR_TELEMETRY_CONTEXT__ = telemetryContext
  
  // Setup exit handlers for telemetry cleanup
  const exitHandler = async () => {
    if (anrContext) {
      const duration = (Date.now() - anrContext.sessionStartTime) / 1000
      if (anrContext.config.enableTelemetry) {
        trackSessionEnd(anrContext.telemetryContext.userId, duration)
        await shutdownOTEL()
      }
      await logSessionEnd(anrContext.config, anrContext.telemetryContext.userId, duration, anrContext.telemetryContext)
    }
  }
  
  process.on("SIGINT", async () => {
    await exitHandler()
    process.exit(0)
  })
  
  process.on("SIGTERM", async () => {
    await exitHandler()
    process.exit(0)
  })
  
  process.on("exit", () => {
    // Synchronous cleanup only
  })
}

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
  })
})

/**
 * Main CLI function
 * Pass argv to test/override, or undefined to use process.argv
 */
export async function main(argv?: string[]) {
  // Check if running in ANR mode
  const anrMode = process.env.OPENCODE_FLAVOR === "anr" && !process.argv.includes("--help") && !process.argv.includes("--version")
  
  if (anrMode) {
    await initializeANR()
  }

  let cli = yargs(argv ?? hideBin(process.argv))
    .parserConfiguration({ "populate--": true })
    .scriptName("opencode")
    .wrap(100)
    .help("help", "show help")
    .alias("help", "h")
    .version("version", "show version number", Installation.VERSION)
    .alias("version", "v")
    .option("print-logs", {
      describe: "print logs to stderr",
      type: "boolean",
    })
    .option("log-level", {
      describe: "log level",
      type: "string",
      choices: ["DEBUG", "INFO", "WARN", "ERROR"],
    })
    .middleware(async (opts) => {
      await Log.init({
        print: process.argv.includes("--print-logs"),
        dev: Installation.isLocal(),
        level: (() => {
          if (opts.logLevel) return opts.logLevel as Log.Level
          if (Installation.isLocal()) return "DEBUG"
          return "INFO"
        })(),
      })

      process.env.AGENT = "1"
      process.env.OPENCODE = "1"
      process.env.OPENCODE_PID = String(process.pid)

      Log.Default.info("opencode", {
        version: Installation.VERSION,
        args: process.argv.slice(2),
      })

      const marker = path.join(Global.Path.data, "opencode.db")
      if (!(await Filesystem.exists(marker))) {
        const tty = process.stderr.isTTY
        process.stderr.write("Performing one time database migration, may take a few minutes..." + EOL)
        const width = 36
        const orange = "\x1b[38;5;214m"
        const muted = "\x1b[0;2m"
        const reset = "\x1b[0m"
        let last = -1
        if (tty) process.stderr.write("\x1b[?25l")
        try {
          await JsonMigration.run(Database.Client().$client, {
            progress: (event) => {
              const percent = Math.floor((event.current / event.total) * 100)
              if (percent === last && event.current !== event.total) return
              last = percent
              if (tty) {
                const fill = Math.round((percent / 100) * width)
                const bar = `${"■".repeat(fill)}${"･".repeat(width - fill)}`
                process.stderr.write(
                  `\r${orange}${bar} ${percent.toString().padStart(3)}%${reset} ${muted}${event.label.padEnd(12)} ${event.current}/${event.total}${reset}`,
                )
                if (event.current === event.total) process.stderr.write("\n")
              } else {
                process.stderr.write(`sqlite-migration:${percent}${EOL}`)
              }
            },
          })
        } finally {
          if (tty) process.stderr.write("\x1b[?25h")
          else {
            process.stderr.write(`sqlite-migration:done${EOL}`)
          }
        }
        process.stderr.write("Database migration complete." + EOL)
      }
    })
    .usage("\n" + UI.logo())
    .completion("completion", "generate shell completion script")
    .command(AcpCommand)
    .command(McpCommand)
    .command(TuiThreadCommand)
    .command(AttachCommand)
    .command(RunCommand)
    .command(GenerateCommand)
    .command(DebugCommand)
    .command(AuthCommand)
    .command(AgentCommand)
    .command(UpgradeCommand)
    .command(UninstallCommand)
    .command(ServeCommand)
    .command(WebCommand)
    .command(ModelsCommand)
    .command(StatsCommand)
    .command(ExportCommand)
    .command(ImportCommand)
    .command(GithubCommand)
    .command(PrCommand)
    .command(SessionCommand)
    .command(DbCommand)

  if (Installation.isLocal()) {
    cli = cli.command(WorkspaceServeCommand)
  }

  cli = cli
    .fail((msg, err) => {
      if (
        msg?.startsWith("Unknown argument") ||
        msg?.startsWith("Not enough non-option arguments") ||
        msg?.startsWith("Invalid values:")
      ) {
        if (err) throw err
        cli.showHelp("log")
      }
      if (err) throw err
      process.exit(1)
    })
    .strict()

  try {
    await cli.parse()
  } catch (e) {
    let data: Record<string, any> = {}
    if (e instanceof NamedError) {
      const obj = e.toObject()
      Object.assign(data, {
        ...obj.data,
      })
    }

    if (e instanceof Error) {
      Object.assign(data, {
        name: e.name,
        message: e.message,
        cause: e.cause?.toString(),
        stack: e.stack,
      })
    }

    if (e instanceof ResolveMessage) {
      Object.assign(data, {
        name: e.name,
        message: e.message,
        code: e.code,
        specifier: e.specifier,
        referrer: e.referrer,
        position: e.position,
        importKind: e.importKind,
      })
    }
    Log.Default.error("fatal", data)
    const formatted = FormatError(e)
    if (formatted) UI.error(formatted)
    if (formatted === undefined) {
      UI.error("Unexpected error, check log file at " + Log.file() + " for more details" + EOL)
      process.stderr.write((e instanceof Error ? e.message : String(e)) + EOL)
    }
    process.exitCode = 1
  } finally {
    // Flush telemetry metrics with a timeout to prevent hanging
    try {
      const shutdownPromise = shutdownOTEL()
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2000))
      await Promise.race([shutdownPromise, timeoutPromise])
    } catch {
      // Silently fail if shutdown has issues, don't block exit
    }
    
    // Some subprocesses don't react properly to SIGTERM and similar signals.
    // Most notably, some docker-container-based MCP servers don't handle such signals unless
    // run using `docker run --init`.
    // Explicitly exit to avoid any hanging subprocesses.
    process.exit()
  }
}

// If run directly (not imported), execute main
if (import.meta.main) {
  main()
}
