// ANRCODE_CHANGE {"issue":351,"branch":"copilot/consolidate-bun-aws-sdk-workaround","date":"2026-07-13"}
/**
 * Bun resolves some AWS SDK CJS modules differently across platforms, causing
 * loadConfig() to appear as a Symbol instead of a function for options like
 * accountIdEndpointMode and authSchemePreference. Supplying these explicitly
 * prevents the SDK from calling loadConfig() for those paths at all.
 */
export interface AwsClientConfig {
  region: string
  accountIdEndpointMode: "disabled"
  authSchemePreference: string[]
  maxAttempts: number
  retryMode: "standard"
  defaultsMode: "standard"
  useDualstackEndpoint: false
  requestChecksumCalculation: "WHEN_REQUIRED"
  responseChecksumValidation: "WHEN_REQUIRED"
  useFipsEndpoint?: true
}

export function anrClientConfig(options: { region: string; govcloud?: boolean }): AwsClientConfig {
  return {
    region: options.region,
    accountIdEndpointMode: "disabled",
    authSchemePreference: [],
    maxAttempts: 3,
    retryMode: "standard",
    defaultsMode: "standard",
    useDualstackEndpoint: false,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    ...(options.govcloud && { useFipsEndpoint: true }),
  }
}
