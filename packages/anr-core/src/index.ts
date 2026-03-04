/**
 * ANR Core - Shared ANR functionality for CLI, Desktop, and Web
 * Exports configuration, authentication, telemetry, and middleware
 */

// Configuration
export { type ANRConfig, defaultConfig } from "./config/types"
export { loadANRConfig, getValidatedANRConfig, validateANRConfig } from "./config/env-loader"

// Authentication
export { authenticateWithOIDC, type OIDCTokens } from "./integrations/oidc-auth"
export { exchangeTokenForAWSCredentials } from "./integrations/aws-federation"
export { authenticateWithCognito, areCredentialsExpired, ensureValidCredentials, setAWSCredentialsEnv, type CognitoCredentials } from "./integrations/cognito-sso"

// Telemetry & Observability
export { 
  initializeOTEL, 
  shutdownOTEL, 
  registerOTELShutdownHandlers,
  getMeter,
  trackCommand,
  trackModelCall,
  trackSessionStart,
  trackSessionEnd,
  getTelemetryContext,
  type TelemetryContext,
} from "./integrations/otel"

export { reconstructTelemetryContextFromEnv, isUnderANRWrapper } from "./integrations/env-telemetry"

// Quota
export { checkQuota, getWarningColor, type QuotaPolicy, type QuotaUsage, type QuotaCheckRequest, type QuotaCheckResponse } from "./integrations/quota"

// Middleware
export { initializeAuditLogger, logAuditEvent, logAuthEvent, logSessionStart, logSessionEnd, logCommandExecution, logTokenUsage, logAPICall, logQuotaCheck, type AuditEvent } from "./middleware/audit-logger"
export { detectDependenciesFromCode, checkInstalledDependencies, getMissingDependencies, generateInstallCommand, type Dependency } from "./middleware/dependency-detector"
