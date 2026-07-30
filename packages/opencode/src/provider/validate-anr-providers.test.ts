// ANRCODE_CHANGE {"issue":17,"branch":"anr-bedrock-enforcement","date":"2026-07-30"}
import { describe, test, expect } from "bun:test"
import { ANR_ALLOWED_PROVIDERS, NON_ANR_PROVIDERS } from "../anr/policy"

describe("ANR Provider Allowlist CI Check", () => {
  test("BUNDLED_PROVIDERS must not grow without allowlist update", async () => {
    // Read BUNDLED_PROVIDERS from provider.ts
    const providerFile = await Bun.file("./src/provider/provider.ts").text()
    const match = providerFile.match(/const BUNDLED_PROVIDERS[^{]*{([^}]+)}/s)
    
    if (!match) {
      throw new Error("Could not find BUNDLED_PROVIDERS in provider.ts")
    }
    
    // Extract provider IDs from the object
    const bundledKeys = match[1]
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith('"') || line.startsWith("'"))
      .map(line => line.split(":")[0].replace(/['"]/g, ""))
    
    const allowedSet = new Set([...ANR_ALLOWED_PROVIDERS, ...NON_ANR_PROVIDERS])
    const unlisted = bundledKeys.filter(key => !allowedSet.has(key as any))
    
    if (unlisted.length > 0) {
      throw new Error(
        `BUNDLED_PROVIDERS contains unlisted providers: ${unlisted.join(", ")}\n` +
        `Add them to ANR_ALLOWED_PROVIDERS or NON_ANR_PROVIDERS in src/anr/policy.ts`
      )
    }
    
    expect(unlisted).toEqual([])
  })
})
