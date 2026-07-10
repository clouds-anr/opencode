/**
 * ANR boot sequence for the Electron desktop sidecar.
 *
 * This module is intentionally free of CLI/TUI imports (no yargs, no @opentui,
 * no TUI commands) so it can be included in the node bundle (src/node.ts)
 * without pulling in browser-only code.
 *
 * Logic mirrors main() in src/index.ts — the desktop sidecar skips main()
 * entirely and calls Server.listen() directly, so we must run the ANR boot
 * sequence here before the server starts.
 */

import { existsSync, readdirSync, readFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { platform, arch, release } from "os"
import { randomUUID } from "crypto"
import {
  getValidatedANRConfig,
  authenticateWithOIDC,
  refreshOIDCTokens,
  exchangeTokenForAWSCredentials,
  parseANRAuthMode,
  resolveTokenModeCredentials,
  initializeOTEL,
  shutdownOTEL,
  trackSessionStart,
  trackSessionEnd,
  clearOTELLogs,
  initializeAuditLogger,
  logAuthEvent,
  logSessionStart,
  logSessionEnd,
  logQuotaCheck,
  checkQuota,
  findEnvFiles,
  saveLastEnv,
  getLastEnv,
  clearStaleEnv,
  type TelemetryContext,
} from "@opencode-ai/anr-core"
import * as ANRRefresh from "./auth/anr-refresh"

export { clearStaleEnv }

const ANR_MARKERS = ["OPENCODE_API_ENDPOINT", "PROVIDER_DOMAIN", "IDENTITY_POOL_ID"]

export function detectANR(): boolean {
  if (process.env.OPENCODE_FLAVOR === "anr") return true
  const home = process.env.HOME || process.env.USERPROFILE
  if (!home) return false
  const globalDir =
    process.platform === "win32"
      ? path.resolve(process.env.PROGRAMDATA || "C:\\ProgramData", "opencode")
      : "/etc/opencode"
  const parts = fileURLToPath(import.meta.url).split(path.sep + "src" + path.sep)
  const pkg = parts.length > 1 ? parts[0] : undefined
  const root = pkg ? path.resolve(pkg, "../..") : undefined
  const dirs = [
    path.join(process.cwd(), ".opencode"),
    ...(root && root !== process.cwd() ? [path.join(root, ".opencode")] : []),
    path.join(home, ".opencode"),
    globalDir,
  ]
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (name !== ".env" && !name.startsWith(".env.")) continue
      try {
        const content = readFileSync(path.join(dir, name), "utf-8")
        const found = content.split("\n").some((line: string) => {
          const trimmed = line.trim()
          return ANR_MARKERS.some((m) => trimmed.startsWith(m))
        })
        if (found) return true
      } catch {}
    }
  }
  return false
}

export async function selectEnvFile(): Promise<string | undefined> {
  const home = process.env.HOME || process.env.USERPROFILE || "~"
  const srcParts = fileURLToPath(import.meta.url).split(path.sep + "src" + path.sep)
  const srcPkg = srcParts.length > 1 ? srcParts[0] : undefined
  const root = srcPkg ? path.resolve(srcPkg, "../..") : undefined
  const globalDir =
    process.platform === "win32"
      ? path.resolve(process.env.PROGRAMDATA || "C:\\ProgramData", "opencode")
      : "/etc/opencode"
  const dirs = [
    path.join(process.cwd(), ".opencode"),
    ...(root && root !== process.cwd() ? [path.join(root, ".opencode")] : []),
    path.resolve(home, ".opencode"),
    globalDir,
  ]

  const files = findEnvFiles(dirs)

  // If last-used env file still exists, prefer it directly — avoids cwd
  // resolution issues when running from within the Electron sidecar process.
  const last = getLastEnv()
  if (last && existsSync(last)) {
    // Make sure it's in the discovered list so non-interactive path still works
    const inList = files.some((f) => f.path === last)
    if (!inList) return last
  }

  if (files.length === 0) return undefined
  if (files.length === 1) {
    saveLastEnv(files[0].path)
    return files[0].path
  }

  const lastIdx = last ? files.findIndex((f) => f.path === last) : -1

  // Non-interactive: use last or first (desktop sidecar has no TTY)
  if (!process.stderr.isTTY) {
    const idx = lastIdx >= 0 ? lastIdx : 0
    return files[idx]?.path
  }

  process.stderr.write("\nSelect environment:\n")
  for (let i = 0; i < files.length; i++) {
    const marker = i === lastIdx ? " (last used)" : ""
    process.stderr.write(`  ${i + 1}. ${files[i]?.display ?? files[i]?.name}${marker}\n`)
  }

  const rl = await import("readline")
  const prompt = rl.createInterface({ input: process.stdin, output: process.stderr })
  const dflt = lastIdx >= 0 ? lastIdx + 1 : 1
  const answer = await new Promise<string>((ok) => {
    prompt.question(`Choice [${dflt}]: `, (a) => {
      prompt.close()
      ok(a.trim())
    })
  })

  const choice = answer === "" ? dflt : parseInt(answer, 10)
  if (Number.isNaN(choice) || choice < 1 || choice > files.length) {
    process.stderr.write("Invalid selection, using default.\n")
    return files[dflt - 1]?.path
  }

  const selected = files[choice - 1]?.path
  if (selected) saveLastEnv(selected)
  return selected
}

export async function initializeANR(envFile?: string): Promise<void> {
  clearOTELLogs()

  console.error("\n🚀 OpenCode ANR\n")
  process.stderr.write("")

  const config = await getValidatedANRConfig(envFile, false)

  if (envFile) process.env.OPENCODE_ANR_ENV_FILE = envFile

  const sessionId = randomUUID()

  // Authenticate — branch on auth mode
  const authMode = parseANRAuthMode(process.env)
  console.error(`🔐 Authenticating... (mode: ${authMode})`)

  let tokens: { idToken: string; accessToken: string; refreshToken?: string; expiresIn?: number }
  let awsCredentials: Awaited<ReturnType<typeof exchangeTokenForAWSCredentials>>
  let credentialSource: "interactive" | "static" | "exchange" = "interactive"

  if (authMode === "token") {
    let result
    try {
      result = await resolveTokenModeCredentials(config, process.env)
    } catch (err) {
      console.error("❌ Token auth failed:", err instanceof Error ? err.message : err)
      process.exit(1)
    }
    tokens = { idToken: result.idToken, accessToken: "", refreshToken: result.refreshToken }
    awsCredentials = result.awsCredentials
    credentialSource = result.credentialSource
    console.error(`✅ Token auth resolved (source: ${credentialSource})`)
    console.error(`   - idToken length: ${tokens.idToken?.length || 0}`)
    console.error(`   - refreshToken: ${tokens.refreshToken ? "present" : "not provided"}`)
  } else {
    let oidcTokens
    try {
      oidcTokens = await authenticateWithOIDC(config)
    } catch (err) {
      console.error("❌ Authentication failed:", err instanceof Error ? err.message : err)
      process.exit(1)
    }
    tokens = oidcTokens
    console.error("✅ Authenticated")
    console.error(`   - idToken length: ${tokens.idToken?.length || 0}`)
    console.error(`   - refreshToken: ${tokens.refreshToken ? "present" : "not provided"}`)

    try {
      awsCredentials = await exchangeTokenForAWSCredentials(tokens.idToken, config)
    } catch (err) {
      console.error("❌ AWS credential exchange failed:", err instanceof Error ? err.message : err)
      process.exit(1)
    }
    console.error("✅ AWS credentials obtained")
  }

  const telemetryContext = buildTelemetryContext(tokens.idToken, config, sessionId)

  process.env.AWS_ACCESS_KEY_ID = awsCredentials.accessKeyId
  process.env.AWS_SECRET_ACCESS_KEY = awsCredentials.secretAccessKey
  process.env.AWS_SESSION_TOKEN = awsCredentials.sessionToken
  process.env.AWS_REGION = config.awsRegion
  delete process.env.AWS_PROFILE

  if (awsCredentials.expiration) {
    const minutesUntilExpiry = Math.round((awsCredentials.expiration.getTime() - Date.now()) / 60000)
    console.error(`🔄 Credentials expire in ${minutesUntilExpiry} min`)
  }

  let currentRefreshToken = tokens.refreshToken
  ANRRefresh.init({
    stsExpiration: awsCredentials.expiration?.getTime(),
    async refresh() {
      let refreshedTokens

      if (authMode === "token") {
        // Token mode: use refresh token if available; never open a browser.
        if (currentRefreshToken) {
          try {
            refreshedTokens = await refreshOIDCTokens(config, currentRefreshToken)
            console.error("🔄 [token mode] Silently refreshed OIDC tokens")
          } catch {
            console.error("❌ [token mode] Refresh token exchange failed. No interactive fallback in CI.")
            console.error("   Credentials will remain in use until STS expiry. Re-run with a fresh OPENCODE_ANR_ID_TOKEN.")
            return {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
              sessionToken: process.env.AWS_SESSION_TOKEN || "",
            }
          }
        } else {
          // No refresh token — warn once, keep using existing creds until expiry.
          console.error("⚠️  [token mode] No OPENCODE_ANR_REFRESH_TOKEN provided. Token refresh is disabled.")
          console.error("   AWS credentials will remain valid until STS expiry. No interactive fallback will occur.")
          return {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
            sessionToken: process.env.AWS_SESSION_TOKEN || "",
          }
        }
      } else {
        // Interactive mode: try silent refresh first, fall back to browser.
        if (currentRefreshToken) {
          try {
            refreshedTokens = await refreshOIDCTokens(config, currentRefreshToken)
            console.error("🔄 Silently refreshed OIDC tokens")
          } catch {
            console.error("🔄 Silent token refresh failed, opening browser for re-authentication...")
            refreshedTokens = await authenticateWithOIDC(config)
          }
        } else {
          console.error("🔄 No refresh token available, opening browser for re-authentication...")
          refreshedTokens = await authenticateWithOIDC(config)
        }
      }

      const creds = await exchangeTokenForAWSCredentials(refreshedTokens.idToken, config)
      currentRefreshToken = refreshedTokens.refreshToken ?? currentRefreshToken
      console.error("✅ AWS credentials refreshed successfully")
      return {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
        idToken: refreshedTokens.idToken,
        expiration: creds.expiration,
        refreshToken: refreshedTokens.refreshToken,
      }
    },
  })

  if (config.modelsApiEndpoint) {
    process.env.OPENCODE_API_ENDPOINT = config.modelsApiEndpoint
  }

  initializeAuditLogger(config, {
    accessKeyId: awsCredentials.accessKeyId,
    secretAccessKey: awsCredentials.secretAccessKey,
    sessionToken: awsCredentials.sessionToken,
  })
  await logAuthEvent(config, telemetryContext.userId, "success", telemetryContext)

  process.env.OPENCODE_ANR_USER_ID = telemetryContext.userId
  process.env.OPENCODE_ANR_ID_TOKEN = tokens.idToken
  if (telemetryContext.userEmail) process.env.OPENCODE_ANR_USER_EMAIL = telemetryContext.userEmail
  if (telemetryContext.userName) process.env.OPENCODE_ANR_USER_NAME = telemetryContext.userName
  if (telemetryContext.osType) process.env.OPENCODE_ANR_OS_TYPE = telemetryContext.osType
  if (telemetryContext.osVersion) process.env.OPENCODE_ANR_OS_VERSION = telemetryContext.osVersion
  if (telemetryContext.terminalType) process.env.OPENCODE_ANR_TERMINAL_TYPE = telemetryContext.terminalType
  if (telemetryContext.sessionId) process.env.OPENCODE_ANR_SESSION_ID = telemetryContext.sessionId
  if (telemetryContext.department) process.env.OPENCODE_ANR_DEPARTMENT = telemetryContext.department
  if (telemetryContext.teamId) process.env.OPENCODE_ANR_TEAM_ID = telemetryContext.teamId
  if (telemetryContext.costCenter) process.env.OPENCODE_ANR_COST_CENTER = telemetryContext.costCenter
  if (telemetryContext.manager) process.env.OPENCODE_ANR_MANAGER = telemetryContext.manager
  if (telemetryContext.role) process.env.OPENCODE_ANR_ROLE = telemetryContext.role
  if (telemetryContext.location) process.env.OPENCODE_ANR_LOCATION = telemetryContext.location
  if (telemetryContext.organization) process.env.OPENCODE_ANR_ORGANIZATION = telemetryContext.organization
  if (telemetryContext.accountId) process.env.OPENCODE_ANR_ACCOUNT_ID = telemetryContext.accountId

  if (config.enableTelemetry) {
    initializeOTEL(config, telemetryContext)
    trackSessionStart(telemetryContext.userId)
  }
  try {
    await logSessionStart(config, telemetryContext.userId, telemetryContext, { sessionId })
  } catch (err) {
    console.error("⚠️ Session logging failed:", err instanceof Error ? err.message : err)
  }

  let quotaResult
  try {
    quotaResult = await checkQuota(
      {
        userEmail: telemetryContext.userEmail || telemetryContext.userId,
        organization: telemetryContext.organization,
        teamId: telemetryContext.teamId,
      },
      config.modelsApiEndpoint,
      config.quotaFailMode,
      process.env.OPENCODE_ANR_ID_TOKEN || tokens.idToken,
    )
  } catch (err) {
    if (config.quotaFailMode === "open") {
      console.error("⚠️  Quota service unavailable — continuing with limited tracking.")
    } else {
      console.error("❌ Unable to verify quota (service unavailable). Access denied for safety.")
      process.exit(1)
    }
  }

  logQuotaCheck(config, telemetryContext.userId, !!quotaResult?.usage?.allowed, telemetryContext, {
    daily: quotaResult?.usage?.dailyUsagePercent,
    monthly: quotaResult?.usage?.monthlyUsagePercent,
  })

  if (quotaResult && !quotaResult.usage.allowed) {
    console.error("❌ Quota exceeded. Access denied.")
    await logSessionEnd(config, telemetryContext.userId, 0, telemetryContext)
    if (config.enableTelemetry) {
      trackSessionEnd(telemetryContext.userId, 0)
      await shutdownOTEL()
    }
    process.exit(1)
  }

  if (quotaResult?.usage) {
    console.error(
      `📊 Quota: ${Math.round(quotaResult.usage.dailyUsagePercent)}% daily, ${Math.round(quotaResult.usage.monthlyUsagePercent)}% monthly`,
    )
    process.env.OPENCODE_ANR_QUOTA_DAILY_TOKENS = String(quotaResult.usage.dailyTokens)
    process.env.OPENCODE_ANR_QUOTA_MONTHLY_TOKENS = String(quotaResult.usage.monthlyTokens)
    process.env.OPENCODE_ANR_QUOTA_DAILY_LIMIT = String(quotaResult.policy.dailyTokenLimit)
    process.env.OPENCODE_ANR_QUOTA_MONTHLY_LIMIT = String(quotaResult.policy.monthlyTokenLimit)
    process.env.OPENCODE_ANR_QUOTA_DAILY_PERCENT = String(quotaResult.usage.dailyUsagePercent)
    process.env.OPENCODE_ANR_QUOTA_MONTHLY_PERCENT = String(quotaResult.usage.monthlyUsagePercent)
    process.env.OPENCODE_ANR_QUOTA_WARNING_LEVEL = quotaResult.usage.warningLevel
    process.env.OPENCODE_ANR_QUOTA_ALLOWED = String(quotaResult.usage.allowed)
    process.env.OPENCODE_ANR_USER_EMAIL = telemetryContext.userEmail || telemetryContext.userId
  }

  ;(global as any).__ANR_TELEMETRY_CONTEXT__ = telemetryContext

  const exitHandler = async () => {
    const duration = (Date.now() - Date.now()) / 1000
    if (config.enableTelemetry) {
      trackSessionEnd(telemetryContext.userId, duration)
      await shutdownOTEL()
    }
    await logSessionEnd(config, telemetryContext.userId, duration, telemetryContext)
  }

  process.on("SIGINT", async () => {
    await exitHandler()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    await exitHandler()
    process.exit(0)
  })
}

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

function extractTokenClaims(idToken: string): Record<string, any> {
  const parts = idToken.split(".")
  if (parts.length !== 3) return {}
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString())
  } catch {
    return {}
  }
}

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
    department: claims["custom:department"],
    costCenter: claims["custom:cost_center"],
  }

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
