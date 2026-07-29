export * as Provider from "./provider"

import { Schema } from "effect"
import { optional } from "./schema"
import { Integration } from "./integration"
import { statics } from "./schema"

export const ID = Schema.String.pipe(
  Schema.brand("ProviderV2.ID"),
  statics((schema) => ({
    opencode: schema.make("opencode"),
    anthropic: schema.make("anthropic"),
    openai: schema.make("openai"),
    google: schema.make("google"),
    googleVertex: schema.make("google-vertex"),
    githubCopilot: schema.make("github-copilot"),
    amazonBedrock: schema.make("amazon-bedrock"),
    // ANRCODE_CHANGE {"issue":"audio-device-selection","branch":"audio-device-selection","date":"2026-07-27"}
    amazonBedrockMantle: schema.make("amazon-bedrock-mantle"),
    azure: schema.make("azure"),
    openrouter: schema.make("openrouter"),
    mistral: schema.make("mistral"),
    gitlab: schema.make("gitlab"),
  })),
)
export type ID = typeof ID.Type

export interface AISDK extends Schema.Schema.Type<typeof AISDK> {}
export const AISDK = Schema.Struct({
  type: Schema.Literal("aisdk"),
  package: Schema.String,
  url: Schema.String.pipe(optional),
  // ANRCODE_CHANGE {"issue":"mantle-endpoint-shape","branch":"provider-logging","date":"2026-07-28"}
  // Data-driven wire endpoint selector (arbitrary string, e.g. "responses" | "chat").
  // Keeps per-model endpoint routing in the catalog instead of provider code.
  shape: Schema.String.pipe(optional),
  settings: Schema.Record(Schema.String, Schema.Unknown).pipe(optional),
}).annotate({ identifier: "Provider.AISDK" })

export interface Native extends Schema.Schema.Type<typeof Native> {}
export const Native = Schema.Struct({
  type: Schema.Literal("native"),
  url: Schema.String.pipe(optional),
  settings: Schema.Record(Schema.String, Schema.Unknown),
}).annotate({ identifier: "Provider.Native" })

export const Api = Schema.Union([AISDK, Native])
  .pipe(Schema.toTaggedUnion("type"))
  .annotate({ identifier: "Provider.Api" })
export type Api = typeof Api.Type

export interface Request extends Schema.Schema.Type<typeof Request> {}
export const Request = Schema.Struct({
  headers: Schema.Record(Schema.String, Schema.String),
  body: Schema.Record(Schema.String, Schema.Json),
}).annotate({ identifier: "Provider.Request" })

export interface Info extends Schema.Schema.Type<typeof Info> {}
export const Info = Schema.Struct({
  id: ID,
  integrationID: Integration.ID.pipe(optional),
  name: Schema.String,
  disabled: Schema.Boolean.pipe(optional),
  api: Api,
  request: Request,
})
  .annotate({ identifier: "ProviderV2.Info" })
  .pipe(
    statics((schema) => ({
      empty: (id: ID) =>
        schema.make({
          id,
          name: id,
          api: { type: "native", settings: {} },
          request: { headers: {}, body: {} },
        }),
    })),
  )
