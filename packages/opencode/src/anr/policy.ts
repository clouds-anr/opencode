// ANRCODE_CHANGE {"issue":17,"branch":"anr-bedrock-enforcement","date":"2026-07-30"}
// Single source of truth for the ANR Bedrock-only provider policy.
//
// Two distinct namespaces live here and must not be mixed:
//   - ANR_ALLOWED_PROVIDERS  : ProviderV2.ID values (registry keys, config keys, HTTP route params)
//   - ANR_ALLOWED_NPM        : BUNDLED_PROVIDERS keys (npm package specifiers)

export const ANR_ALLOWED_PROVIDERS: readonly string[] = ["amazon-bedrock", "amazon-bedrock-mantle"]

export const ANR_ALLOWED_NPM: readonly string[] = ["@ai-sdk/amazon-bedrock", "@ai-sdk/amazon-bedrock/mantle"]

export const NON_ANR_NPM: readonly string[] = [
  "@ai-sdk/anthropic",
  "@ai-sdk/azure",
  "@ai-sdk/google",
  "@ai-sdk/google-vertex",
  "@ai-sdk/google-vertex/anthropic",
  "@ai-sdk/openai",
  "@ai-sdk/openai-compatible",
  "@openrouter/ai-sdk-provider",
  "@ai-sdk/xai",
  "@ai-sdk/mistral",
  "@ai-sdk/groq",
  "@ai-sdk/deepinfra",
  "@ai-sdk/cerebras",
  "@ai-sdk/cohere",
  "@ai-sdk/gateway",
  "@ai-sdk/togetherai",
  "@ai-sdk/perplexity",
  "@ai-sdk/vercel",
  "@ai-sdk/alibaba",
  "gitlab-ai-provider",
  "@ai-sdk/github-copilot",
  "venice-ai-sdk-provider",
]

export function isANRAllowedProvider(providerID: string): boolean {
  return ANR_ALLOWED_PROVIDERS.includes(providerID)
}

export * as ANRPolicy from "./policy"
