// ANRCODE_CHANGE {"issue":17,"branch":"anr-bedrock-enforcement","date":"2026-07-30"}
import { describe, test, expect } from "bun:test"
import path from "path"
import { ANR_ALLOWED_NPM, NON_ANR_NPM, ANR_ALLOWED_PROVIDERS, isANRAllowedProvider } from "../../src/anr/policy"

const PROVIDER_FILE = path.join(import.meta.dir, "../../src/provider/provider.ts")

async function bundledProviderKeys() {
  const source = await Bun.file(PROVIDER_FILE).text()
  const start = source.indexOf("const BUNDLED_PROVIDERS")
  if (start === -1) throw new Error("Could not find BUNDLED_PROVIDERS in provider.ts")

  // Walk from the opening brace of the object literal to its matching close, so arrow-function
  // bodies and nested braces inside the entries cannot terminate the scan early.
  const open = source.indexOf("{", source.indexOf("=", start))
  let depth = 0
  let end = -1
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++
    if (source[i] === "}") {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error("Could not find end of BUNDLED_PROVIDERS object literal")

  return [...source.slice(open, end).matchAll(/^\s*["']([^"']+)["']\s*:/gm)].map((m) => m[1])
}

describe("ANR Provider Allowlist CI Check", () => {
  test("BUNDLED_PROVIDERS must not grow without a policy update", async () => {
    const keys = await bundledProviderKeys()
    expect(keys.length).toBeGreaterThan(0)

    const known = new Set([...ANR_ALLOWED_NPM, ...NON_ANR_NPM])
    const unlisted = keys.filter((key) => !known.has(key))

    expect(
      unlisted,
      `BUNDLED_PROVIDERS contains unlisted providers: ${unlisted.join(", ")}. ` +
        `Add each to ANR_ALLOWED_NPM or NON_ANR_NPM in src/anr/policy.ts.`,
    ).toEqual([])
  })

  test("every allowlisted npm package is actually bundled", async () => {
    const keys = new Set(await bundledProviderKeys())
    expect(ANR_ALLOWED_NPM.filter((npm) => !keys.has(npm))).toEqual([])
  })

  test("the two policy namespaces stay disjoint", () => {
    // Provider IDs are registry keys; npm names are BUNDLED_PROVIDERS keys. Mixing them silently
    // breaks enforcement, so no value may appear in both lists.
    const npm = new Set<string>([...ANR_ALLOWED_NPM, ...NON_ANR_NPM])
    expect(ANR_ALLOWED_PROVIDERS.filter((id) => npm.has(id))).toEqual([])
  })

  test("allows both Bedrock provider IDs and rejects everything else", () => {
    expect(isANRAllowedProvider("amazon-bedrock")).toBe(true)
    expect(isANRAllowedProvider("amazon-bedrock-mantle")).toBe(true)
    expect(isANRAllowedProvider("anthropic")).toBe(false)
    expect(isANRAllowedProvider("openai")).toBe(false)
    expect(isANRAllowedProvider("@ai-sdk/amazon-bedrock")).toBe(false)
  })
})
