/**
 * Example test for ANR OpenCode integrations
 */

import { describe, test, expect, beforeAll } from "bun:test"
import { loadANRConfig, validateANRConfig } from "../src/config/env-loader"
import { detectDependenciesFromCode, getMissingDependencies } from "../src/middleware/dependency-detector"

describe("ANR Config Loader", () => {
  test("should load config from environment", async () => {
    // Set test env vars
    process.env.AWS_PROFILE = "test-profile"
    process.env.AWS_REGION = "us-east-2"
    process.env.ANTHROPIC_MODEL = "test-model"
    process.env.QUOTA_API_ENDPOINT = "https://test.example.com"
    process.env.PROVIDER_DOMAIN = "test.example.com"
    process.env.CLIENT_ID = "test-client"
    process.env.IDENTITY_POOL_ID = "test-pool"
    process.env.COGNITO_USER_POOL_ID = "test-user-pool"
    process.env.AUDIT_TABLE_NAME = "test-table"

    // Pass non-existent path to skip file loading and use env vars only
    const config = await loadANRConfig("/non-existent/.env")
    expect(config.awsProfile).toBe("test-profile")
    expect(config.awsRegion).toBe("us-east-2")
  })

  test("should validate required fields", () => {
    const invalidConfig = {
      awsProfile: "",
      awsRegion: "us-east-2",
    } as any

    const errors = validateANRConfig(invalidConfig)
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe("Dependency Detector", () => {
  test("should detect ES6 imports", () => {
    const code = `
      import { foo } from "some-package"
      import bar from "another-package"
    `

    const deps = detectDependenciesFromCode(code, "typescript")
    expect(deps.some(d => d.name === "some-package")).toBe(true)
    expect(deps.some(d => d.name === "another-package")).toBe(true)
  })

  test("should detect CommonJS requires", () => {
    const code = `
      const fs = require("fs")
      const express = require("express")
    `

    const deps = detectDependenciesFromCode(code, "javascript")
    expect(deps.some(d => d.name === "fs")).toBe(true)
    expect(deps.some(d => d.name === "express")).toBe(true)
  })

  test("should not detect relative imports", () => {
    const code = `
      import { foo } from "./local-file"
      import bar from "../parent-file"
    `

    const deps = detectDependenciesFromCode(code, "typescript")
    expect(deps.length).toBe(0)
  })
})
