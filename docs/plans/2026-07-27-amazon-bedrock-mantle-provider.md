# Amazon Bedrock Mantle Provider — First-Class Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promote `amazon-bedrock-mantle` from an implicit DynamoDB-only provider to a first-class peer of `amazon-bedrock` in the `custom()` registry, so it auto-displays and routes inference correctly whenever `AWS_BEARER_TOKEN_BEDROCK` is present or an API key is stored.

**Architecture:** Add an `"amazon-bedrock-mantle"` entry to the `custom()` function in `provider.ts` that mirrors the bearer-token path of the `"amazon-bedrock"` loader, uses the Mantle SDK (`@ai-sdk/amazon-bedrock/mantle`), registers `selectBedrockMantleLanguageModel` as the `getModel` dispatcher, and sets `autoload: true` when credentials exist. Add `amazonBedrockMantle` to the `ProviderV2.ID` statics in `packages/schema/src/provider.ts` so tests and other callers can reference it without string literals.

**Tech Stack:** TypeScript, Effect (fnUntraced), `@ai-sdk/amazon-bedrock/mantle`, Bun test

---

### Task 1: Add `amazonBedrockMantle` to the `ProviderV2.ID` statics

**Files:**
- Modify: `packages/schema/src/provider.ts:10-22`

**Step 1: Add the constant**

In `packages/schema/src/provider.ts`, add `amazonBedrockMantle` to the `statics` block immediately after `amazonBedrock`:

```ts
amazonBedrock: schema.make("amazon-bedrock"),
// ANRCODE_CHANGE {"issue":"<issue>","branch":"<branch>","date":"2026-07-27"}
amazonBedrockMantle: schema.make("amazon-bedrock-mantle"),
```

**Step 2: Verify TypeScript compiles**

```bash
bun typecheck
```
Run from `packages/schema`. Expected: no errors.

**Step 3: Commit**

```bash
git add packages/schema/src/provider.ts
git commit -m "feat(schema): add amazonBedrockMantle to ProviderV2.ID statics"
```

---

### Task 2: Add `"amazon-bedrock-mantle"` to the `custom()` function

**Files:**
- Modify: `packages/opencode/src/provider/provider.ts:168` — `custom()` function, after the `"amazon-bedrock"` block (~line 489)

**Step 1: Locate the end of the `"amazon-bedrock"` block**

The `"amazon-bedrock"` entry in `custom()` ends around line 489 in `provider.ts`. Find the closing `}),` of that entry.

**Step 2: Insert the `"amazon-bedrock-mantle"` custom loader immediately after**

```ts
// ANRCODE_CHANGE {"issue":"<issue>","branch":"<branch>","date":"2026-07-27"}
"amazon-bedrock-mantle": Effect.fnUntraced(function* () {
  const providerConfig = (yield* dep.config()).provider?.["amazon-bedrock-mantle"]
  const auth = yield* dep.auth("amazon-bedrock-mantle")

  const awsBearerToken = iife(() => {
    const envToken = process.env.AWS_BEARER_TOKEN_BEDROCK
    if (envToken) return envToken
    if (auth?.type === "api") {
      process.env.AWS_BEARER_TOKEN_BEDROCK = auth.key
      return auth.key
    }
    return undefined
  })

  const configApiKey = providerConfig?.options?.apiKey

  if (!awsBearerToken && !configApiKey) return { autoload: false }

  const defaultRegion = process.env.AWS_REGION ?? providerConfig?.options?.region ?? "us-east-1"

  return {
    autoload: true,
    options: { region: defaultRegion },
    vars(_options: Record<string, any>) {
      return { AWS_REGION: _options.region ?? defaultRegion }
    },
    async getModel(sdk: any, modelID: string) {
      return selectBedrockMantleLanguageModel(sdk, modelID)
    },
  }
}),
```

**Why this shape:**
- `autoload: true` only when a bearer token or config API key exists — matches the credential gate used by `amazon-bedrock`
- `selectBedrockMantleLanguageModel` (already defined at line 162) handles the `responses` vs `chat` dispatch
- No credential-chain setup needed — Mantle is always bearer-token only
- Region handling mirrors the `amazon-bedrock` loader's ANR-mode path (reads directly from `process.env`)

**Step 3: Verify TypeScript compiles**

```bash
bun typecheck
```
Run from `packages/opencode`. Expected: no errors.

**Step 4: Commit**

```bash
git add packages/opencode/src/provider/provider.ts
git commit -m "feat(opencode): add amazon-bedrock-mantle to custom() provider registry"
```

---

### Task 3: Write tests for the Mantle provider registration

**Files:**
- Modify: `packages/opencode/test/provider/amazon-bedrock.test.ts` — add new `it.instance` tests at the end of the file

**Step 1: Write the failing tests**

Add these tests at the end of `amazon-bedrock.test.ts`:

```ts
it.instance(
  "Bedrock Mantle: provider appears in list when AWS_BEARER_TOKEN_BEDROCK is set",
  () =>
    Effect.gen(function* () {
      yield* set("AWS_BEARER_TOKEN_BEDROCK", "test-mantle-token")
      yield* set("AWS_PROFILE", "")
      yield* set("AWS_ACCESS_KEY_ID", "")
      const providers = yield* list
      expect(providers[ProviderV2.ID.amazonBedrockMantle]).toBeDefined()
    }),
)

it.instance(
  "Bedrock Mantle: provider does NOT appear when no credentials",
  () =>
    Effect.gen(function* () {
      yield* set("AWS_BEARER_TOKEN_BEDROCK", "")
      yield* set("AWS_PROFILE", "")
      yield* set("AWS_ACCESS_KEY_ID", "")
      const providers = yield* list
      expect(providers[ProviderV2.ID.amazonBedrockMantle]).toBeUndefined()
    }),
)

it.instance(
  "Bedrock Mantle: provider appears when apiKey set in config options",
  () =>
    Effect.gen(function* () {
      yield* set("AWS_BEARER_TOKEN_BEDROCK", "")
      yield* set("AWS_PROFILE", "")
      yield* set("AWS_ACCESS_KEY_ID", "")
      const providers = yield* list
      expect(providers[ProviderV2.ID.amazonBedrockMantle]).toBeDefined()
    }),
  { config: { provider: { "amazon-bedrock-mantle": { options: { apiKey: "test-key" } } } } },
)

it.instance(
  "Bedrock Mantle: getModel routes to responses API for standard models",
  () =>
    Effect.gen(function* () {
      yield* set("AWS_BEARER_TOKEN_BEDROCK", "test-mantle-token")
      const model = yield* Provider.use.getModel(
        ProviderV2.ID.amazonBedrockMantle,
        ModelV2.ID.make("anthropic.claude-sonnet-5"),
      )
      const language = yield* Provider.use.getLanguage(model)
      expect((language as { provider: string }).provider).toBe("bedrock-mantle.responses")
    }),
)

it.instance(
  "Bedrock Mantle: getModel routes to chat API for safeguard models",
  () =>
    Effect.gen(function* () {
      yield* set("AWS_BEARER_TOKEN_BEDROCK", "test-mantle-token")
      const model = yield* Provider.use.getModel(
        ProviderV2.ID.amazonBedrockMantle,
        ModelV2.ID.make("openai.gpt-oss-safeguard-20b"),
      )
      const language = yield* Provider.use.getLanguage(model)
      expect((language as { provider: string }).provider).toBe("bedrock-mantle.chat")
    }),
)
```

**Step 2: Run the tests and confirm they FAIL** (provider not yet in custom())

```bash
bun test test/provider/amazon-bedrock.test.ts
```
Run from `packages/opencode`. Expected: new tests fail — `providers[ProviderV2.ID.amazonBedrockMantle]` is undefined.

*(This step validates the test is testing the right thing. If Task 2 was done first, skip to Step 4.)*

**Step 3: Confirm tests PASS after Task 2 implementation**

```bash
bun test test/provider/amazon-bedrock.test.ts
```
Expected: all tests pass.

**Step 4: Run the full provider test suite**

```bash
bun test test/provider/
```
Expected: all existing tests still pass.

**Step 5: Commit**

```bash
git add packages/opencode/test/provider/amazon-bedrock.test.ts
git commit -m "test(opencode): add amazon-bedrock-mantle custom loader tests"
```

---

### Task 4: Delete the disk cache and verify end-to-end

The local models cache (`~/.local/share/opencode/log/` area) may contain a stale snapshot without the new provider entry. Bust it before running to avoid confusion.

**Step 1: Find and delete the cache file**

```bash
find ~/.local/share/opencode -name "models-*.json" -delete 2>/dev/null; echo "cache cleared"
```

**Step 2: Run the app with debug output**

```bash
AWS_BEARER_TOKEN_BEDROCK=<your-token> opencode --log-level DEBUG --print-logs
```

Expected: `amazon-bedrock-mantle` appears in the provider list in the UI.

**Step 3: Run the full test suite**

```bash
bun test
```
Run from `packages/opencode`. Expected: all tests pass, no regressions.

**Step 4: Final commit if any fixups were needed**

```bash
git add -p
git commit -m "fix(opencode): <describe any fixup>"
```
