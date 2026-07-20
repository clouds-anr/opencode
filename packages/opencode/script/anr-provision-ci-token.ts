#!/usr/bin/env bun
/**
 * Provision a long-lived Cognito refresh token for ANR CI token auth.
 *
 * Runs the standard interactive OIDC/PKCE login once and prints the resulting
 * refresh token so it can be stored as the ANR_REFRESH_TOKEN GitHub Actions
 * secret (see docs/anr-token-auth.md). Re-run whenever the stored token
 * expires or is revoked.
 *
 * Usage:
 *   bun run script/anr-provision-ci-token.ts [path/to/.env.flavor]
 *
 * e.g. from packages/opencode:
 *   bun run script/anr-provision-ci-token.ts ../../.opencode/.env.commercial
 *
 * The auth URL is printed rather than auto-opened so the login can be
 * completed in a private/incognito window as the CI service account —
 * an existing hosted-UI session in the default browser would otherwise
 * silently mint a token for the wrong user.
 */
import { getValidatedANRConfig, authenticateWithOIDC } from "@opencode-ai/anr-core"

// Desktop mode makes authenticateWithOIDC print "auth-url:<url>" to stderr
// instead of opening the default browser.
process.env.OPENCODE_CLIENT = "desktop"

const config = await getValidatedANRConfig(process.argv[2], false)

console.error("ANR CI refresh-token provisioning")
console.error(`  provider domain: ${config.providerDomain}`)
console.error(`  app client:      ${config.clientId}`)
console.error("")
console.error("An auth-url line will appear below. Open that URL in a PRIVATE/incognito")
console.error("window and log in as the CI service account (not your own user).")
console.error("Waiting for login callback on http://localhost:8400 ...")
console.error("")

const tokens = await authenticateWithOIDC(config)

if (!tokens.refreshToken) {
  console.error("❌ Login succeeded but Cognito returned no refresh token.")
  console.error("   Check that the app client has ALLOW_REFRESH_TOKEN_AUTH enabled.")
  process.exit(1)
}

console.error("✅ Login complete. Refresh token follows on stdout (single line):")
console.error("")
console.log(tokens.refreshToken)
console.error("")
console.error("Next steps:")
console.error("  1. Store it: repo Settings → Secrets and variables → Actions →")
console.error("     new secret ANR_REFRESH_TOKEN (or: gh secret set ANR_REFRESH_TOKEN)")
console.error("  2. Clear this terminal / your clipboard afterwards.")
console.error("  3. Token lifetime = the app client's refresh token expiration at the")
console.error("     time of this login. Set a reminder to re-provision before then.")
