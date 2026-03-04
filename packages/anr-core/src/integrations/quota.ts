import type { TelemetryContext } from "./otel"

export interface QuotaPolicy {
  enabled: boolean
  identifier: string // user email, org, or team id
  policyType: "default" | "organization" | "team" | "user"
  
  dailyTokenLimit: number
  monthlyTokenLimit: number
  
  dailyEnforcementMode: "alert" | "block"
  monthlyEnforcementMode: "alert" | "block"
  enforcementMode: "alert" | "block" // fallback for both
  
  warningThreshold80: number
  warningThreshold90: number
}

export interface QuotaUsage {
  dailyTokens: number
  monthlyTokens: number
  dailyUsagePercent: number
  monthlyUsagePercent: number
  warningLevel: "normal" | "warning" | "critical" // yellow at 80%, red at 90%
  allowed: boolean
  reason?: string
}

export interface QuotaCheckRequest {
  userEmail: string
  organization?: string
  teamId?: string
  requestedTokens?: number
}

export interface QuotaCheckResponse {
  policy: QuotaPolicy
  usage: QuotaUsage
}

const policyCache = new Map<string, { policy: QuotaPolicy; timestamp: number }>()
const CACHE_TTL = 3600_000 // 1 hour

function getCacheKey(req: QuotaCheckRequest): string {
  return `${req.userEmail}#${req.organization || ""}#${req.teamId || ""}`
}

function extractJWTClaims(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return {}
    const payload = parts[1]
    if (!payload) return {}
    return JSON.parse(Buffer.from(payload, "base64").toString())
  } catch {
    return {}
  }
}

function calculateWarningLevel(dailyPercent: number, monthlyPercent: number): "normal" | "warning" | "critical" {
  const maxPercent = Math.max(dailyPercent, monthlyPercent)
  if (maxPercent >= 90) return "critical"
  if (maxPercent >= 80) return "warning"
  return "normal"
}

export async function checkQuota(
  req: QuotaCheckRequest,
  endpoint: string,
  failMode: "closed" | "open",
  idToken?: string
): Promise<QuotaCheckResponse | null> {
  if (!endpoint) {
    console.warn("❌ QUOTA_API_ENDPOINT not configured")
    return failMode === "open" ? mockQuotaResponse() : null
  }

  const cacheKey = getCacheKey(req)
  const cached = policyCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Quota cache hit for ${req.userEmail}`)
    return buildQuotaUsage(cached.policy, req)
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Add JWT bearer token for API Gateway JWT Authorizer validation
    // The Lambda extracts email from JWT claims, not query parameters
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`
      console.log(`🔐 JWT token present (${idToken.length} chars)`)
      
      // Extract and log JWT claims for debugging
      const claims = extractJWTClaims(idToken)
      if (Object.keys(claims).length > 0) {
        console.log(`   Email: ${claims.email}`)
        if (claims['cognito:groups']) {
          console.log(`   Groups: ${Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'].join(', ') : claims['cognito:groups']}`)
        }
        if (claims['custom:department']) {
          console.log(`   Department: ${claims['custom:department']}`)
        }
      }
    } else {
      console.warn("⚠️  No JWT token provided - API will return 401")
    }

    // Construct endpoint with /check path for Lambda function
    const url = `${endpoint.replace(/\/$/, "")}/check`
    console.log(`📡 Calling quota API: ${url.replace(/https:\/\//, "").split("/")[0]}...`)

    const response = await fetch(url, {
      method: "GET",
      headers,
    })

    if (!response.ok) {
      console.warn(`⚠️  Quota API returned ${response.status}. Using fallback data.`)
      // Always return mock data on API error for testing
      return mockQuotaResponse()
    }

    // API Gateway returns { statusCode, body: JSON.stringify(...) }
    const data = (await response.json()) as Record<string, unknown>
    console.log(`✅ Quota API responded with status ${response.status}`)
    
    // If response has a body field (API Gateway format), parse it
    const responseBody = typeof data?.body === "string" ? JSON.parse(data.body) : data
    
    // Parse complete Lambda response (includes usage, policy, allowed status, etc.)
    const quotaResponse = parseLambdaQuotaResponse(responseBody)
    
    if (quotaResponse) {
      const policy = quotaResponse.policy
      console.log(`📋 Quota policy parsed: ${policy.monthlyTokenLimit} tokens/month limit`)
      policyCache.set(cacheKey, { policy, timestamp: Date.now() })
      return quotaResponse
    }

    return failMode === "open" ? mockQuotaResponse() : null
  } catch (error) {
    console.warn(`❌ Quota API error: ${error instanceof Error ? error.message : String(error)}`)
    // Always return mock data on error for testing
    return mockQuotaResponse()
  }
}

function parseQuotaPolicy(data: unknown): QuotaPolicy | null {
  try {
    // Cast to any for property access, then safely extract with null coalescing
    const d = data as Record<string, unknown> | undefined
    if (!d) return null
    
    // Handle Lambda response format which includes usage and allowed status
    // Lambda returns: { allowed, usage: {...}, policy: {...}, reason, message }
    
    // Extract policy metadata
    const policyData = (d.policy as Record<string, unknown>) || d
    
    // Extract limits from usage field (where Lambda puts them)
    const usage = (d.usage as Record<string, unknown>) || {}
    
    // Get limits from usage field first, fall back to root level
    const dailyLimit = parseInt(String(usage.daily_limit ?? d.daily_token_limit ?? d.dailyTokenLimit ?? "0"))
    const monthlyLimit = parseInt(String(usage.monthly_limit ?? d.monthly_token_limit ?? d.monthlyTokenLimit ?? "0"))
    
    // Default values when policy data is minimal
    return {
      enabled: (d.enabled as boolean) ?? true,
      identifier: (policyData.identifier as string) ?? "default",
      policyType: ((policyData.type as string) ?? (policyData.policy_type as string) ?? "default") as "default" | "organization" | "team" | "user",
      dailyTokenLimit: dailyLimit,
      monthlyTokenLimit: monthlyLimit,
      dailyEnforcementMode: ((d.daily_enforcement_mode as string) ?? (d.dailyEnforcementMode as string) ?? "alert") as "alert" | "block",
      monthlyEnforcementMode: ((d.monthly_enforcement_mode as string) ?? (d.monthlyEnforcementMode as string) ?? "block") as "alert" | "block",
      enforcementMode: ((d.enforcement_mode as string) ?? (d.enforcementMode as string) ?? "block") as "alert" | "block",
      warningThreshold80: parseInt(String(d.warning_threshold_80 ?? d.warningThreshold80 ?? "0")),
      warningThreshold90: parseInt(String(d.warning_threshold_90 ?? d.warningThreshold90 ?? "0")),
    }
  } catch {
    return null
  }
}

/**
 * Parse complete Lambda quota response including actual usage data
 */
function parseLambdaQuotaResponse(data: unknown): QuotaCheckResponse | null {
  try {
    const d = data as Record<string, unknown> | undefined
    if (!d) return null
    
    // Parse policy metadata
    const policy = parseQuotaPolicy(d)
    if (!policy) return null
    
    // Extract actual usage data from Lambda response
    const usageData = (d.usage as Record<string, unknown>) || {}
    const dailyTokens = parseInt(String(usageData.daily_tokens ?? "0"))
    const monthlyTokens = parseInt(String(usageData.monthly_tokens ?? "0"))
    
    // Calculate percentages based on actual usage
    const dailyPercent = policy.dailyTokenLimit > 0 ? (dailyTokens / policy.dailyTokenLimit) * 100 : 0
    const monthlyPercent = policy.monthlyTokenLimit > 0 ? (monthlyTokens / policy.monthlyTokenLimit) * 100 : 0
    
    // Determine if access is allowed
    const allowed = (d.allowed as boolean) ?? true
    
    return {
      policy,
      usage: {
        allowed,
        dailyTokens,
        monthlyTokens,
        dailyUsagePercent: dailyPercent,
        monthlyUsagePercent: monthlyPercent,
        warningLevel: calculateWarningLevel(dailyPercent, monthlyPercent),
        reason: (d.reason as string) || "unknown",
      },
    }
  } catch {
    return null
  }
}

function buildQuotaUsage(policy: QuotaPolicy, req: QuotaCheckRequest): QuotaCheckResponse {
  if (!policy.enabled) {
    return {
      policy,
      usage: {
        allowed: true,
        dailyTokens: 0,
        monthlyTokens: 0,
        dailyUsagePercent: 0,
        monthlyUsagePercent: 0,
        warningLevel: "normal",
      },
    }
  }

  // Calculate usage percentages. In production, these would come from the API response.
  // For now, we assume the API returns the policy with usage data included.
  const dailyPercent = policy.dailyTokenLimit > 0 ? (req.requestedTokens ?? 0) / policy.dailyTokenLimit * 100 : 0
  const monthlyPercent = policy.monthlyTokenLimit > 0 ? (req.requestedTokens ?? 0) / policy.monthlyTokenLimit * 100 : 0
  const warningLevel = calculateWarningLevel(dailyPercent, monthlyPercent)

  const blocked = 
    (policy.dailyEnforcementMode === "block" && dailyPercent >= 100) ||
    (policy.monthlyEnforcementMode === "block" && monthlyPercent >= 100)

  return {
    policy,
    usage: {
      allowed: !blocked,
      dailyTokens: req.requestedTokens ?? 0,
      monthlyTokens: req.requestedTokens ?? 0,
      dailyUsagePercent: Math.min(dailyPercent, 100),
      monthlyUsagePercent: Math.min(monthlyPercent, 100),
      warningLevel,
      reason: blocked ? "Token quota exceeded" : undefined,
    },
  }
}

function mockQuotaResponse(): QuotaCheckResponse {
  const policy: QuotaPolicy = {
    enabled: true,
    identifier: "default",
    policyType: "default",
    dailyTokenLimit: 50_000_000, // 50M daily
    monthlyTokenLimit: 250_000_000, // 250M monthly
    dailyEnforcementMode: "alert",
    monthlyEnforcementMode: "block",
    enforcementMode: "block",
    warningThreshold80: 40_000_000, // 80% of 50M
    warningThreshold90: 45_000_000, // 90% of 50M
  }

  // Simulate user at 35% daily, 28% monthly usage
  const dailyTokens = 17_500_000 // 35% of 50M
  const monthlyTokens = 70_000_000 // 28% of 250M

  return {
    policy,
    usage: {
      allowed: true,
      dailyTokens,
      monthlyTokens,
      dailyUsagePercent: 35,
      monthlyUsagePercent: 28,
      warningLevel: "normal",
    },
  }
}

export function getWarningColor(level: "normal" | "warning" | "critical"): string {
  return {
    normal: "green",
    warning: "yellow",
    critical: "red",
  }[level]
}
