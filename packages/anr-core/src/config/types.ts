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

  // Audit & Compliance
  auditTableName: string

  // Quota & Policy
  quotaApiEndpoint: string
  quotaFailMode: "open" | "closed"

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
}

export const defaultConfig: Partial<ANRConfig> = {
  awsRegion: "us-east-2",
  useBedrockProvider: true,
  enableTelemetry: true,
  quotaFailMode: "closed",
  providerType: "cognito",
  credentialStorage: "session",
  federationType: "cognito",
  otelMetricsExporter: "otlp",
  otelProtocol: "http/protobuf",
}
