/**
 * Demo script to test ANR OpenCode without full AWS setup
 * Shows the initialization flow without requiring real credentials
 */

import { loadANRConfig, validateANRConfig, detectDependenciesFromCode, getMissingDependencies, generateInstallCommand } from "@opencode-ai/anr-core"

console.log("🧪 ANR OpenCode Demo\n")

// Test 1: Show config loading
console.log("1️⃣ Testing configuration loader...")
try {
  const config = await loadANRConfig()
  console.log("   ✅ Config loaded from environment")
  console.log(`   AWS Region: ${config.awsRegion}`)
  console.log(`   Telemetry: ${config.enableTelemetry ? "Enabled" : "Disabled"}`)
  
  const errors = validateANRConfig(config)
  if (errors.length > 0) {
    console.log(`   ⚠️  Missing required config (this is expected without .env):`)
    for (const error of errors.slice(0, 3)) {
      console.log(`      - ${error}`)
    }
    if (errors.length > 3) {
      console.log(`      ... and ${errors.length - 3} more`)
    }
  }
} catch (error) {
  console.log("   ⚠️  Config validation failed (expected without full .env)")
}

console.log()

// Test 2: Show dependency detection
console.log("2️⃣ Testing automatic dependency detection...")
const sampleCode = `
import { useState } from "react"
import { FastifyInstance } from "fastify"
import express from "express"
import lodash from "lodash"
`

const deps = detectDependenciesFromCode(sampleCode, "typescript")
console.log(`   ✅ Detected ${deps.length} dependencies:`)
for (const dep of deps) {
  console.log(`      - ${dep.name}`)
}

const installCmd = generateInstallCommand(deps)
console.log(`   📦 Install command: ${installCmd}`)

console.log()

// Test 3: Show what features are available
console.log("3️⃣ Available ANR features:")
console.log("   ✅ AWS Cognito SSO integration")
console.log("   ✅ OpenTelemetry metrics export")
console.log("   ✅ DynamoDB audit logging")
console.log("   ✅ Quota API enforcement")
console.log("   ✅ Automatic dependency detection")

console.log()
console.log("💡 To run with full features:")
console.log("   1. Copy .env.example to .env")
console.log("   2. Fill in your AWS credentials")
console.log("   3. Run: bun dev:anr")
console.log()
