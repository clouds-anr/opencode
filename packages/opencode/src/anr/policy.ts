// ANRCODE_CHANGE {"issue":17,"branch":"anr-bedrock-enforcement","date":"2026-07-30"}
export const ANR_ALLOWED_PROVIDERS = [
  "amazon-bedrock",
  "@ai-sdk/amazon-bedrock",
  "@ai-sdk/amazon-bedrock/mantle"
] as const

export const NON_ANR_PROVIDERS = [
  "@ai-sdk/anthropic", "@ai-sdk/azure", "@ai-sdk/google",
  "@ai-sdk/google-vertex", "@ai-sdk/google-vertex/anthropic",
  "@ai-sdk/openai", "@ai-sdk/openai-compatible",
  "@openrouter/ai-sdk-provider", "@ai-sdk/xai", "@ai-sdk/mistral",
  "@ai-sdk/groq", "@ai-sdk/deepinfra", "@ai-sdk/cerebras",
  "@ai-sdk/cohere", "@ai-sdk/gateway", "@ai-sdk/togetherai",
  "@ai-sdk/perplexity", "@ai-sdk/vercel", "@ai-sdk/alibaba",
  "gitlab-ai-provider", "@ai-sdk/github-copilot", "venice-ai-sdk-provider",
] as const

export * as ANRPolicy from "./policy"
