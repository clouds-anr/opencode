/**
 * Environment configuration loader for ANR OpenCode
 * Parses .env files matching the Go wrapper format
 */

import { existsSync } from "fs"
import { resolve } from "path"
import type { ANRConfig } from "./types"
import { defaultConfig } from "./types"

/**
 * Load environment variables from .env file or process.env
 */
export async function loadANRConfig(envPath?: string, quiet = false): Promise<ANRConfig> {
  // If a specific env file is provided, load it
  if (envPath) {
    const resolved = resolve(envPath)
    if (existsSync(resolved)) {
      await loadEnvFile(resolved)
    } else if (!quiet) {
      console.warn(`ANR config file not found: ${resolved}`)
    }
  } else {
    // Try to load from default locations
    const cwd = process.cwd()
    const configHome = resolve(process.env.HOME || process.env.USERPROFILE || "~", ".config", "opencode-anr")
    const npmPkgJson = process.env.npm_package_json
    const rootPath = npmPkgJson ? resolve(npmPkgJson, "..") : import.meta.url.replace("file://", "").split("/src/")[0] || process.cwd()
    const packageDir = resolve(rootPath || process.cwd())
    
    // Search for .env or .env.* files in multiple locations
    const searchPaths = [cwd, packageDir, configHome]
    let loaded = false

    for (const dir of searchPaths) {
      if (!existsSync(dir)) continue

      const { readdirSync } = await import("fs")
      const files = readdirSync(dir)
      
      // Look for .env or .env.* files
      const envFiles = files.filter(f => f === ".env" || f.startsWith(".env."))
      
      if (envFiles.length > 0 && envFiles[0]) {
        // Use the first match
        const envFile = resolve(dir, envFiles[0])
        if (!quiet) console.log(`📄 Loading config from: ${envFile}`)
        await loadEnvFile(envFile)
        loaded = true
        break
      }
    }

    if (!loaded && !quiet) {
      console.log("⚠️  No .env file found, using environment variables only")
    }
  }

  // Parse environment variables into config object
  return parseEnvConfig(quiet)
}

/**
 * Load environment variables from a file into process.env
 */
async function loadEnvFile(path: string): Promise<void> {
  try {
    const file = Bun.file(path)
    const text = await file.text()
    
    const lines = text.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) continue

      const [key, ...valueParts] = trimmed.split("=")
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim()
        process.env[key.trim()] = value
      }
    }
  } catch (error) {
    console.error(`Failed to load env file: ${path}`, error)
  }
}

/**
 * Parse process.env into ANRConfig structure
 */
function parseEnvConfig(quiet = false): ANRConfig {
  const env = process.env

  return {
    // AWS & Bedrock
    awsProfile: env.AWS_PROFILE || env.OPENCODE_AWS_PROFILE || defaultConfig.awsProfile || "",
    awsRegion: env.AWS_REGION || env.OPENCODE_AWS_REGION || defaultConfig.awsRegion!,
    useBedrockProvider: env.CLAUDE_CODE_USE_BEDROCK === "1",
    anthropicModel: env.ANTHROPIC_MODEL || "",
    anthropicSmallFastModel: env.ANTHROPIC_SMALL_FAST_MODEL || "",

    // Telemetry
    enableTelemetry: env.OPENCODE_ENABLE_TELEMETRY === "1" || env.CLAUDE_CODE_ENABLE_TELEMETRY === "1",
    enableAudit: env.OPENCODE_ENABLE_AUDIT !== "0", // enabled by default unless explicitly disabled
    otelMetricsExporter: env.OTEL_METRICS_EXPORTER || defaultConfig.otelMetricsExporter!,
    otelProtocol: env.OTEL_EXPORTER_OTLP_PROTOCOL || defaultConfig.otelProtocol!,
    otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || "",
    metricsBatchSize: parseInt(env.OPENCODE_METRICS_BATCH_SIZE || String(defaultConfig.metricsBatchSize), 10),
    metricsIntervalSeconds: parseInt(env.OPENCODE_METRICS_INTERVAL_SECONDS || String(defaultConfig.metricsIntervalSeconds), 10),

    // Audit & Compliance
    auditTableName: env.AUDIT_TABLE_NAME || "",

    // Quota & Policy
    quotaApiEndpoint: env.QUOTA_API_ENDPOINT || "",
    quotaFailMode: (env.QUOTA_FAIL_MODE as "open" | "closed") || defaultConfig.quotaFailMode!,
    quotaCheckInterval: env.OPENCODE_QUOTA_CHECK_INTERVAL === "PROMPT" 
      ? "PROMPT" 
      : parseInt(env.OPENCODE_QUOTA_CHECK_INTERVAL || String(defaultConfig.quotaCheckInterval), 10),

    // AWS Cognito SSO
    providerDomain: env.PROVIDER_DOMAIN || "",
    clientId: env.CLIENT_ID || "",
    awsRegionProfile: env.AWS_REGION_PROFILE || env.AWS_REGION || defaultConfig.awsRegion!,
    providerType: "cognito",
    credentialStorage: (env.CREDENTIAL_STORAGE as "session" | "persistent") || defaultConfig.credentialStorage!,
    crossRegionProfile: env.CROSS_REGION_PROFILE || "",
    identityPoolId: env.IDENTITY_POOL_ID || "",
    federationType: "cognito",
    cognitoUserPoolId: env.COGNITO_USER_POOL_ID || "",

    // Optional installer URLs
    installerUrlClaude: env.INSTALLER_URL_CLAUDE,
    installerUrlGit: env.INSTALLER_URL_GIT,
  }
}

/**
 * Validate that required configuration is present
 */
export function validateANRConfig(config: ANRConfig): string[] {
  const errors: string[] = []

  // Only require AWS config for Phase 1 (authentication)
  if (!config.awsProfile) errors.push("AWS_PROFILE or OPENCODE_AWS_PROFILE is required")
  if (!config.awsRegion) errors.push("AWS_REGION or OPENCODE_AWS_REGION is required")

  return errors
}

/**
 * Get configuration with validation
 */
export async function getValidatedANRConfig(envPath?: string, quiet = false): Promise<ANRConfig> {
  const config = await loadANRConfig(envPath, quiet)
  const errors = validateANRConfig(config)

  if (errors.length > 0) {
    if (!quiet) {
      console.error("❌ ANR Configuration validation failed:")
      for (const error of errors) {
        console.error(`  - ${error}`)
      }
    }
    throw new Error("Invalid ANR configuration. Please check your .env file.")
  }

  return config
}
