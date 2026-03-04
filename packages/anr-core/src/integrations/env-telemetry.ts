/**
 * Helper to reconstruct telemetry context from environment variables
 * Used by OpenCode subprocess to sync context with ANR wrapper
 */

import type { TelemetryContext } from "./otel"

/**
 * Reconstruct telemetry context from OPENCODE_ANR_* environment variables
 * Called by OpenCode to sync telemetry context set by ANR wrapper
 */
export function reconstructTelemetryContextFromEnv(): TelemetryContext | null {
  // Check if any ANR telemetry vars are set
  const userId = process.env.OPENCODE_ANR_USER_ID
  if (!userId) return null

  return {
    userId,
    userEmail: process.env.OPENCODE_ANR_USER_EMAIL || undefined,
    userName: process.env.OPENCODE_ANR_USER_NAME || undefined,
    osType: process.env.OPENCODE_ANR_OS_TYPE || undefined,
    osVersion: process.env.OPENCODE_ANR_OS_VERSION || undefined,
    hostArch: undefined, // Not passed via env to child process
    terminalType: process.env.OPENCODE_ANR_TERMINAL_TYPE || undefined,
    sessionId: process.env.OPENCODE_ANR_SESSION_ID || undefined,
    department: process.env.OPENCODE_ANR_DEPARTMENT || undefined,
    teamId: process.env.OPENCODE_ANR_TEAM_ID || undefined,
    costCenter: process.env.OPENCODE_ANR_COST_CENTER || undefined,
    manager: process.env.OPENCODE_ANR_MANAGER || undefined,
    role: process.env.OPENCODE_ANR_ROLE || undefined,
    location: process.env.OPENCODE_ANR_LOCATION || undefined,
    organization: process.env.OPENCODE_ANR_ORGANIZATION || undefined,
    accountId: process.env.OPENCODE_ANR_ACCOUNT_ID || undefined,
  }
}

/**
 * Check if OpenCode is running under ANR wrapper (telemetry enabled)
 */
export function isUnderANRWrapper(): boolean {
  return process.env.OPENCODE_ENABLE_TELEMETRY === "1" || process.env.OPENCODE_ANR_USER_ID !== undefined
}
