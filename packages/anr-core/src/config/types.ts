/**
 * ANR OpenCode Configuration Types
 * Matches the environment variable format from existing Go wrapper
 */

export interface ANRConfig {
  // AWS & Bedrock
  awsProfile: string
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

  // Quota & Policy
  quotaApiEndpoint: string
  quotaFailMode: "open" | "closed"
  quotaCheckInterval: "PROMPT" | number // "PROMPT" for per-prompt checks, or seconds (default: 300 for 5min)

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
  installerUrlClaude?: string
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
  awsRegion: "us-east-2",
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
