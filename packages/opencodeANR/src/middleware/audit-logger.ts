/**
 * DynamoDB Audit Logger for ANR OpenCode
 * Logs all significant events to DynamoDB for compliance
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import type { ANRConfig } from "../config/types"
import { randomUUID } from "crypto"

export interface AuditEvent {
  eventId: string
  userId: string
  eventType: string
  action: string
  resource?: string
  result: "success" | "failure" | "denied"
  metadata?: Record<string, unknown>
  timestamp: string
  ttl?: number
}

let dynamoClient: DynamoDBDocumentClient | null = null

/**
 * Initialize DynamoDB client for audit logging
 */
export function initializeAuditLogger(config: ANRConfig): void {
  const client = new DynamoDBClient({
    region: config.awsRegion,
  })

  dynamoClient = DynamoDBDocumentClient.from(client)
  console.log("✅ Audit logger initialized")
}

/**
 * Log an audit event to DynamoDB
 */
export async function logAuditEvent(
  config: ANRConfig,
  event: Omit<AuditEvent, "eventId" | "timestamp" | "ttl">
): Promise<void> {
  if (!dynamoClient) {
    console.warn("⚠️  Audit logger not initialized, skipping event")
    return
  }

  try {
    const now = new Date()
    const ttl = Math.floor(now.getTime() / 1000) + 365 * 24 * 60 * 60 // 1 year retention

    const auditEvent: AuditEvent = {
      eventId: randomUUID(),
      timestamp: now.toISOString(),
      ttl,
      ...event,
    }

    await dynamoClient.send(
      new PutCommand({
        TableName: config.auditTableName,
        Item: auditEvent,
      })
    )

    console.log(`📝 Audit log: ${event.eventType} - ${event.action} - ${event.result}`)
  } catch (error) {
    // Don't fail the operation if audit logging fails
    console.error("❌ Failed to write audit log:", error)
  }
}

/**
 * Helper to log session startup
 */
export async function logSessionStart(
  config: ANRConfig,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(config, {
    userId,
    eventType: "session",
    action: "start",
    result: "success",
    metadata: {
      ...metadata,
      model: config.anthropicModel,
      region: config.awsRegion,
    },
  })
}

/**
 * Helper to log session end
 */
export async function logSessionEnd(
  config: ANRConfig,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(config, {
    userId,
    eventType: "session",
    action: "end",
    result: "success",
    metadata,
  })
}

/**
 * Helper to log API call
 */
export async function logAPICall(
  config: ANRConfig,
  userId: string,
  action: string,
  result: AuditEvent["result"],
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(config, {
    userId,
    eventType: "api_call",
    action,
    result,
    metadata,
  })
}

/**
 * Helper to log quota check
 */
export async function logQuotaCheck(
  config: ANRConfig,
  userId: string,
  allowed: boolean,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(config, {
    userId,
    eventType: "quota_check",
    action: "check",
    result: allowed ? "success" : "denied",
    metadata,
  })
}
