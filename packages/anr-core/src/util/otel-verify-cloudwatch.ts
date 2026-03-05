#!/usr/bin/env bun
/**
 * CloudWatch Metric Verifier
 *
 * Queries AWS CloudWatch to confirm metrics from otel-e2e-test actually landed.
 * Uses SEARCH expressions via get-metric-data to aggregate across all dimension
 * combinations (OTel exports each session with unique dimensions).
 *
 * Usage:
 *   bun otel:verify
 *   bun otel:verify -- --minutes 30
 *   bun otel:verify -- --namespace MyNamespace
 *   bun otel:verify -- --profile my-aws-profile
 *   bun otel:verify -- --all          # show all metrics in namespace
 */

import { $ } from "bun"
import { writeFileSync, unlinkSync } from "fs"
import { resolve } from "path"
import { tmpdir } from "os"

const C = { r: "\x1b[0m", g: "\x1b[32m", rd: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[2m", b: "\x1b[1m" }

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback
  return process.argv[idx + 1]!
}

const NAMESPACE = arg("namespace", "ClaudeCode")
const REGION = arg("region", "us-east-2")
const PROFILE = arg("profile", "anr-bedrock-internal-us-east-1")
const MINUTES = parseInt(arg("minutes", "60"), 10)
const PERIOD = parseInt(arg("period", "300"), 10)
const SHOW_ALL = process.argv.includes("--all")

// Metrics the e2e test sends + real-world production metrics
const METRICS: { name: string; stat: string; label: string }[] = [
  { name: "claude_code.session.started",          stat: "Sum",     label: "Sessions started" },
  { name: "claude_code.token.usage",              stat: "Sum",     label: "Token usage (input + output)" },
  { name: "claude_code.model.calls.count",        stat: "Sum",     label: "Model API calls" },
  { name: "claude_code.session.duration_seconds",  stat: "Sum",     label: "Session duration" },
  { name: "claude_code.command.duration_ms",       stat: "Sum",     label: "Command duration" },
  { name: "claude_code.command.count",             stat: "Sum",     label: "Commands executed" },
  { name: "claude_code.cost.usage",                stat: "Sum",     label: "Estimated cost (USD)" },
  { name: "claude_code.lines_of_code.count",       stat: "Sum",     label: "Lines of code" },
  { name: "claude_code.code_edit_tool.applied",    stat: "Sum",     label: "Code edit tool applications" },
  { name: "claude_code.code_edit_tool.decision",   stat: "Sum",     label: "Code edit decisions" },
]

function iso(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "")
}

/** Use get-metric-data with SEARCH to aggregate across all dimension combos */
async function searchMetric(metric: string, stat: string): Promise<{ values: number[]; timestamps: string[]; error?: string }> {
  const end = new Date()
  const start = new Date(end.getTime() - MINUTES * 60_000)

  // Try multiple dimension schemas — OTel metrics land with varying dimension keys
  const schemas = [
    `{${NAMESPACE},OTelLib}`,
    `{${NAMESPACE},session_id,OTelLib}`,
    `{${NAMESPACE},user_id,OTelLib}`,
    `{${NAMESPACE},service.name,OTelLib}`,
  ]

  const queries = schemas.map((schema, i) => ({
    Id: `s${i}`,
    Expression: `SEARCH('${schema} MetricName="${metric}"', '${stat}', ${PERIOD})`,
    Period: PERIOD,
  }))

  const queryJson = JSON.stringify({
    MetricDataQueries: queries,
    StartTime: iso(start),
    EndTime: iso(end),
  })

  // Write to temp file to avoid shell escaping issues
  const tmp = resolve(tmpdir(), `cw-query-${Date.now()}.json`)
  writeFileSync(tmp, queryJson)

  const result = await $`aws cloudwatch get-metric-data --cli-input-json file://${tmp} --region ${REGION} --profile ${PROFILE} --output json`.quiet().nothrow()
  try { unlinkSync(tmp) } catch {}

  if (result.exitCode !== 0) {
    return { values: [], timestamps: [], error: result.stderr.toString().trim() }
  }

  const parsed = JSON.parse(result.stdout.toString())
  const results = parsed.MetricDataResults || []

  // Aggregate across all returned series
  const tsMap = new Map<string, number>()
  for (const series of results) {
    for (let i = 0; i < (series.Timestamps || []).length; i++) {
      const ts = series.Timestamps[i]
      const val = series.Values[i]
      tsMap.set(ts, (tsMap.get(ts) || 0) + val)
    }
  }

  const entries = [...tsMap.entries()].sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
  return {
    values: entries.map(e => e[1]),
    timestamps: entries.map(e => e[0]),
  }
}

/** List all unique metric names in the namespace */
async function listMetricNames(): Promise<string[]> {
  const result = await $`aws cloudwatch list-metrics --namespace ${NAMESPACE} --region ${REGION} --profile ${PROFILE} --output json`.quiet().nothrow()
  if (result.exitCode !== 0) return []
  const parsed = JSON.parse(result.stdout.toString())
  return [...new Set<string>((parsed.Metrics || []).map((m: any) => m.MetricName as string))].sort()
}

async function main() {
  console.clear()
  console.log(`${C.b}☁️  CloudWatch Metric Verifier${C.r}`)
  console.log("═".repeat(70))
  console.log(`${C.d}  Namespace:  ${NAMESPACE}`)
  console.log(`  Region:     ${REGION}`)
  console.log(`  Profile:    ${PROFILE}`)
  console.log(`  Window:     last ${MINUTES} min (period=${PERIOD}s)${C.r}`)
  console.log("═".repeat(70))

  // List registered metrics
  console.log(`\n${C.c}📋 Metrics in namespace "${NAMESPACE}":${C.r}`)
  const names = await listMetricNames()
  if (names.length === 0) {
    console.log(`  ${C.rd}(none found)${C.r}`)
  } else {
    for (const n of names) {
      const tracked = METRICS.some(m => m.name === n)
      console.log(`  ${tracked ? C.c + "●" : C.d + "○"} ${n}${C.r}`)
    }
    console.log(`${C.d}  (● = tracked below, ○ = other)${C.r}`)
  }

  // Query each tracked metric
  const targets = SHOW_ALL
    ? names.map(n => {
        const known = METRICS.find(m => m.name === n)
        return known || { name: n, stat: "Sum", label: n }
      })
    : METRICS

  console.log(`\n${C.b}📊 Querying ${targets.length} metrics (SEARCH across all dimensions):${C.r}`)
  console.log("─".repeat(70))

  let found = 0
  let missing = 0

  for (const m of targets) {
    const result = await searchMetric(m.name, m.stat)

    if (result.error) {
      missing++
      console.log(`  ${C.rd}❌ ${m.name}${C.r}`)
      console.log(`     ${C.rd}${result.error}${C.r}`)
      console.log()
      continue
    }

    if (result.values.length > 0) {
      const total = result.values.reduce((a, b) => a + b, 0)
      if (total === 0) {
        // Got dimension streams but all values are zero — not real data
        missing++
        console.log(`  ${C.y}⚠️  ${m.name}${C.r}`)
        console.log(`     ${C.d}${m.label} — dimension streams exist but all values are 0${C.r}`)
        console.log()
        continue
      }

      found++
      const latest = result.values[0]
      const latestTs = new Date(result.timestamps[0]!).toLocaleTimeString()

      console.log(`  ${C.g}✅ ${m.name}${C.r}`)
      console.log(`     ${C.d}${m.label}${C.r}`)
      console.log(`     Latest: ${C.b}${latest}${C.r} @ ${latestTs}  |  Total: ${C.b}${Math.round(total * 100) / 100}${C.r}  (${result.values.length} periods)`)

      // Sparkline of recent values
      const vals = result.values.slice(0, 12).reverse()
      const max = Math.max(...vals)
      const bars = "▁▂▃▄▅▆▇█"
      const spark = vals.map(v => max === 0 ? bars[0] : bars[Math.min(Math.floor((v / max) * (bars.length - 1)), bars.length - 1)]).join("")
      console.log(`     ${C.c}${spark}${C.r}  ${C.d}(last ${vals.length} periods)${C.r}`)
    } else {
      missing++
      const registered = names.includes(m.name)
      if (registered) {
        console.log(`  ${C.y}⚠️  ${m.name}${C.r}`)
        console.log(`     ${C.d}${m.label} — registered but no data in last ${MINUTES} min${C.r}`)
      } else {
        console.log(`  ${C.rd}❌ ${m.name}${C.r}`)
        console.log(`     ${C.d}${m.label} — not found in namespace${C.r}`)
      }
    }
    console.log()
  }

  // Summary
  console.log("═".repeat(70))
  const total = found + missing
  if (found === total) {
    console.log(`${C.g}${C.b}🎉 All ${total} metrics have data in CloudWatch!${C.r}`)
  } else if (found > 0) {
    console.log(`${C.y}⚠️  ${found}/${total} metrics have data, ${missing} missing${C.r}`)
  } else {
    console.log(`${C.rd}❌ No metric data found in CloudWatch${C.r}`)
    console.log(`${C.d}   • Run bun otel:test first to emit metrics`)
    console.log(`   • Wait 1-2 min for propagation`)
    console.log(`   • Try --minutes 1440 --period 3600 for a wider window${C.r}`)
  }

  process.exit(found > 0 ? 0 : 1)
}

main().catch(e => { console.error(`Fatal: ${e}`); process.exit(1) })
