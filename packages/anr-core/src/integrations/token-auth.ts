// ANRCODE_CHANGE {"issue":310,"branch":"anr/321/create-anrcode-agentic-dev-team","date":"2026-07-22"}
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
 *   OPENCODE_ANR_REFRESH_TOKEN    Recommended for CI — long-lived Cognito refresh token;
 *                                 exchanged for a fresh ID token at startup (refresh-first
 *                                 bootstrap) and used for scheduled refresh thereafter
 *   OPENCODE_ANR_ID_TOKEN         Required in token mode when neither a refresh token nor
 *                                 static AWS creds are provided
 *   AWS_ACCESS_KEY_ID             Optional — if present with SECRET+TOKEN, skips federation
 *   AWS_SECRET_ACCESS_KEY         Optional — see above
 *   AWS_SESSION_TOKEN             Optional — see above
 *   AWS_REGION                    Optional — overrides config.awsRegion in token mode
 */

import type { ANRConfig } from "../config/types"
import { exchangeTokenForAWSCredentials, type AWSCredentials } from "./aws-federation"
import { refreshOIDCTokens } from "./oidc-auth"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ANRAuthMode = "interactive" | "token"

export interface TokenAuthResult {
  idToken: string
  refreshToken: string | undefined
  awsCredentials: AWSCredentials
  /** How credentials were obtained — useful for logging/diagnostics. */
  credentialSource: "static" | "exchange" | "refresh-exchange"
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
  // Tokens are base64url/JWT and can never legitimately contain whitespace,
  // but secrets pasted from a terminal often pick up newlines at visual wrap
  // points (e.g. macOS Terminal copies soft-wrapped lines with hard breaks).
  // Strip all whitespace so a mangled paste still authenticates.
  const idToken = env.OPENCODE_ANR_ID_TOKEN?.replace(/\s+/g, "") || ""
  const refreshToken = env.OPENCODE_ANR_REFRESH_TOKEN?.replace(/\s+/g, "") || undefined

  // If full static AWS creds are present, we don't need an ID token for exchange.
  // We still accept OPENCODE_ANR_ID_TOKEN for telemetry context building.
  if (staticAWSCreds) {
    return {
      ok: true,
      idToken,
      refreshToken,
      staticAWSCreds,
    }
  }

  // No static creds — require an ID token or a refresh token for federation exchange.
  // A refresh token alone is sufficient: it is exchanged for a fresh ID token at
  // startup (refresh-first bootstrap), which is the recommended CI configuration.
  if (!idToken && !refreshToken) {
    return {
      ok: false,
      message:
        `[ANR] Token auth mode is missing required environment variable(s):\n` +
        `  - OPENCODE_ANR_ID_TOKEN is not set\n` +
        `  - OPENCODE_ANR_REFRESH_TOKEN is not set\n` +
        `\nTo fix (one of):\n` +
        `  • Set OPENCODE_ANR_REFRESH_TOKEN to a long-lived Cognito refresh token\n` +
        `    (recommended for CI — a fresh ID token is minted automatically).\n` +
        `  • Set OPENCODE_ANR_ID_TOKEN to a valid, unexpired Cognito ID token.\n` +
        `  • Provide AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_SESSION_TOKEN\n` +
        `    to bypass federation entirely.`,
    }
  }

  return {
    ok: true,
    idToken,
    refreshToken,
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
 *   2. Else if OPENCODE_ANR_REFRESH_TOKEN is set, exchange it for a fresh ID
 *      token first (refresh-first bootstrap), then federate that ID token
 *      (source: "refresh-exchange"). Falls back to step 3 if the refresh fails
 *      and an ID token is also available.
 *   3. Otherwise exchange OPENCODE_ANR_ID_TOKEN via Cognito Identity Pool
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
    const { accessKeyId, secretAccessKey, sessionToken } = validation.staticAWSCreds
    return {
      idToken: validation.idToken,
      refreshToken: validation.refreshToken,
      credentialSource: "static",
      awsCredentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken,
        expiration: undefined,
      },
    }
  }

  // Refresh-first bootstrap — a refresh token mints a fresh ID token without a
  // browser, so CI stores one long-lived secret instead of rotating ID tokens.
  if (validation.refreshToken) {
    let refreshed
    try {
      refreshed = await refreshOIDCTokens(config, validation.refreshToken)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!validation.idToken) {
        throw new Error(
          `[ANR] Token auth: refresh token exchange failed and no OPENCODE_ANR_ID_TOKEN fallback is set.\n` +
            `  ${msg}\n\n` +
            `  Check that:\n` +
            `    • OPENCODE_ANR_REFRESH_TOKEN is a valid, unexpired Cognito refresh token\n` +
            `    • The refresh token was issued to the app client in your config (CLIENT_ID)\n` +
            `    • Refresh token rotation is disabled on the Cognito app client —\n` +
            `      rotation invalidates a statically stored secret after first use`,
        )
      }
      console.error("⚠️  [ANR] Refresh-first bootstrap failed — falling back to OPENCODE_ANR_ID_TOKEN.")
      console.error(`   ${msg}`)
    }

    if (refreshed) {
      return {
        idToken: refreshed.idToken,
        refreshToken: refreshed.refreshToken ?? validation.refreshToken,
        credentialSource: "refresh-exchange",
        awsCredentials: await federateIdToken(refreshed.idToken, config),
      }
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

  return {
    idToken,
    refreshToken: validation.refreshToken,
    credentialSource: "exchange",
    awsCredentials: await federateIdToken(idToken, config),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function federateIdToken(idToken: string, config: ANRConfig): Promise<AWSCredentials> {
  try {
    return await exchangeTokenForAWSCredentials(idToken, config)
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
}

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
