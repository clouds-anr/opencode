import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import z from "zod"
import { Installation } from "../installation"
import { Flag } from "../flag/flag"
import { lazy } from "@/util/lazy"
import { Filesystem } from "../util/filesystem"

// Try to import bundled snapshot (generated at build time)
// Falls back to undefined in dev mode when snapshot doesn't exist
/* @ts-ignore */

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const filepath = path.join(Global.Path.cache, "models.json")

  export const Model = z.object({
    id: z.string(),
    name: z.string(),
    family: z.string().optional(),
    release_date: z.string(),
    attachment: z.boolean(),
    reasoning: z.boolean(),
    temperature: z.boolean(),
    tool_call: z.boolean(),
    interleaved: z
      .union([
        z.literal(true),
        z
          .object({
            field: z.enum(["reasoning_content", "reasoning_details"]),
          })
          .strict(),
      ])
      .optional(),
    cost: z
      .object({
        input: z.number(),
        output: z.number(),
        cache_read: z.number().optional(),
        cache_write: z.number().optional(),
        context_over_200k: z
          .object({
            input: z.number(),
            output: z.number(),
            cache_read: z.number().optional(),
            cache_write: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
    limit: z.object({
      context: z.number(),
      input: z.number().optional(),
      output: z.number(),
    }),
    modalities: z
      .object({
        input: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
        output: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
      })
      .optional(),
    experimental: z.boolean().optional(),
    status: z.enum(["alpha", "beta", "deprecated"]).optional(),
    options: z.record(z.string(), z.any()),
    headers: z.record(z.string(), z.string()).optional(),
    provider: z.object({ npm: z.string().optional(), api: z.string().optional() }).optional(),
    variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  })
  export type Model = z.infer<typeof Model>

  export const Provider = z.object({
    api: z.string().optional(),
    name: z.string(),
    env: z.array(z.string()),
    id: z.string(),
    npm: z.string().optional(),
    models: z.record(z.string(), Model),
  })

  export type Provider = z.infer<typeof Provider>

  function url() {
    return Flag.OPENCODE_MODELS_URL || "https://models.dev"
  }

  function fromDynamoDBValue(value: Record<string, unknown>): unknown {
    if ("S" in value) return value.S
    if ("N" in value) return Number(value.N)
    if ("BOOL" in value) return value.BOOL
    if ("M" in value) {
      const map = value.M as Record<string, Record<string, unknown>>
      return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, fromDynamoDBValue(v)]))
    }
    if ("L" in value) {
      const list = value.L as Record<string, unknown>[]
      return list.map((item) => fromDynamoDBValue(item))
    }
    return undefined
  }

  export function parsePolicyModels(policy: Record<string, unknown>): Record<string, Provider> {
    const modelsAttr = policy.models as { M?: Record<string, Record<string, unknown>> } | undefined
    if (!modelsAttr?.M) return {}
    return Object.fromEntries(
      Object.entries(modelsAttr.M).map(([providerID, providerDDB]) => [
        providerID,
        fromDynamoDBValue(providerDDB) as Provider,
      ]),
    )
  }

  async function fetchFromApiEndpoint(): Promise<Record<string, unknown> | undefined> {
    const headers: Record<string, string> = {
      "User-Agent": Installation.USER_AGENT,
    }
    const idToken = process.env.OPENCODE_ANR_ID_TOKEN
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`
    }
    const result = await fetch(`${Flag.OPENCODE_API_ENDPOINT}/model`, {
      headers,
      signal: AbortSignal.timeout(10 * 1000),
    }).catch((e) => {
      log.error("Failed to fetch from API endpoint", { error: e, url: `${Flag.OPENCODE_API_ENDPOINT}/model` })
    })
    if (result && result.ok) return result.json()
    if (result)
      log.error("API endpoint returned non-ok response", {
        status: result.status,
        url: `${Flag.OPENCODE_API_ENDPOINT}/model`,
      })
    return undefined
  }

  export const Data = lazy(async () => {
    if (Flag.OPENCODE_API_ENDPOINT) {
      // When API endpoint is configured, ONLY use that endpoint
      const cached = await Filesystem.readJson(Flag.OPENCODE_MODELS_PATH ?? filepath).catch(() => {})
      if (cached) {
        // Validate cache is from API endpoint (should have amazon-bedrock provider for ANR)
        // If cache looks like models.dev format (has many providers), invalidate it
        const providerCount = Object.keys(cached).length
        if (providerCount > 5) {
          // Likely models.dev cache (has 20+ providers), invalidate it
          log.warn("Invalidating stale models.dev cache, will fetch from API endpoint", {
            providerCount,
          })
        } else {
          log.info("Using cached models from API endpoint")
          return cached
        }
      }
      const policy = await fetchFromApiEndpoint()
      if (policy) {
        // Check if response has models in DynamoDB format (with .M) or direct format
        const modelsAttr = policy.models as { M?: Record<string, Record<string, unknown>> } | undefined
        if (modelsAttr?.M) {
          // DynamoDB format - parse it
          const models = parsePolicyModels(policy)
          log.info("Loaded models from API endpoint (DynamoDB format)", {
            providerCount: Object.keys(models).length,
          })
          // Cache the result
          await Filesystem.write(filepath, JSON.stringify(models))
          return models
        } else if (policy.models && typeof policy.models === "object") {
          // Direct format - use it as-is
          const models = policy.models as Record<string, Provider>
          log.info("Loaded models from API endpoint (direct format)", {
            providerCount: Object.keys(models).length,
          })
          // Cache the result
          await Filesystem.write(filepath, JSON.stringify(models))
          return models
        }
      }
      log.warn("API endpoint configured but no models returned, using empty set")
      return {}
    }
    const result = await Filesystem.readJson(Flag.OPENCODE_MODELS_PATH ?? filepath).catch(() => {})
    if (result) return result
    // @ts-ignore
    const snapshot = await import("./models-snapshot")
      .then((m) => m.snapshot as Record<string, unknown>)
      .catch(() => undefined)
    if (snapshot) return snapshot
    if (Flag.OPENCODE_DISABLE_MODELS_FETCH) return {}
    const json = await fetch(`${url()}/api.json`).then((x) => x.text())
    return JSON.parse(json)
  })

  export async function get() {
    const result = await Data()
    return result as Record<string, Provider>
  }

  export async function refresh() {
    if (Flag.OPENCODE_API_ENDPOINT) {
      log.info("Refreshing models from API endpoint")
      const policy = await fetchFromApiEndpoint()
      if (policy) {
        // Check if response has models in DynamoDB format (with .M) or direct format
        const modelsAttr = policy.models as { M?: Record<string, Record<string, unknown>> } | undefined
        let modelsData: Record<string, Provider>
        if (modelsAttr?.M) {
          // DynamoDB format - parse it
          modelsData = parsePolicyModels(policy)
          log.info("Refreshed models from API endpoint (DynamoDB format)", {
            providerCount: Object.keys(modelsData).length,
          })
        } else if (policy.models && typeof policy.models === "object") {
          // Direct format - use it as-is
          modelsData = policy.models as Record<string, Provider>
          log.info("Refreshed models from API endpoint (direct format)", {
            providerCount: Object.keys(modelsData).length,
          })
        } else {
          log.warn("API endpoint returned policy without models field")
          return
        }
        await Filesystem.write(filepath, JSON.stringify(modelsData))
        ModelsDev.Data.reset()
      } else {
        log.warn("API endpoint refresh returned no data")
      }
      return
    }
    log.info("Refreshing models from models.dev")
    const result = await fetch(`${url()}/api.json`, {
      headers: {
        "User-Agent": Installation.USER_AGENT,
      },
      signal: AbortSignal.timeout(10 * 1000),
    }).catch((e) => {
      log.error("Failed to fetch models.dev", {
        error: e,
      })
    })
    if (result && result.ok) {
      await Filesystem.write(filepath, await result.text())
      ModelsDev.Data.reset()
      log.info("Successfully refreshed models from models.dev")
    }
  }
}

// Auto-refresh models periodically, but NOT immediately on module load when using API endpoint
// because ANR initialization needs to complete first to set authentication token
if (!Flag.OPENCODE_DISABLE_MODELS_FETCH && !process.argv.includes("--get-yargs-completions")) {
  const isANRMode = process.env.OPENCODE_FLAVOR === "anr"

  if (!isANRMode || !process.env.OPENCODE_API_ENDPOINT) {
    // For non-ANR mode or when not using API endpoint, refresh immediately
    ModelsDev.refresh()
  }
  // For ANR mode with API endpoint, skip initial refresh - it will happen:
  // 1. On first Data() call (via lazy loader)
  // 2. Or via the periodic refresh below after ANR has initialized

  // Periodic refresh every 60 minutes
  setInterval(
    async () => {
      await ModelsDev.refresh()
    },
    60 * 1000 * 60,
  ).unref()
}
