# @opencode-ai/anr-core

## Bun + AWS SDK client config workaround

`anr-core` uses a shared helper (`src/util/aws-client-config.ts`) for Cognito and DynamoDB client construction.

This avoids Bun runtime regressions where AWS SDK lazy `loadConfig()` paths can fail when CJS/runtime resolution changes. We explicitly provide all affected lazy config options so those code paths are never invoked implicitly.

Upstream tracking:

- Bun: https://github.com/oven-sh/bun/issues/9037
- AWS SDK v3: https://github.com/aws/aws-sdk-js-v3/issues/3068
