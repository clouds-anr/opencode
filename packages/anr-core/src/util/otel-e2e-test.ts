#!/usr/bin/env bun
/**
 * OTEL E2E Test — Direct In-Process
 *
 * Tests the full OTEL pipeline without requiring a browser auth flow.
 * Uses the fetch-based exporter to verify metrics reach the backend.
 *
 * Pass --auth to include OIDC authentication.
 */

import { resolve } from "path"
import { existsSync, readFileSync } from "fs"
import { release } from "os"
import { initializeOTEL, shutdownOTEL } from "../integrations/otel"
import type { TelemetryContext } from "../integrations/otel"
import { metrics } from "@opentelemetry/api"

const LOG = resolve(process.env.HOME || "/tmp", ".config", "opencode-anr", "logs", "otel-metrics.log")
const C = { r: "\x1b[0m", g: "\x1b[32m", rd: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[2m", b: "\x1b[1m" }
const wantAuth = process.argv.includes("--auth")

function show(emoji: string, msg: string, data?: any) {
  console.log(`${emoji} ${C.b}${msg}${C.r}`)
  if (data) console.log(C.d + JSON.stringify(data, null, 2) + C.r)
}

async function main() {
  console.clear()
  show("🔬", "OTEL E2E Test — Direct In-Process")
  console.log("═".repeat(70))

  // ── Config ──
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector-alb-395007917.us-east-2.elb.amazonaws.com"
  const region = process.env.OPENCODE_AWS_REGION || "us-east-2"

  const config = {
    enableTelemetry: true,
    otelEndpoint: endpoint,
    awsRegion: region,
    awsRegionProfile: region,
    metricsIntervalSeconds: 5, // Fast interval for testing
  }
  show("✅", "Config", { endpoint, region, interval: "5s" })

  // ── Auth (optional) ──
  let userId = "e2e-test-user"
  let userEmail = "e2e-test@opencode.local"

  if (wantAuth) {
    show("\n🔐", "Authenticating via OIDC...")
    const { loadANRConfig } = await import("../config/env-loader")
    const { authenticateWithOIDC } = await import("../integrations/oidc-auth")
    const fullConfig = await loadANRConfig()
    if (fullConfig) {
      const auth = await authenticateWithOIDC(fullConfig)
      try {
        const payload = JSON.parse(Buffer.from(auth.idToken.split(".")[1], "base64url").toString())
        userId = payload.sub || userId
        userEmail = payload.email || userEmail
      } catch { /* use defaults */ }
      show("✅", `Authenticated as ${userEmail}`)
    }
  } else {
    show("ℹ️", "Skipping auth (pass --auth to enable)")
  }

  // ── Initialize OTEL ──
  show("\n📊", "Initializing OTEL with fetch-based exporter...")
  const context: TelemetryContext = {
    userId,
    userEmail,
    sessionId: crypto.randomUUID(),
    osType: process.platform,
    osVersion: release(),
    hostArch: process.arch,
    terminalType: process.env.TERM || "unknown",
  }

  initializeOTEL(config as any, context)
  show("✅", "OTEL initialized", { sessionId: context.sessionId })

  // ── Record metrics ──
  show("\n📝", "Recording test metrics...")
  const meter = metrics.getMeter("opencode-anr")

  const session = meter.createCounter("claude_code.session.started", { description: "Sessions started" })
  session.add(1)
  show("  📊", "claude_code.session.started = 1")

  const tokens = meter.createCounter("claude_code.token.usage", { description: "Token usage" })
  tokens.add(150, { type: "input", model: "us.anthropic.claude-sonnet-4-20250514-v1:0" })
  tokens.add(75, { type: "output", model: "us.anthropic.claude-sonnet-4-20250514-v1:0" })
  show("  📊", "claude_code.token.usage: 150 input + 75 output")

  const calls = meter.createCounter("claude_code.model.calls.count", { description: "Model calls" })
  calls.add(1, { model: "us.anthropic.claude-sonnet-4-20250514-v1:0" })
  show("  📊", "claude_code.model.calls.count = 1")

  const cost = meter.createCounter("claude_code.cost.usage", { description: "Estimated cost", unit: "USD" })
  cost.add(0.001125, { model: "us.anthropic.claude-sonnet-4-20250514-v1:0" })
  show("  📊", "claude_code.cost.usage = $0.001125")

  const loc = meter.createCounter("claude_code.lines_of_code.count", { description: "Lines of code", unit: "1" })
  loc.add(42, { type: "added", language: "typescript" })
  loc.add(10, { type: "removed", language: "typescript" })
  show("  📊", "claude_code.lines_of_code.count: 42 added + 10 removed")

  const editTool = meter.createCounter("claude_code.code_edit_tool.applied", { description: "Code edit tool" })
  editTool.add(1, { tool_name: "str_replace_editor", language: "typescript" })
  show("  📊", "claude_code.code_edit_tool.applied = 1")

  const editDecision = meter.createCounter("claude_code.code_edit_tool.decision", { description: "Edit decisions" })
  editDecision.add(1, { decision: "accepted" })
  show("  📊", "claude_code.code_edit_tool.decision = 1 (accepted)")

  // ── Wait for export ──
  show("\n⏳", "Waiting for export cycles (15s, interval=5s)...")
  console.log(C.d + "─".repeat(70) + C.r)

  let baseline = existsSync(LOG) ? readFileSync(LOG, "utf-8") : ""
  let attempts = 0
  let successes = 0
  let failures = 0

  const tail = setInterval(() => {
    if (!existsSync(LOG)) return
    const content = readFileSync(LOG, "utf-8")
    const fresh = content.substring(baseline.length)
    if (!fresh) return
    baseline = content

    for (const line of fresh.split("\n").filter(l => l.trim())) {
      if (line.includes("[FetchExporter.export]")) {
        attempts++
        console.log(`  ${C.c}📤 ${line.trim()}${C.r}`)
      } else if (line.includes("[FetchExporter] serialized")) {
        console.log(`  ${C.d}📦 ${line.trim()}${C.r}`)
      } else if (line.includes("✅ Export successful")) {
        successes++
        console.log(`  ${C.g}✅ ${line.trim()}${C.r}`)
      } else if (line.includes("❌")) {
        failures++
        console.log(`  ${C.rd}❌ ${line.trim()}${C.r}`)
      }
    }
  }, 500)

  await new Promise(resolve => setTimeout(resolve, 15000))

  // ── Shutdown ──
  console.log(C.d + "─".repeat(70) + C.r)
  show("🔄", "Flushing & shutting down...")
  try {
    await shutdownOTEL()
  } catch (e) {
    show("⚠️", `Shutdown: ${e}`)
  }
  await new Promise(resolve => setTimeout(resolve, 2000))
  clearInterval(tail)

  // ── Summary ──
  console.log("\n" + "═".repeat(70))
  show("📊", "Results")
  console.log(`  Export Attempts:  ${attempts}`)
  console.log(`  ${C.g}Successes:        ${successes} ✅${C.r}`)
  console.log(`  ${C.rd}Failures:         ${failures} ❌${C.r}`)

  if (successes > 0) {
    console.log(`  ${C.g}Success Rate:     ${Math.round((successes / attempts) * 100)}%${C.r}`)
    show("\n🎉", "METRICS ARE REACHING THE BACKEND!")
  } else if (failures > 0) {
    show("\n❌", "All exports failed")
  } else {
    show("\n⚠️", "No exports attempted")
    if (existsSync(LOG)) {
      console.log(`\n${C.d}Last 20 log lines:${C.r}`)
      for (const l of readFileSync(LOG, "utf-8").split("\n").slice(-20)) {
        console.log(`  ${C.d}${l}${C.r}`)
      }
    }
  }

  process.exit(successes > 0 ? 0 : 1)
}

main().catch(e => { console.error(`Fatal: ${e}`); process.exit(1) })
