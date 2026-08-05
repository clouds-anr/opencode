<!-- ANRCODE_CHANGE {"issue":17,"branch":"anr-bedrock-enforcement","date":"2026-07-30"} -->
# ANR Provider Policy

## Overview

When `OPENCODE_FLAVOR=anr`, only AWS Bedrock providers are permitted. All other LLM providers are blocked at multiple enforcement points.

## Allowed Providers

```typescript
ANR_ALLOWED_PROVIDERS = [
  "amazon-bedrock",
  "@ai-sdk/amazon-bedrock",
  "@ai-sdk/amazon-bedrock/mantle"
]
```

## Enforcement Points

| Location | File:Line | What It Does |
|----------|-----------|--------------|
| Provider Loader | `packages/opencode/src/provider/provider.ts:1760` | Filters provider registry to Bedrock-only |
| Env Var Clearing | `packages/anr-core/src/config/env-loader.ts:~400` | Deletes non-ANR provider API keys |
| HTTP API Guard | `packages/opencode/src/server/.../control.ts:~15` | Rejects non-Bedrock auth.set calls |
| Plugin Gate | `packages/opencode/src/plugin/index.ts:~80` | Filters plugins to Bedrock-compatible only |
| SKIP_AUTH Hardening | `packages/opencode/src/index.ts:~715` | Fatal error on release/beta channels |
| CI Check | `packages/opencode/src/provider/validate-anr-providers.test.ts` | Fails build if BUNDLED_PROVIDERS grows |

## Testing

To verify enforcement:

```bash
# Set ANR mode
export OPENCODE_FLAVOR=anr

# Try to use Anthropic (should fail)
export ANTHROPIC_API_KEY=sk-ant-xxx
bun dev

# Provider list should only show Bedrock
```

## Bypass Attempts

All 8 confirmed bypass paths are now blocked:
1. ✅ OPENCODE_ANR_SKIP_AUTH - hardened with channel check + audit log
2. ✅ Environment variable injection - API keys cleared in clearStaleEnv()
3. ✅ Config file poisoning - non-Bedrock providers stripped from merged config
4. ✅ HTTP API bypass - PUT /auth/:providerID guarded
5. ✅ Plugin bypass - plugins filtered to Bedrock-compatible only
6. ✅ OPENCODE_FLAVOR override - forced to "anr" when ANR markers detected
7. ✅ Model config override - cfg.model and cfg.small_model validated
8. ✅ BUNDLED_PROVIDERS growth - CI check fails build on unlisted providers
