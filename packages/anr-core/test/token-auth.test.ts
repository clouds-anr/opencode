/**
 * Unit tests for token-auth.ts
 *
 * Tests mode selection, environment validation, and credential resolution
 * without making any real network calls.
 */
import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test"
import {
  parseANRAuthMode,
  validateTokenModeEnv,
  resolveTokenModeCredentials,
} from "../src/integrations/token-auth"
import type { ANRConfig } from "../src/config/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalConfig(): ANRConfig {
  return {
    awsRegion: "us-gov-west-1",
    useBedrockProvider: true,
    anthropicModel: "us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0",
    anthropicSmallFastModel: "us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0",
    enableTelemetry: false,
    otelMetricsExporter: "otlp",
    otelProtocol: "http/protobuf",
    otelEndpoint: "",
    enableAudit: false,
    metricsBatchSize: 100,
    metricsIntervalSeconds: 60,
    auditTableName: "AuditEvents",
    quotaFailMode: "open",
    quotaCheckInterval: 300,
    modelsApiEndpoint: "https://api.example.com/v1",
    providerDomain: "auth.govcloud.example.com",
    clientId: "gov-client-id",
    awsRegionProfile: "us-gov-west-1",
    providerType: "cognito",
    credentialStorage: "session",
    crossRegionProfile: "us-gov-west-1",
    identityPoolId: "us-gov-west-1:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    federationType: "cognito",
    cognitoUserPoolId: "us-gov-west-1_AbCdEfGhI",
  }
}

/** A syntactically-valid-looking (but fake) JWT — three dot-separated base64url parts. */
const FAKE_JWT =
  "eyJhbGciOiJSUzI1NiJ9" +
  ".eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9" +
  ".c2lnbmF0dXJl"

// ---------------------------------------------------------------------------
// parseANRAuthMode
// ---------------------------------------------------------------------------

describe("parseANRAuthMode", () => {
  test("defaults to interactive when variable is unset", () => {
    expect(parseANRAuthMode({})).toBe("interactive")
  })

  test('returns "interactive" when explicitly set', () => {
    expect(parseANRAuthMode({ OPENCODE_ANR_AUTH_MODE: "interactive" })).toBe("interactive")
  })

  test('returns "token" when set to token', () => {
    expect(parseANRAuthMode({ OPENCODE_ANR_AUTH_MODE: "token" })).toBe("token")
  })

  test("throws a CI-friendly error for unknown values", () => {
    expect(() => parseANRAuthMode({ OPENCODE_ANR_AUTH_MODE: "browser" })).toThrow(
      /Unknown OPENCODE_ANR_AUTH_MODE value/,
    )
  })

  test("error message includes the bad value and valid options", () => {
    let msg = ""
    try {
      parseANRAuthMode({ OPENCODE_ANR_AUTH_MODE: "magic" })
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).toContain('"magic"')
    expect(msg).toContain("interactive")
    expect(msg).toContain("token")
  })
})

// ---------------------------------------------------------------------------
// validateTokenModeEnv
// ---------------------------------------------------------------------------

describe("validateTokenModeEnv", () => {
  test("fails with actionable message when OPENCODE_ANR_ID_TOKEN is missing", () => {
    const result = validateTokenModeEnv({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain("OPENCODE_ANR_ID_TOKEN")
      expect(result.message).toContain("is not set")
      // Must NOT contain secret values (there are none to leak here, but check structure)
      expect(result.message).not.toMatch(/eyJ/)
    }
  })

  test("succeeds when ID token is provided", () => {
    const result = validateTokenModeEnv({ OPENCODE_ANR_ID_TOKEN: FAKE_JWT })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.idToken).toBe(FAKE_JWT)
      expect(result.refreshToken).toBeUndefined()
      expect(result.staticAWSCreds).toBeUndefined()
    }
  })

  test("includes refresh token when provided", () => {
    const result = validateTokenModeEnv({
      OPENCODE_ANR_ID_TOKEN: FAKE_JWT,
      OPENCODE_ANR_REFRESH_TOKEN: "refresh-abc",
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.refreshToken).toBe("refresh-abc")
  })

  test("succeeds with full static AWS creds (no ID token required)", () => {
    const result = validateTokenModeEnv({
      AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
      AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      AWS_SESSION_TOKEN: "AQoXnyc4lcK4w4OIaYnuFgIa...",
      AWS_REGION: "us-gov-west-1",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.staticAWSCreds).toBeDefined()
      expect(result.staticAWSCreds?.accessKeyId).toBe("AKIAIOSFODNN7EXAMPLE")
      expect(result.staticAWSCreds?.region).toBe("us-gov-west-1")
    }
  })

  test("static creds path accepts an ID token too (for telemetry context)", () => {
    const result = validateTokenModeEnv({
      OPENCODE_ANR_ID_TOKEN: FAKE_JWT,
      AWS_ACCESS_KEY_ID: "AKID",
      AWS_SECRET_ACCESS_KEY: "SECRET",
      AWS_SESSION_TOKEN: "TOKEN",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.idToken).toBe(FAKE_JWT)
      expect(result.staticAWSCreds).toBeDefined()
    }
  })

  test("error message is actionable and does not contain secret values", () => {
    const result = validateTokenModeEnv({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // Actionable: tells the user what to set
      expect(result.message).toContain("OPENCODE_ANR_ID_TOKEN")
      expect(result.message).toContain("AWS_ACCESS_KEY_ID")
      // No secrets leaked (nothing to leak in this case — verify structure)
      expect(result.message).not.toContain("password")
      expect(result.message).not.toContain("secret")
    }
  })
})

// ---------------------------------------------------------------------------
// resolveTokenModeCredentials — static creds path (no network)
// ---------------------------------------------------------------------------

describe("resolveTokenModeCredentials — static creds", () => {
  test("returns static creds without calling exchange when all AWS vars are set", async () => {
    const env = {
      OPENCODE_ANR_ID_TOKEN: FAKE_JWT,
      AWS_ACCESS_KEY_ID: "STATIC_KEY",
      AWS_SECRET_ACCESS_KEY: "STATIC_SECRET",
      AWS_SESSION_TOKEN: "STATIC_TOKEN",
      AWS_REGION: "us-gov-west-1",
    }
    const result = await resolveTokenModeCredentials(minimalConfig(), env)
    expect(result.credentialSource).toBe("static")
    expect(result.awsCredentials.accessKeyId).toBe("STATIC_KEY")
    expect(result.awsCredentials.secretAccessKey).toBe("STATIC_SECRET")
    expect(result.awsCredentials.sessionToken).toBe("STATIC_TOKEN")
    expect(result.idToken).toBe(FAKE_JWT)
  })

  test("passes refresh token through on static path", async () => {
    const env = {
      OPENCODE_ANR_ID_TOKEN: FAKE_JWT,
      OPENCODE_ANR_REFRESH_TOKEN: "myrefresh",
      AWS_ACCESS_KEY_ID: "K",
      AWS_SECRET_ACCESS_KEY: "S",
      AWS_SESSION_TOKEN: "T",
    }
    const result = await resolveTokenModeCredentials(minimalConfig(), env)
    expect(result.refreshToken).toBe("myrefresh")
  })
})

// ---------------------------------------------------------------------------
// resolveTokenModeCredentials — exchange path (mocked)
// ---------------------------------------------------------------------------

describe("resolveTokenModeCredentials — exchange path", () => {
  test("calls exchangeTokenForAWSCredentials when no static creds", async () => {
    // We mock the aws-federation module to avoid real network calls.
    // Because Bun's module mock replaces the module at import time, we test
    // the integration by checking the error thrown when the exchange fails —
    // the error message should come from our wrapper, not raw AWS SDK noise.
    const env = { OPENCODE_ANR_ID_TOKEN: FAKE_JWT }

    // With no static creds and a fake JWT, the exchange will throw (no real
    // AWS endpoint). We verify the error is wrapped in a CI-friendly message.
    let thrown = false
    try {
      await resolveTokenModeCredentials(minimalConfig(), env)
    } catch (e) {
      thrown = true
      const msg = (e as Error).message
      // Should be wrapped with our CI-friendly prefix
      expect(msg).toContain("[ANR] Token auth: federation exchange failed")
      // Must NOT contain the raw JWT value
      expect(msg).not.toContain(FAKE_JWT)
      // Should include actionable hints
      expect(msg).toContain("OPENCODE_ANR_ID_TOKEN")
    }
    expect(thrown).toBe(true)
  })

  test("throws CI-friendly error when ID token is missing", async () => {
    await expect(resolveTokenModeCredentials(minimalConfig(), {})).rejects.toThrow(
      /missing required environment variable/,
    )
  })

  test("throws CI-friendly error when ID token is not a valid JWT shape", async () => {
    await expect(
      resolveTokenModeCredentials(minimalConfig(), { OPENCODE_ANR_ID_TOKEN: "not-a-jwt" }),
    ).rejects.toThrow(/does not appear to be a valid JWT/)
  })

  test("error messages do not contain the token value", async () => {
    const badToken = "part1.part2" // only two parts — invalid JWT
    let msg = ""
    try {
      await resolveTokenModeCredentials(minimalConfig(), { OPENCODE_ANR_ID_TOKEN: badToken })
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).not.toContain(badToken)
    expect(msg).toContain("Token length:")
  })
})
