/**
 * Context flow tracer for debugging telemetry context propagation
 */

import { randomUUID } from "crypto"
import { debugLogger } from "./debug-logger"

export interface ContextTraceEvent {
  timestamp: string
  traceId: string
  stage: string
  source: string
  action: "created" | "extracted" | "merged" | "validated" | "used" | "passed"
  fieldCount?: number
  missingFields?: string[]
  details?: Record<string, any>
}

class ContextTracer {
  private traceId: string = randomUUID()
  private events: ContextTraceEvent[] = []
  private enabled = process.env.OPENCODE_DEBUG_OTEL === "1" || process.env.OPENCODE_DEBUG === "1"

  constructor() {
    if (this.enabled) {
      this.log("system", "created", "Context tracer initialized", { traceId: this.traceId })
    }
  }

  setTraceId(id: string): void {
    this.traceId = id
  }

  getTraceId(): string {
    return this.traceId
  }

  private log(
    source: string,
    action: "created" | "extracted" | "merged" | "validated" | "used" | "passed",
    stage: string,
    details?: {
      fieldCount?: number
      missingFields?: string[]
      [key: string]: any
    }
  ): void {
    if (!this.enabled) return

    const event: ContextTraceEvent = {
      timestamp: new Date().toISOString(),
      traceId: this.traceId,
      stage,
      source,
      action,
      fieldCount: details?.fieldCount,
      missingFields: details?.missingFields,
      details: {
        ...details,
        fieldCount: undefined,
        missingFields: undefined,
      },
    }

    this.events.push(event)
    debugLogger.debug(`[${this.traceId.slice(0, 8)}] ${source}/${action}: ${stage}`, details)
  }

  created(source: string, fieldCount: number, details?: Record<string, any>): void {
    this.log(source, "created", "context initialized", { fieldCount, ...details })
  }

  extracted(source: string, stage: string, fieldCount: number, details?: Record<string, any>): void {
    this.log(source, "extracted", stage, { fieldCount, ...details })
  }

  merged(source: string, sourceCount: number, targetCount: number, details?: Record<string, any>): void {
    this.log(source, "merged", `merged ${sourceCount} → ${targetCount} fields`, details)
  }

  validated(source: string, complete: boolean, score: number, missingFields: string[], details?: Record<string, any>): void {
    this.log(source, "validated", complete ? "valid" : "incomplete", {
      complete,
      score: (score * 100).toFixed(0) + "%",
      missingFields,
      ...details,
    })
  }

  used(source: string, context: Record<string, any>, details?: Record<string, any>): void {
    const fieldCount = Object.values(context).filter((v) => !!v).length
    this.log(source, "used", "context applied to metric", { fieldCount, ...details })
  }

  passed(source: string, destination: string, fieldCount: number, details?: Record<string, any>): void {
    this.log(source, "passed", `context passed to ${destination}`, { fieldCount, ...details })
  }

  getEvents(): ContextTraceEvent[] {
    return this.events
  }

  getFlowDiagram(): string {
    const stages = new Map<string, ContextTraceEvent[]>()

    // Group events by stage
    this.events.forEach((event) => {
      if (!stages.has(event.stage)) {
        stages.set(event.stage, [])
      }
      stages.get(event.stage)!.push(event)
    })

    let output = "\n📊 Context Flow Trace\n"
    output += "═".repeat(60) + "\n"
    output += `Trace ID: ${this.traceId}\n\n`

    let lineNum = 1
    this.events.forEach((event) => {
      const icon =
        event.action === "created"
          ? "➕"
          : event.action === "extracted"
            ? "🔍"
            : event.action === "merged"
              ? "🔗"
              : event.action === "validated"
                ? "✓"
                : event.action === "used"
                  ? "📤"
                  : "➡️"

      output += `${lineNum.toString().padStart(2)}. ${icon} [${event.source}] ${event.stage}`
      if (event.fieldCount) {
        output += ` (${event.fieldCount} fields`
        if (event.missingFields && event.missingFields.length > 0) {
          output += `, ${event.missingFields.length} missing`
        }
        output += ")"
      }
      output += "\n"

      lineNum++
    })

    output += "═".repeat(60) + "\n"
    return output
  }

  printFlowDiagram(): void {
    console.log(this.getFlowDiagram())
  }
}

export const contextTracer = new ContextTracer()
