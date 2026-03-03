/**
 * Test script to isolate initialization issues
 */

console.log("=== Testing ANR Components ===\n")

// Test 1: Import check
console.log("1. Testing imports...")
try {
  const { loadANRConfig } = await import("./config/env-loader.js")
  console.log("   ✅ Config loader imported")
} catch (error) {
  console.error("   ❌ Failed to import config loader:", error)
  process.exit(1)
}

// Test 2: Config loading
console.log("\n2. Testing config loading...")
try {
  const { loadANRConfig } = await import("./config/env-loader.js")
  const config = await loadANRConfig()
  console.log("   ✅ Config loaded")
  console.log(`   Region: ${config.awsRegion}`)
} catch (error) {
  console.error("   ❌ Failed to load config:", error)
}

// Test 3: Start full initialization
console.log("\n3. Testing full initialization...")
try {
  const { startANRCLI } = await import("./index.js")
  await startANRCLI()
} catch (error) {
  console.error("   ❌ Initialization failed:")
  console.error("   ", error)
}
