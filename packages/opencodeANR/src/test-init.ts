/**
 * Test script to isolate initialization issues
 */

import { loadANRConfig, authenticateWithOIDC, exchangeTokenForAWSCredentials } from "@opencode-ai/anr-core"

console.log("=== Testing ANR Components ===\n")

// Test 1: Import check
console.log("1. Testing imports...")
try {
  console.log("   ✅ Config loader imported")
} catch (error) {
  console.error("   ❌ Failed to import config loader:", error)
  process.exit(1)
}

// Test 2: Config loading
console.log("\n2. Testing config loading...")
try {
  const config = await loadANRConfig()
  console.log("   ✅ Config loaded")
  console.log(`   Region: ${config.awsRegion}`)
} catch (error) {
  console.error("   ❌ Failed to load config:", error)
}

// Test 3: Test OIDC authentication
console.log("\n3. Testing OIDC authentication...")
try {
  const config = await loadANRConfig()
  const tokens = await authenticateWithOIDC(config)
  console.log("   ✅ OIDC authentication successful")
} catch (error) {
  console.error("   ❌ Authentication failed:")
  console.error("   ", error)
}
