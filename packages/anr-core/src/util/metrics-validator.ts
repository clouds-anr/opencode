/**
 * OTEL metrics validation and preview utilities
 */

import type { TelemetryContext } from "../integrations/otel"
import { debugLogger } from "./debug-logger"

export interface MetricValidationResult {
  valid: boolean
  issues: string[]
  warnings: string[]
  suggestions: string[]
}

export interface ContextValidationResult {
  complete: boolean
  provided: Record<string, boolean>
  missing: string[]
  score: number // 0-1
}

export interface MetricsPreview {
  metric: string
  description: string
  attributes: Record<string, string | number>
  value?: number | string
  timestamp?: string
}

const REQUIRED_CONTEXT_FIELDS = ["userId", "sessionId"]

const OPTIONAL_CONTEXT_FIELDS = [
  "userEmail",
  "userName",
  "department",
  "teamId",
  "organization",
  "osType",
  "osVersion",
  "hostArch",
]

/**
 * Validate telemetry context completeness
 */
export function validateContext(context: TelemetryContext | null): ContextValidationResult {
  if (!context) {
    return {
      complete: false,
      provided: {},
      missing: [...REQUIRED_CONTEXT_FIELDS, ...OPTIONAL_CONTEXT_FIELDS],
      score: 0,
    }
  }

  const provided: Record<string, boolean> = {}
  const missing: string[] = []

  // Check required fields
  for (const field of REQUIRED_CONTEXT_FIELDS) {
    const value = (context as any)[field]
    const hasValue = !!value && value !== "unknown"
    provided[field] = hasValue
    if (!hasValue) {
      missing.push(field)
    }
  }

  // Check optional fields
  for (const field of OPTIONAL_CONTEXT_FIELDS) {
    const value = (context as any)[field]
    const hasValue = !!value
    provided[field] = hasValue
    if (!hasValue) {
      missing.push(field)
    }
  }

  const totalFields = [...REQUIRED_CONTEXT_FIELDS, ...OPTIONAL_CONTEXT_FIELDS].length
  const providedCount = Object.values(provided).filter((v) => v).length
  const score = providedCount / totalFields

  return {
    complete: missing.filter((f) => REQUIRED_CONTEXT_FIELDS.includes(f)).length === 0,
    provided,
    missing,
    score,
  }
}

/**
 * Validate metric attributes
 */
export function validateMetricAttributes(
  attributes: Record<string, any>,
  context: TelemetryContext | null
): MetricValidationResult {
  const issues: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []

  // Check for empty attributes
  if (!attributes || Object.keys(attributes).length === 0) {
    warnings.push("Metric has no attributes - consider adding context dimensions")
  }

  // Check for invalid attribute names
  for (const key of Object.keys(attributes)) {
    if (!/^[a-z0-9_.]*$/.test(key)) {
      issues.push(`Invalid attribute name: "${key}" - must contain only lowercase alphanumerics, dots, and underscores`)
    }

    // Warn about common misconfigurations
    if (key.includes("ID") && !key.includes("_id")) {
      suggestions.push(`Consider renaming "${key}" to use snake_case: "${key.toLowerCase()}"`)
    }
  }

  // Check context availability
  const contextValidation = validateContext(context)
  if (contextValidation.score < 0.5) {
    warnings.push(
      `Context is only ${(contextValidation.score * 100).toFixed(0)}% complete - metrics may lack important dimensions`
    )
    suggestions.push(`Missing fields: ${contextValidation.missing.slice(0, 3).join(", ")}`)
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    suggestions,
  }
}

/**
 * Format metric preview for display
 */
export function formatMetricPreview(preview: MetricsPreview): string {
  const lines: string[] = []

  lines.push(`📊 Metric: ${preview.metric}`)
  lines.push(`   Description: ${preview.description}`)

  if (Object.keys(preview.attributes).length > 0) {
    lines.push(`   Attributes:`)
    for (const [key, value] of Object.entries(preview.attributes)) {
      lines.push(`     • ${key}: ${value}`)
    }
  }

  if (preview.value !== undefined) {
    lines.push(`   Value: ${preview.value}`)
  }

  if (preview.timestamp) {
    lines.push(`   Timestamp: ${preview.timestamp}`)
  }

  return lines.join("\n")
}

/**
 * Print context validation report
 */
export function printContextReport(context: TelemetryContext | null): void {
  const validation = validateContext(context)

  debugLogger.info("Context Validation Report")

  console.log("\n📋 Context Validation Report")
  console.log("═".repeat(50))

  if (!context) {
    console.log("❌ No context available")
    return
  }

  // Print provided fields
  console.log("\n✅ Provided Fields:")
  for (const [field, provided] of Object.entries(validation.provided)) {
    if (provided) {
      const value = (context as any)[field]
      console.log(`  ✓ ${field.padEnd(15)} = ${value}`)
    }
  }

  // Print missing fields
  if (validation.missing.length > 0) {
    console.log("\n⚠️  Missing/Empty Fields:")
    for (const field of validation.missing) {
      const isRequired = REQUIRED_CONTEXT_FIELDS.includes(field)
      const marker = isRequired ? "❌" : "⊘"
      console.log(`  ${marker} ${field}${isRequired ? " (required)" : ""}`)
    }
  }

  // Print score
  const scorePercent = (validation.score * 100).toFixed(0)
  const scoreBar = "█".repeat(Math.floor(validation.score * 20)) + "░".repeat(20 - Math.floor(validation.score * 20))
  console.log(`\n📈 Completeness Score: ${scorePercent}% [${scoreBar}]`)

  console.log("\n" + "═".repeat(50) + "\n")
}
