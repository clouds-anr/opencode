/**
 * Quota API Middleware for ANR OpenCode
 * Enforces usage policies via centralized quota API
 */

import type { ANRConfig } from "../config/types"

export interface QuotaCheckRequest {
  userId: string
  action: string
  resourceType: "tokens" | "requests" | "session"
  amount?: number
  metadata?: Record<string, unknown>
}

export interface QuotaCheckResponse {
  allowed: boolean
  reason?: string
  remainingQuota?: number
  resetAt?: string
}

/**
 * Check quota with the ANR Quota API
 */
export async function checkQuota(
  config: ANRConfig,
  request: QuotaCheckRequest
): Promise<QuotaCheckResponse> {
  try {
    const response = await fetch(`${config.quotaApiEndpoint}/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Quota API returned ${response.status}: ${response.statusText}`)
    }

    return await response.json() as QuotaCheckResponse
  } catch (error) {
    console.error("❌ Quota check failed:", error)

    // Handle fail mode
    if (config.quotaFailMode === "closed") {
      // Fail closed - deny access on error
      return {
        allowed: false,
        reason: "Quota API unavailable (fail-closed mode)",
      }
    } else {
      // Fail open - allow access on error
      console.warn("⚠️  Quota API unavailable, allowing access (fail-open mode)")
      return {
        allowed: true,
        reason: "Quota API unavailable (fail-open mode)",
      }
    }
  }
}

/**
 * Middleware wrapper for quota enforcement
 */
export function createQuotaMiddleware(config: ANRConfig) {
  return async function quotaMiddleware(
    userId: string,
    action: string,
    resourceType: QuotaCheckRequest["resourceType"],
    amount: number = 1
  ): Promise<void> {
    const result = await checkQuota(config, {
      userId,
      action,
      resourceType,
      amount,
      metadata: {
        timestamp: new Date().toISOString(),
        region: config.awsRegion,
      },
    })

    if (!result.allowed) {
      throw new QuotaExceededError(
        result.reason || "Quota exceeded",
        result.remainingQuota,
        result.resetAt
      )
    }

    if (result.remainingQuota !== undefined) {
      console.log(`📊 Quota remaining: ${result.remainingQuota}`)
    }
  }
}

/**
 * Custom error for quota violations
 */
export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public remainingQuota?: number,
    public resetAt?: string
  ) {
    super(message)
    this.name = "QuotaExceededError"
  }
}

/**
 * Track usage with the quota API (fire and forget)
 */
export async function trackUsage(
  config: ANRConfig,
  request: Omit<QuotaCheckRequest, "metadata"> & { metadata?: Record<string, unknown> }
): Promise<void> {
  try {
    await fetch(`${config.quotaApiEndpoint}/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request,
        metadata: {
          ...request.metadata,
          timestamp: new Date().toISOString(),
          region: config.awsRegion,
        },
      }),
    })
  } catch (error) {
    // Don't throw - this is best-effort tracking
    console.warn("⚠️  Failed to track usage:", error)
  }
}
