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
export { initializeOTEL, shutdownOTEL, registerOTELShutdownHandlers } from "./integrations/otel"

// Middleware
export { initializeAuditLogger, logAuditEvent, logSessionStart, logSessionEnd, logAPICall, logQuotaCheck, type AuditEvent } from "./middleware/audit-logger"
export { checkQuota, createQuotaMiddleware, trackUsage, QuotaExceededError, type QuotaCheckRequest, type QuotaCheckResponse } from "./middleware/quota-policy"
export { detectDependenciesFromCode, checkInstalledDependencies, getMissingDependencies, generateInstallCommand, type Dependency } from "./middleware/dependency-detector"
