/**
 * OpenTelemetry Integration for ANR OpenCode
 * Sends metrics to internal OTEL collector with comprehensive context enrichment
 */

import { NodeSDK } from "@opentelemetry/sdk-node"
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { Resource } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import type { ANRConfig } from "../config/types"
import { metrics } from "@opentelemetry/api"
import { resolve } from "path"
import { appendFileSync, mkdirSync, existsSync } from "fs"

const logDir = resolve(process.env.HOME || process.env.USERPROFILE || "~", ".config", "opencode-anr", "logs")
const logFile = resolve(logDir, "otel-metrics.log")

/**
 * Log to file with timestamp
 */
function logToFile(message: string, data?: Record<string, any>): void {
  try {
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
    const timestamp = new Date().toISOString()
    const line = data ? `${timestamp} ${message}\n  ${JSON.stringify(data, null, 2)}\n` : `${timestamp} ${message}\n`
    appendFileSync(logFile, line)
  } catch {
    // Silently fail if logging fails
  }
}

export interface TelemetryContext {
  // User context (from OIDC token)
  userId: string
  userEmail?: string
  userName?: string
  
  // System context (from environment detection)
  osType?: string
  osVersion?: string
  hostArch?: string
  terminalType?: string
  sessionId?: string
  
  // Organization context (from config)
  department?: string
  teamId?: string
  costCenter?: string
  manager?: string
  role?: string
  location?: string
  organization?: string
  accountId?: string
}

let otelSDK: NodeSDK | null = null
let meterProvider: MeterProvider | null = null
let telemetryContext: TelemetryContext | null = null
let firstMetricSent = false

// Diagnostic counters
const diagnostics = {
  modelCallsTracked: 0,
  tokensTracked: 0,
  exportsAttempted: 0,
  exportsSuccessful: 0,
  contextAvailableCalls: 0,
  contextMissingCalls: 0,
}

/**
 * Get the current telemetry context (available after initializeOTEL is called)
 * Checks module variable and global fallback to handle module instance issues
 */
export function getTelemetryContext(): TelemetryContext | null {
  return telemetryContext || (global as any).__ANR_TELEMETRY_CONTEXT__ || null
}

export function initializeOTEL(config: ANRConfig, context?: TelemetryContext): void {
  if (!config.enableTelemetry) {
    logToFile("Telemetry disabled")
    return
  }

  try {
    logToFile("═══════════════════════════════════════════════════════════════════════════════")
    logToFile("🚀 OTEL INITIALIZATION START - telemetry enabled")
    logToFile("═══════════════════════════════════════════════════════════════════════════════")
    // Store context for use in metric recording
    telemetryContext = context || { userId: "unknown" }
    logToFile("📊 Telemetry context stored:", {
      userId: telemetryContext.userId,
      userEmail: telemetryContext.userEmail,
      sessionId: telemetryContext.sessionId,
      department: telemetryContext.department,
      teamId: telemetryContext.teamId,
    })
    
    // Also set global for cross-module access
    ;(global as any).__ANR_TELEMETRY_CONTEXT__ = telemetryContext
    logToFile("🌍 Global telemetry context set:", {
      globalContextSet: !!(global as any).__ANR_TELEMETRY_CONTEXT__,
      globalUserId: (global as any).__ANR_TELEMETRY_CONTEXT__?.userId,
    })

    /**
     * Telemetry Context Flow:
     * 
     * 1. ANR Wrapper extracts context from OIDC token + system detection + config
     * 2. Context passed to OpenCode as environment variables (OPENCODE_ANR_*)
     * 3. OpenCode reconstructs context from env vars
     * 4. Both wrapper and OpenCode call initializeOTEL with context
     * 5. Context converted to HTTP headers (x-user-id, x-department, etc.) in exporter
     * 6. Metrics sent to OTEL collector with headers
     * 7. OTEL collector extracts headers and adds as dimensions to CloudWatch metrics
     * 8. Quota monitor and dashboards read metrics from CloudWatch with full context
     */

    // Build resource attributes
    const resourceAttrs: Record<string, any> = {
      [ATTR_SERVICE_NAME]: "opencode-anr",
      [ATTR_SERVICE_VERSION]: "1.0.0",
      "deployment.environment": config.awsRegionProfile || "production",
      "service.region": config.awsRegion,
    }

    // Add user context
    if (telemetryContext.userId) resourceAttrs["user.id"] = telemetryContext.userId
    if (telemetryContext.userEmail) resourceAttrs["user.email"] = telemetryContext.userEmail
    if (telemetryContext.userName) resourceAttrs["user.name"] = telemetryContext.userName

    // Add system context
    if (telemetryContext.osType) resourceAttrs["os.type"] = telemetryContext.osType
    if (telemetryContext.osVersion) resourceAttrs["os.version"] = telemetryContext.osVersion
    if (telemetryContext.hostArch) resourceAttrs["host.arch"] = telemetryContext.hostArch
    if (telemetryContext.terminalType) resourceAttrs["terminal.type"] = telemetryContext.terminalType
    if (telemetryContext.sessionId) resourceAttrs["session.id"] = telemetryContext.sessionId

    // Add organization context
    if (telemetryContext.department) resourceAttrs["department"] = telemetryContext.department
    if (telemetryContext.teamId) resourceAttrs["team.id"] = telemetryContext.teamId
    if (telemetryContext.costCenter) resourceAttrs["cost_center"] = telemetryContext.costCenter
    if (telemetryContext.manager) resourceAttrs["manager"] = telemetryContext.manager
    if (telemetryContext.role) resourceAttrs["role"] = telemetryContext.role
    if (telemetryContext.location) resourceAttrs["location"] = telemetryContext.location
    if (telemetryContext.organization) resourceAttrs["organization"] = telemetryContext.organization
    if (telemetryContext.accountId) resourceAttrs["aws.account_id"] = telemetryContext.accountId

    // Add config organization context
    if (config.department) resourceAttrs["department"] = config.department
    if (config.teamId) resourceAttrs["team.id"] = config.teamId
    if (config.costCenter) resourceAttrs["cost_center"] = config.costCenter
    if (config.manager) resourceAttrs["manager"] = config.manager
    if (config.role) resourceAttrs["role"] = config.role
    if (config.location) resourceAttrs["location"] = config.location
    if (config.organization) resourceAttrs["organization"] = config.organization
    if (config.accountId) resourceAttrs["aws.account_id"] = config.accountId

    const resource = Resource.default().merge(new Resource(resourceAttrs))

    // Build HTTP headers for OTEL collector (extracted from context and sent as x-* headers)
    // The OTEL collector stack uses these headers to enrich metrics with dimensions
    const exporterHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Add context headers that OTEL collector will extract
    if (telemetryContext.userEmail) exporterHeaders["x-user-email"] = telemetryContext.userEmail
    if (telemetryContext.userId) exporterHeaders["x-user-id"] = telemetryContext.userId
    if (telemetryContext.userName) exporterHeaders["x-user-name"] = telemetryContext.userName
    if (telemetryContext.department) exporterHeaders["x-department"] = telemetryContext.department
    if (telemetryContext.teamId) exporterHeaders["x-team-id"] = telemetryContext.teamId
    if (telemetryContext.costCenter) exporterHeaders["x-cost-center"] = telemetryContext.costCenter
    if (telemetryContext.organization) exporterHeaders["x-organization"] = telemetryContext.organization
    if (telemetryContext.location) exporterHeaders["x-location"] = telemetryContext.location
    if (telemetryContext.role) exporterHeaders["x-role"] = telemetryContext.role
    if (telemetryContext.manager) exporterHeaders["x-manager"] = telemetryContext.manager

    // Add config-level context headers as fallback
    if (config.department && !exporterHeaders["x-department"]) exporterHeaders["x-department"] = config.department
    if (config.teamId && !exporterHeaders["x-team-id"]) exporterHeaders["x-team-id"] = config.teamId
    if (config.costCenter && !exporterHeaders["x-cost-center"]) exporterHeaders["x-cost-center"] = config.costCenter
    if (config.organization && !exporterHeaders["x-organization"]) exporterHeaders["x-organization"] = config.organization
    if (config.location && !exporterHeaders["x-location"]) exporterHeaders["x-location"] = config.location
    if (config.role && !exporterHeaders["x-role"]) exporterHeaders["x-role"] = config.role
    if (config.manager && !exporterHeaders["x-manager"]) exporterHeaders["x-manager"] = config.manager
    if (config.accountId && !exporterHeaders["x-account-id"]) exporterHeaders["x-account-id"] = config.accountId

    // Create metric exporter with enriched headers and AWS authentication
    // Add AWS credentials as headers if available (for ALB/API Gateway authentication)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      // If OTEL collector is behind AWS ALB/API Gateway with IAM auth, signature would be needed
      // For now, include credentials context in headers
      exporterHeaders["x-aws-access-key-id"] = process.env.AWS_ACCESS_KEY_ID
      if (process.env.AWS_SESSION_TOKEN) {
        exporterHeaders["x-aws-session-token"] = process.env.AWS_SESSION_TOKEN
      }
      logToFile("OTEL requests will include AWS credential context")
    }

    // Log all headers being sent
    logToFile(`OTEL exporter initialized with headers:`, exporterHeaders)

    // Custom fetch wrapper to log outgoing requests
    const originalFetch = global.fetch
    const loggedFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = String(url)
      if (urlStr.includes("/v1/metrics") || urlStr.includes("otel")) {
        const body = init?.body ? (typeof init.body === "string" ? init.body.length : "unknown") : 0
        logToFile(`📤 OTEL metric export`, {
          url: urlStr,
          method: init?.method || "POST",
          bodyBytes: body,
          headerCount: Object.keys(init?.headers || {}).length,
        })
      }
      
      const response = await originalFetch(url, init)
      
      if (urlStr.includes("/v1/metrics") || urlStr.includes("otel")) {
        if (response.ok) {
          logToFile(`📥 OTEL response: ${response.status} ${response.statusText}`)
        } else {
          logToFile(`❌ OTEL error: ${response.status} ${response.statusText}`, {
            url: urlStr,
            status: response.status,
          })
        }
      }
      
      return response
    }
    
    // Temporarily override global fetch for OTEL requests
    if (typeof global !== "undefined") {
      global.fetch = loggedFetch as any
    }

    const metricExporter = new OTLPMetricExporter({
      url: `${config.otelEndpoint}/v1/metrics`,
      headers: exporterHeaders,
    })
    
    // Wrap exporter export method to log calls and track diagnostics
    const originalExport = metricExporter.export.bind(metricExporter)
    metricExporter.export = function(metrics, callback) {
      const metricCount = (metrics as any).scopeMetrics?.length || 0
      diagnostics.exportsAttempted++
      logToFile(`[OTLPExporter.export] called with ${metricCount} scope metrics`)
      
      // Log full payload for debugging
      try {
        logToFile(`[OTLPExporter.payload] Full metrics payload:`, JSON.parse(JSON.stringify(metrics)))
      } catch (e) {
        logToFile(`[OTLPExporter.payload] Could not serialize metrics: ${e}`)
      }
      
      return originalExport(metrics, (error) => {
        if (!error) {
          diagnostics.exportsSuccessful++
        }
        callback?.(error)
      })
    }

    // Create metric reader with periodic export (using configured interval)
    // Use a minimum of 10 seconds for testing visibility
    const configuredInterval = config.metricsIntervalSeconds || 60
    const exportInterval = Math.max(10, configuredInterval) * 1000 // Convert to milliseconds, min 10s
    logToFile(`OTEL export interval: ${exportInterval / 1000} seconds`)
    
    // Timeout must be less than interval; scale it based on interval
    const exportTimeout = Math.max(5000, Math.min(exportInterval - 1000, 30000))
    logToFile(`Creating PeriodicExportingMetricReader with interval=${exportInterval}ms, timeout=${exportTimeout}ms`)
    
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: exportInterval,
      exportTimeoutMillis: exportTimeout,
    })
    
    logToFile(`PeriodicExportingMetricReader created successfully`)

    // Create meter provider
    meterProvider = new MeterProvider({
      resource,
      readers: [metricReader],
    })

    // Set global meter provider
    metrics.setGlobalMeterProvider(meterProvider)
    
    // Pre-register all instruments so MeterProvider knows about them
    // The SDK needs to see instruments during initialization for proper aggregation
    const meter = meterProvider.getMeter("opencode-anr")
    
    // Pre-create all instruments (SDK will cache and reuse them)
    meter.createCounter("claude_code.token.usage", {
      description: "Total tokens used in model calls",
      unit: "1",
    })
    meter.createCounter("claude_code.model.calls.count", {
      description: "Number of model API calls",
    })
    meter.createCounter("claude_code.session.started", {
      description: "Number of sessions started",
    })
    meter.createHistogram("claude_code.session.duration_seconds", {
      description: "Duration of sessions",
      unit: "s",
    })
    meter.createHistogram("claude_code.command.duration_ms", {
      description: "Duration of CLI command execution",
      unit: "ms",
    })
    meter.createCounter("claude_code.command.count", {
      description: "Number of CLI commands executed",
    })
    
    logToFile(`[Instruments] Pre-registered 6 instruments with MeterProvider`)

    logToFile(`OpenTelemetry initialized`, { endpoint: config.otelEndpoint })
  } catch (error) {
    // Silently fail if telemetry setup has issues
    if (error instanceof Error) {
      logToFile("Telemetry setup error", { error: error instanceof Error ? error.message : error })
    }
  }
}

/**
 * Get the global meter for recording metrics
 */
export function getMeter(name: string = "opencode-anr") {
  if (!meterProvider) {
    return metrics.getMeter(name)
  }
  return meterProvider.getMeter(name)
}

/**
 * Track a command execution with context
 */
export function trackCommand(commandName: string, duration: number): void {
  try {
    logToFile(`Tracking command: ${commandName}`, { duration_ms: duration })

    // Get instruments from global meter
    const meter = metrics.getMeter("opencode-anr")
    const commandDurationHistogram = meter.createHistogram("claude_code.command.duration_ms", {
      description: "Duration of CLI command execution",
      unit: "ms",
    })
    const commandCounter = meter.createCounter("claude_code.command.count", {
      description: "Number of CLI commands executed",
    })

    const attrs = telemetryContext ? {
      command: commandName,
      user_id: telemetryContext.userId,
      session_id: telemetryContext.sessionId,
      department: telemetryContext.department,
      team_id: telemetryContext.teamId,
    } : { command: commandName }

    commandDurationHistogram.record(duration, attrs)
    commandCounter.add(1, attrs)
    logToFile(`Command tracked successfully`)
  } catch (error) {
    // Silently fail if metric recording fails
  }
}

/**
 * Track a model invocation with token usage and context attributes
 * Context can be passed explicitly or will use stored context
 */
export function trackModelCall(modelId: string, inputTokens: number, outputTokens: number, context?: TelemetryContext): void {
  try {
    // Use provided context, stored context, or global context (handles module instance issues)
    const globalCtx = (global as any).__ANR_TELEMETRY_CONTEXT__
    const ctx = context || telemetryContext || globalCtx
    
    const totalTokens = inputTokens + outputTokens
    const hasContext = !!ctx
    
    // Track diagnostics
    diagnostics.modelCallsTracked++
    diagnostics.tokensTracked += totalTokens
    if (hasContext) {
      diagnostics.contextAvailableCalls++
    } else {
      diagnostics.contextMissingCalls++
    }
    
    logToFile(`Tracking model call: ${modelId}`, {
      inputTokens,
      outputTokens,
      totalTokens,
      providedContextUserId: context?.userId,
      storedContextUserId: telemetryContext?.userId,
      globalContextUserId: globalCtx?.userId,
      contextUsed: ctx?.userId,
      contextAvailable: hasContext,
      providedContext: !!context,
      storedContext: !!telemetryContext,
      globalContext: !!globalCtx,
    })

    // Get instruments from global meter
    const meter = metrics.getMeter("opencode-anr")
    const tokenCounter = meter.createCounter("claude_code.token.usage", {
      description: "Total tokens used in model calls",
      unit: "1",
    })
    const modelCallCounter = meter.createCounter("claude_code.model.calls.count", {
      description: "Number of model API calls",
    })

    const attrs = ctx ? {
      model: modelId,
      user_id: ctx.userId,
      user_email: ctx.userEmail,
      department: ctx.department,
      session_id: ctx.sessionId,
      team_id: ctx.teamId,
    } : { model: modelId }

    logToFile(`Recording metrics with attributes:`, attrs)

    // Record token usage with type dimensions
    tokenCounter.add(totalTokens, { ...attrs, type: "total" })
    tokenCounter.add(inputTokens, { ...attrs, type: "input" })
    tokenCounter.add(outputTokens, { ...attrs, type: "output" })
    
    // Record model call count
    modelCallCounter.add(1, attrs)
    logToFile(`Model call tracked successfully - recorded ${totalTokens} tokens`)
  } catch (error) {
    // Silently fail if metric recording fails
  }
}

/**
 * Track session start
 */
export function trackSessionStart(userId: string): void {
  try {
    logToFile(`Tracking session start: ${userId}`)

    // Get instrument from global meter
    const meter = metrics.getMeter("opencode-anr")
    const sessionStartCounter = meter.createCounter("claude_code.session.started", {
      description: "Number of sessions started",
    })

    const attrs = telemetryContext ? {
      user_id: userId,
      session_id: telemetryContext.sessionId,
      department: telemetryContext.department,
      team_id: telemetryContext.teamId,
      organization: telemetryContext.organization,
    } : { user_id: userId }

    sessionStartCounter.add(1, attrs)
    logToFile(`Session start tracked successfully`)
  } catch (error) {
    // Silently fail if metric recording fails
  }
}

/**
 * Track session end
 */
export function trackSessionEnd(userId: string, duration: number): void {
  try {
    logToFile(`Tracking session end: ${userId}`, { duration_seconds: duration })

    // Get instrument from global meter
    const meter = metrics.getMeter("opencode-anr")
    const sessionEndHistogram = meter.createHistogram("claude_code.session.duration_seconds", {
      description: "Duration of sessions",
      unit: "s",
    })

    const attrs = telemetryContext ? {
      user_id: userId,
      session_id: telemetryContext.sessionId,
      department: telemetryContext.department,
      team_id: telemetryContext.teamId,
      organization: telemetryContext.organization,
    } : { user_id: userId }

    sessionEndHistogram.record(duration, attrs)
    logToFile(`Session end tracked successfully`)
  } catch (error) {
    // Silently fail if metric recording fails
  }
}

/**
 * Print diagnostic summary
 */
function printDiagnosticSummary(): void {
  const ctx = getTelemetryContext()
  logToFile("═══════════════════════════════════════════════════════════════════════════════")
  logToFile("📊 DIAGNOSTIC SUMMARY")
  logToFile("═══════════════════════════════════════════════════════════════════════════════", {
    sessionId: ctx?.sessionId || "none",
    userId: ctx?.userId || "none",
    email: ctx?.userEmail || "none",
    modelCallsTracked: diagnostics.modelCallsTracked,
    tokensTracked: diagnostics.tokensTracked,
    contextAvailable: `${diagnostics.contextAvailableCalls}/${diagnostics.modelCallsTracked}`,
    contextMissing: diagnostics.contextMissingCalls > 0 ? `⚠️  ${diagnostics.contextMissingCalls}` : "✓ none",
    exportsAttempted: diagnostics.exportsAttempted,
    exportsSuccessful: diagnostics.exportsSuccessful,
  })
  logToFile("═══════════════════════════════════════════════════════════════════════════════")
}

/**
 * Shutdown OpenTelemetry gracefully
 */
export async function shutdownOTEL(): Promise<void> {
  if (meterProvider) {
    try {
      logToFile("🛑 OTEL SHUTDOWN START - Flushing metrics")
      await meterProvider.shutdown()
      logToFile("✅ OpenTelemetry shut down successfully")
      // Print diagnostic summary AFTER exports complete so counts are accurate
      printDiagnosticSummary()
      logToFile("═══════════════════════════════════════════════════════════════════════════════")
    } catch (error) {
      logToFile("Error shutting down OpenTelemetry", { error: error instanceof Error ? error.message : error })
    }
  }
}

/**
 * Register shutdown handlers
 */
export function registerOTELShutdownHandlers(): void {
  process.on("SIGTERM", async () => {
    await shutdownOTEL()
    process.exit(0)
  })

  process.on("SIGINT", async () => {
    await shutdownOTEL()
    process.exit(0)
  })
}
