/**
 * Token-based (non-interactive) authentication for ANR CI mode.
 *
 * Provides mode selection, environment validation, and credential resolution
 * without any browser or interactive TTY dependency. Used by both the CLI
 * (packages/opencode/src/index.ts) and the desktop sidecar
 * (packages/opencode/src/anr-boot.ts) so neither copy drifts on auth logic.
 *
 * Environment contract:
 *   OPENCODE_ANR_AUTH_MODE        "interactive" (default) | "token"
 *   OPENCODE_ANR_ID_TOKEN         Required in token mode (unless AWS creds given directly)
 *   OPENCODE_ANR_REFRESH_TOKEN    Optional — enables scheduled token refresh in token mode
 *   AWS_ACCESS_KEY_ID             Optional — if present with SECRET+TOKEN, skips federation
 *   AWS_SECRET_ACCESS_KEY         Optional — see above
 *   AWS_SESSION_TOKEN             Optional — see above
 *   AWS_REGION                    Optional — overrides config.awsRegion in token mode
 */

import type { ANRConfig } from "../config/types"
import { exchangeTokenForAWSCredentials, type AWSCredentials } from "./aws-federation"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ANRAuthMode = "interactive" | "token"

export interface TokenAuthResult {
  idToken: string
  refreshToken: string | undefined
  awsCredentials: AWSCredentials
  /** How credentials were obtained — useful for logging/diagnostics. */
  credentialSource: "static" | "exchange"
}

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------

/**
 * Read OPENCODE_ANR_AUTH_MODE from the given env map (defaults to process.env).
 * Throws a CI-friendly error if an unrecognised value is set.
 */
export function parseANRAuthMode(env: NodeJS.ProcessEnv = process.env): ANRAuthMode {
  const raw = env.OPENCODE_ANR_AUTH_MODE
  if (!raw || raw === "interactive") return "interactive"
  if (raw === "token") return "token"
  throw new Error(
    `[ANR] Unknown OPENCODE_ANR_AUTH_MODE value: "${raw}"\n` +
      `  Valid values: "interactive" (default), "token"\n` +
      `  Set OPENCODE_ANR_AUTH_MODE=token for CI / non-interactive use.`,
  )
}

// ---------------------------------------------------------------------------
// Token-mode validation
// ---------------------------------------------------------------------------

export interface TokenModeValidationOk {
  ok: true
  idToken: string
  refreshToken: string | undefined
  staticAWSCreds: StaticAWSCreds | undefined
}

export interface TokenModeValidationError {
  ok: false
  /** Human-readable, CI-friendly error. Never contains secret values. */
  message: string
}

interface StaticAWSCreds {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  region: string
}

/**
 * Validate the environment contract for token mode.
 * Returns a typed ok/error result — never throws.
 * Error messages are actionable and contain NO secret values.
 */
export function validateTokenModeEnv(
  env: NodeJS.ProcessEnv = process.env,
): TokenModeValidationOk | TokenModeValidationError {
  const staticAWSCreds = resolveStaticAWSCreds(env)

  // If full static AWS creds are present, we don't need an ID token for exchange.
  // We still accept OPENCODE_ANR_ID_TOKEN for telemetry context building.
  if (staticAWSCreds) {
    return {
      ok: true,
      idToken: env.OPENCODE_ANR_ID_TOKEN || "",
      refreshToken: env.OPENCODE_ANR_REFRESH_TOKEN,
      staticAWSCreds,
    }
  }

  // No static creds — require ID token for federation exchange.
  const missing: string[] = []
  if (!env.OPENCODE_ANR_ID_TOKEN) missing.push("OPENCODE_ANR_ID_TOKEN")

  if (missing.length > 0) {
    return {
      ok: false,
      message:
        `[ANR] Token auth mode is missing required environment variable(s):\n` +
        missing.map((v) => `  - ${v} is not set`).join("\n") +
        `\n\nTo fix:\n` +
        `  • Set OPENCODE_ANR_ID_TOKEN to a valid Cognito ID token.\n` +
        `  • Or provide AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_SESSION_TOKEN\n` +
        `    to bypass federation entirely.\n` +
        `  • OPENCODE_ANR_REFRESH_TOKEN is optional but enables token refresh in CI.`,
    }
  }

  return {
    ok: true,
    idToken: env.OPENCODE_ANR_ID_TOKEN!,
    refreshToken: env.OPENCODE_ANR_REFRESH_TOKEN,
    staticAWSCreds: undefined,
  }
}

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

/**
 * Resolve AWS credentials for token mode:
 *   1. If AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_SESSION_TOKEN are all
 *      set, return them directly (source: "static") — no federation call.
 *   2. Otherwise exchange OPENCODE_ANR_ID_TOKEN via Cognito Identity Pool
 *      (source: "exchange").
 *
 * Throws a CI-friendly error on failure. Redacts secret values from messages.
 */
export async function resolveTokenModeCredentials(
  config: ANRConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TokenAuthResult> {
  const validation = validateTokenModeEnv(env)
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  // Static path — caller provided full AWS creds.
  if (validation.staticAWSCreds) {
    const { accessKeyId, secretAccessKey, sessionToken, region } = validation.staticAWSCreds
    const effectiveRegion = region || config.awsRegion
    return {
      idToken: validation.idToken,
      refreshToken: validation.refreshToken,
      credentialSource: "static",
      awsCredentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken,
        expiration: undefined,
        // Override config region with env region when static creds are provided
        ...(effectiveRegion && { expiration: undefined }),
      },
    }
  }

  // Exchange path — use ID token to get AWS creds via Cognito Identity Pool.
  const idToken = validation.idToken
  if (!idToken) {
    throw new Error(
      `[ANR] Token auth: OPENCODE_ANR_ID_TOKEN is empty.\n` +
        `  Ensure the token is a valid Cognito ID token (JWT, three dot-separated parts).`,
    )
  }

  // Sanity-check token shape without logging the value.
  if (idToken.split(".").length !== 3) {
    throw new Error(
      `[ANR] Token auth: OPENCODE_ANR_ID_TOKEN does not appear to be a valid JWT.\n` +
        `  Expected three dot-separated base64url segments. Token length: ${idToken.length}.`,
    )
  }

  let awsCredentials: AWSCredentials
  try {
    awsCredentials = await exchangeTokenForAWSCredentials(idToken, config)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[ANR] Token auth: federation exchange failed.\n` +
        `  ${msg}\n\n` +
        `  Check that:\n` +
        `    • OPENCODE_ANR_ID_TOKEN is a fresh, unexpired Cognito ID token\n` +
        `    • The identity pool ID and region in your config are correct\n` +
        `    • The token's issuer matches the configured Cognito User Pool`,
    )
  }

  return {
    idToken,
    refreshToken: validation.refreshToken,
    credentialSource: "exchange",
    awsCredentials,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveStaticAWSCreds(env: NodeJS.ProcessEnv): StaticAWSCreds | undefined {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_REGION } = env
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_SESSION_TOKEN) {
    return {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      sessionToken: AWS_SESSION_TOKEN,
      region: AWS_REGION || "",
    }
  }
  return undefined
}
