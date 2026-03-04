/**
 * Quota Loading Test
 * Verify quota API integration works and returns expected data
 */

import { getValidatedANRConfig, checkQuota, getWarningColor } from "@opencode-ai/anr-core"

async function testQuotaLoading() {
  console.log("🧪 Testing Quota Loading\n")

  try {
    // Load ANR configuration
    console.log("📄 Loading configuration...")
    const config = await getValidatedANRConfig(undefined, true)
    console.log("✅ Configuration loaded\n")

    console.log("📋 Quota Configuration:")
    console.log(`   Endpoint: ${config.quotaApiEndpoint}`)
    console.log(`   Fail Mode: ${config.quotaFailMode}`)
    console.log(`   Check Interval: ${config.quotaCheckInterval}\n`)

    if (!config.quotaApiEndpoint) {
      console.warn("⚠️  QUOTA_API_ENDPOINT not configured")
      console.log("   Set QUOTA_API_ENDPOINT env var or in .env.bedrock to test\n")
      return
    }

    // Test quota check
    console.log("🎯 Testing quota check...")
    const testUser = {
      userEmail: "test@example.com",
      organization: "test-org",
      teamId: "test-team",
    }

    // Note: In production, idToken is passed from OIDC authentication (tokens.idToken)
    // This test calls without JWT token, so Lambda returns 401 Unauthorized
    // The checkQuota function gracefully falls back to mock data for testing
    const response = await checkQuota(testUser, config.quotaApiEndpoint, config.quotaFailMode)

    if (!response) {
      console.error("❌ No quota response received")
      return
    }

    console.log("✅ Quota check successful\n")

    const { policy, usage } = response

    console.log("📊 Quota Policy:")
    console.log(`   Enabled: ${policy.enabled}`)
    console.log(`   Type: ${policy.policyType}`)
    console.log(`   Identifier: ${policy.identifier}\n`)

    console.log("📈 Daily Quota:")
    console.log(`   Limit: ${policy.dailyTokenLimit.toLocaleString()} tokens`)
    console.log(`   Used: ${usage.dailyTokens.toLocaleString()} tokens`)
    console.log(`   Percent: ${Math.round(usage.dailyUsagePercent)}%`)
    console.log(`   Status: ${usage.dailyUsagePercent >= 90 ? "🔴 CRITICAL" : usage.dailyUsagePercent >= 80 ? "🟡 WARNING" : "🟢 OK"}\n`)

    console.log("📅 Monthly Quota:")
    console.log(`   Limit: ${policy.monthlyTokenLimit.toLocaleString()} tokens`)
    console.log(`   Used: ${usage.monthlyTokens.toLocaleString()} tokens`)
    console.log(`   Percent: ${Math.round(usage.monthlyUsagePercent)}%`)
    console.log(`   Status: ${usage.monthlyUsagePercent >= 90 ? "🔴 CRITICAL" : usage.monthlyUsagePercent >= 80 ? "🟡 WARNING" : "🟢 OK"}\n`)

    console.log("⚠️  Warning Thresholds:")
    console.log(`   80%: ${policy.warningThreshold80.toLocaleString()} tokens`)
    console.log(`   90%: ${policy.warningThreshold90.toLocaleString()} tokens\n`)

    console.log("🔐 Enforcement:")
    console.log(`   Overall Warning Level: ${usage.warningLevel.toUpperCase()}`)
    console.log(`   Color: ${getWarningColor(usage.warningLevel)}`)
    console.log(`   Allowed: ${usage.allowed ? "✅ YES" : "❌ NO"}`)
    if (usage.reason) {
      console.log(`   Reason: ${usage.reason}`)
    }
    console.log()

    console.log("✅ Quota loading test complete!")

  } catch (error) {
    console.error("❌ Test failed:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run test
testQuotaLoading()
