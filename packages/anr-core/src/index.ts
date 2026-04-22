/**
 * ANR Core - Shared ANR functionality for CLI, Desktop, and Web
 * Exports configuration, authentication, telemetry, and middleware
 */

// Configuration
export { type ANRConfig, defaultConfig } from "./config/types"
export {
  loadANRConfig,
  getValidatedANRConfig,
  validateANRConfig,
  findEnvFiles,
  saveLastEnv,
  getLastEnv,
  clearStaleEnv,
  type EnvFileInfo,
} from "./config/env-loader"

// Authentication
export { authenticateWithOIDC, refreshOIDCTokens, type OIDCTokens } from "./integrations/oidc-auth"
export { exchangeTokenForAWSCredentials } from "./integrations/aws-federation"

// Telemetry & Observability
export {
  initializeOTEL,
  flushOTEL,
  shutdownOTEL,
  registerOTELShutdownHandlers,
  getMeter,
  trackCommand,
  trackModelCall,
  trackSessionStart,
  trackSessionEnd,
  trackLinesOfCode,
  trackCodeEditTool,
  trackCodeEditDecision,
  trackCommit,
  trackActiveTime,
  getTelemetryContext,
  getOTELLogFilePath,
  clearOTELLogs,
  getOTELDiagnostics,
  printOTELDiagnostics,
  resetOTELDiagnostics,
  getMetricsPreview,
  printMetricsPreview,
  getContextFlowDiagram,
  printContextFlowDiagram,
  getContextTraceEvents,
  type TelemetryContext,
} from "./integrations/otel"

export { reconstructTelemetryContextFromEnv, isUnderANRWrapper } from "./integrations/env-telemetry"

// Telemetry Testing
export { runOTELTestHarness, type TestHarnessResult } from "./util/otel-test-harness"

// Quota
export {
  checkQuota,
  getWarningColor,
  dailyResetInfo,
  monthlyResetInfo,
  QuotaExceededError,
  QuotaUnavailableError,
  type QuotaPolicy,
  type QuotaUsage,
  type QuotaCheckRequest,
  type QuotaCheckResponse,
} from "./integrations/quota"

// Middleware
export {
  initializeAuditLogger,
  logAuditEvent,
  logAuthEvent,
  logSessionStart,
  logSessionEnd,
  logCommandExecution,
  logTokenUsage,
  logAPICall,
  logQuotaCheck,
  type AuditEvent,
} from "./middleware/audit-logger"
export {
  detectDependenciesFromCode,
  checkInstalledDependencies,
  getMissingDependencies,
  generateInstallCommand,
  type Dependency,
} from "./middleware/dependency-detector"
