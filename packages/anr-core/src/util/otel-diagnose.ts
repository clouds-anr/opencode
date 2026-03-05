#!/usr/bin/env bun
/**
 * Diagnose why backend rejects metrics
 */

console.log("📊 OTEL Export Diagnosis")
console.log("=".repeat(60))

// Check log file
const { readFileSync, existsSync } = await import("fs")
const { resolve } = await import("path")

const logFile = resolve(process.env.HOME || "/tmp", ".config", "opencode-anr", "logs", "otel-metrics.log")

if (!existsSync(logFile)) {
  console.log("❌ No log file found at:", logFile)
  console.log("\n💡 Run OpenCode first to generate metrics:")
  console.log("   cd packages/opencode && bun run src/index.ts --help")
  process.exit(1)
}

const logs = readFileSync(logFile, "utf-8")
const lines = logs.split("\n")

// Count exports
let attempts = 0
let successes = 0
let failures = 0
let lastFailure: any = null
let lastPayload: any = null

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  
  if (line.includes("[OTLPExporter.export] called")) {
    attempts++
  }
  
  if (line.includes("Export successful")) {
    successes++
  }
  
  if (line.includes("Export failed")) {
    failures++
    // Try to parse the next few lines for error details
    try {
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].trim().startsWith("{")) {
          lastFailure = JSON.parse(lines[j].trim())
          break
        }
      }
    } catch {}
  }
  
  if (line.includes("[OTLPExporter.payload]")) {
    // Capture last payload
    try {
      for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
        if (lines[j].trim().startsWith("{")) {
          const payloadLines = []
          for (let k = j; k < lines.length; k++) {
            payloadLines.push(lines[k])
            if (lines[k].includes("}") && lines[k].trim() === "}") {
              break
            }
          }
          lastPayload = JSON.parse(payloadLines.join("\n"))
          break
        }
      }
    } catch {}
  }
}

console.log("\n📈 Export Statistics:")
console.log(`  Attempts:  ${attempts}`)
console.log(`  Successes: ${successes} ✅`)
console.log(`  Failures:  ${failures} ❌`)
console.log(`  Success Rate: ${attempts > 0 ? Math.round(successes / attempts * 100) : 0}%`)

if (lastFailure) {
  console.log("\n❌ Last Failure Details:")
  console.log(JSON.stringify(lastFailure, null, 2))
}

if (lastPayload) {
  console.log("\n📦 Last Payload Structure:")
  console.log(`  Resource Metrics: ${lastPayload.resourceMetrics?.length || 0}`)
  if (lastPayload.resourceMetrics?.[0]) {
    const rm = lastPayload.resourceMetrics[0]
    console.log(`  Scope Metrics: ${rm.scopeMetrics?.length || 0}`)
    if (rm.scopeMetrics?.[0]) {
      const sm = rm.scopeMetrics[0]
      console.log(`  Metrics: ${sm.metrics?.length || 0}`)
      if (sm.metrics?.[0]) {
        console.log(`  First Metric: ${sm.metrics[0].descriptor?.name}`)
      }
    }
  }
}

console.log("\n🔍 Diagnosis:")
if (successes > 0) {
  console.log("  ✅ Metrics are being accepted by backend!")
} else if (failures > 0) {
  console.log("  ❌ Backend is rejecting all metrics")
  console.log("\n  Possible causes:")
  console.log("    1. Format mismatch (JSON vs protobuf expected)")
  console.log("    2. Missing authentication headers")
  console.log("    3. Payload structure incompatible")
  console.log("    4. Backend endpoint configuration issue")
  
  if (lastFailure?.resultCode === 1) {
    console.log("\n  Error Code 1 (FAILED) typically means:")
    console.log("    - Protocol/format mismatch")
    console.log("    - Backend couldn't parse the payload")
  }
} else {
  console.log("  ⚠️  No export attempts found")
  console.log("  Run OpenCode to generate metrics first")
}

console.log("\n" + "=".repeat(60))
console.log(`Log file: ${logFile}`)

process.exit(failures > 0 && successes === 0 ? 1 : 0)
