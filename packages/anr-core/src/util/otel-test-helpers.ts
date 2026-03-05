/**
 * OTEL Test Helpers
 * Utility functions for OTEL testing
 */

import type { ANRConfig } from "../config/types"
import { v4 as uuid } from "uuid"

/**
 * Get or create telemetry context for testing
 */
export function getTelemetryContext(config: ANRConfig) {
  return {
    userId: (process.env.TEST_USER_ID || "test-user-" + uuid()).substring(0, 36),
    userEmail: process.env.TEST_USER_EMAIL || "test@example.com",
    sessionId: uuid(),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Extract user info from OIDC token
 */
export function extractUserFromToken(token: string): { userId?: string; email?: string } {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return {}

    const payload = parts[1]
    const decoded = Buffer.from(payload, "base64").toString("utf-8")
    const claims = JSON.parse(decoded)

    return {
      userId: claims.sub || claims.cognito_username,
      email: claims.email,
    }
  } catch {
    return {}
  }
}

/**
 * Format OTEL metrics for logging
 */
export function formatOTELMetrics(payload: any): string {
  const resourceCount = payload.resourceMetrics?.length || 0
  const scopeCount = payload.resourceMetrics?.[0]?.scopeMetrics?.length || 0
  const metricCount = payload.resourceMetrics?.[0]?.scopeMetrics?.[0]?.metrics?.length || 0

  return `
📊 OTEL Metrics:
   Resources: ${resourceCount}
   Scopes: ${scopeCount}
   Metrics: ${metricCount}
   Total size: ${JSON.stringify(payload).length} bytes
  `
}

/**
 * Format HTTP response for logging
 */
export function formatHTTPResponse(status: number, statusText: string, body: any): string {
  return `
📥 HTTP Response:
   Status: ${status} ${statusText}
   Body: ${typeof body === "string" ? body : JSON.stringify(body, null, 2)}
  `
}
