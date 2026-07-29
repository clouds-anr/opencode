#!/usr/bin/env bun
// ANRCODE_CHANGE {"issue":310,"branch":"anr-token-based-auth","date":"2026-07-29"}
/**
 * Lightweight preflight for the ANR token-auth CI smoke job.
 *
 * Attempts refresh-first credential resolution directly (no CLI build)
 * against the configured Cognito Identity Pool. Gates the more expensive
 * smoke job: when the pool has been deleted/rotated server-side
 * (ResourceNotFoundException), the smoke job is skipped rather than
 * reported as a false regression. Any other failure still lets the smoke
 * job run so it surfaces full diagnostics — this only suppresses the one
 * known, external, non-code failure mode.
 *
 * Usage:
 *   bun run script/anr-token-auth-preflight.ts path/to/.env.flavor
 *
 * Prints exactly one line: AUTH_OK | SKIP_STALE_IDENTITY_POOL | PREFLIGHT_ERROR
 */
import { getValidatedANRConfig, resolveTokenModeCredentials } from "@opencode-ai/anr-core"

try {
  const config = await getValidatedANRConfig(process.argv[2], true)
  await resolveTokenModeCredentials(config, process.env)
  console.log("AUTH_OK")
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  if (/IdentityPool.*not found/i.test(message) || /ResourceNotFoundException/.test(message)) {
    console.log("SKIP_STALE_IDENTITY_POOL")
    console.error(message)
  } else {
    console.log("PREFLIGHT_ERROR")
    console.error(message)
  }
}
