import { describe, expect, test } from "bun:test"
import { anrClientConfig } from "../src/util/aws-client-config"

describe("anrClientConfig", () => {
  test("returns the Bun/AWS-SDK workaround config defaults", () => {
    expect(anrClientConfig({ region: "us-east-2" })).toEqual({
      region: "us-east-2",
      accountIdEndpointMode: "disabled",
      authSchemePreference: [],
      maxAttempts: 3,
      retryMode: "standard",
      defaultsMode: "standard",
      useDualstackEndpoint: false,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  })

  test("enables FIPS when govcloud is true", () => {
    expect(anrClientConfig({ region: "us-gov-west-1", govcloud: true }).useFipsEndpoint).toBeTrue()
  })
})
