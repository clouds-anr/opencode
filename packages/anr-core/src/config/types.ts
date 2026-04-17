/**
 * ANR OpenCode Configuration Types
 * Matches the environment variable format from existing Go wrapper
 */

export interface ANRConfig {
  // AWS & Bedrock
  awsRegion: string
  useBedrockProvider: boolean
  anthropicModel: string
  anthropicSmallFastModel: string

  // Telemetry
  enableTelemetry: boolean
  otelMetricsExporter: string
  otelProtocol: string
  otelEndpoint: string
  enableAudit: boolean
  metricsBatchSize: number
  metricsIntervalSeconds: number

  // Audit & Compliance
  auditTableName: string

  // Quota & Policy (uses modelsApiEndpoint + /quota routes)
  quotaFailMode: "open" | "closed"
  quotaCheckInterval: "PROMPT" | number // "PROMPT" for per-prompt checks, or seconds (default: 300 for 5min)

  // Models API
  modelsApiEndpoint: string

  // AWS Cognito SSO
  providerDomain: string
  clientId: string
  awsRegionProfile: string
  providerType: "cognito"
  credentialStorage: "session" | "persistent"
  crossRegionProfile: string
  identityPoolId: string
  federationType: "cognito"
  cognitoUserPoolId: string

  // Optional installer URLs
  installerUrlOpencode?: string
  installerUrlGit?: string

  // Organization context (for telemetry enrichment)
  department?: string
  teamId?: string
  costCenter?: string
  manager?: string
  role?: string
  location?: string
  organization?: string
  accountId?: string
}

export const defaultConfig: Partial<ANRConfig> = {
  useBedrockProvider: true,
  enableTelemetry: true,
  enableAudit: true,
  metricsBatchSize: 100,
  metricsIntervalSeconds: 60,
  quotaFailMode: "closed",
  quotaCheckInterval: 300, // 5 minutes default
  providerType: "cognito",
  credentialStorage: "session",
  federationType: "cognito",
  otelMetricsExporter: "otlp",
  otelProtocol: "http/protobuf",
}
