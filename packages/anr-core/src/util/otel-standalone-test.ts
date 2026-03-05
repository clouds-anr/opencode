#!/usr/bin/env bun
/**
 * Standalone OTEL export test - bypasses everything to isolate the problem.
 * Tests each layer independently:
 *   1. Raw HTTP (does the backend accept our request?)
 *   2. JsonMetricsSerializer (does serialization work?)
 *   3. OTLPMetricExporter directly (does the exporter work?)
 *   4. Full MeterProvider pipeline (does the SDK pipeline work?)
 */

const ENDPOINT = "http://otel-collector-alb-395007917.us-east-2.elb.amazonaws.com"

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
}

function pass(msg: string) { console.log(`${colors.green}  ✅ ${msg}${colors.reset}`) }
function fail(msg: string, detail?: any) {
  console.log(`${colors.red}  ❌ ${msg}${colors.reset}`)
  if (detail) console.log(`${colors.dim}     ${typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)}${colors.reset}`)
}
function info(msg: string) { console.log(`${colors.cyan}  ℹ️  ${msg}${colors.reset}`) }
function header(msg: string) { console.log(`\n${colors.bold}${msg}${colors.reset}`) }

async function main() {
  console.log(`${colors.bold}🔬 OTEL Export Layer-by-Layer Diagnosis${colors.reset}`)
  console.log("═".repeat(70))

  // ========================================
  // TEST 1: Raw HTTP to backend
  // ========================================
  header("Test 1: Raw HTTP POST to backend")
  info(`POST ${ENDPOINT}/v1/metrics`)
  
  const otlpPayload = {
    resourceMetrics: [{
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "opencode-standalone-test" } },
        ]
      },
      scopeMetrics: [{
        scope: { name: "test", version: "1.0" },
        metrics: [{
          name: "test.metric",
          sum: {
            dataPoints: [{
              asInt: "1",
              startTimeUnixNano: String((Date.now() - 1000) * 1_000_000),
              timeUnixNano: String(Date.now() * 1_000_000),
              attributes: [],
            }],
            aggregationTemporality: 2,
            isMonotonic: true,
          }
        }]
      }]
    }]
  }

  try {
    const resp = await fetch(`${ENDPOINT}/v1/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(otlpPayload),
    })
    const body = await resp.text()
    if (resp.ok) {
      pass(`HTTP ${resp.status} - Backend accepts JSON OTLP`)
      info(`Response: ${body}`)
    } else {
      fail(`HTTP ${resp.status} ${resp.statusText}`, body)
    }
  } catch (e) {
    fail(`Network error: ${e}`)
  }

  // ========================================
  // TEST 2: JsonMetricsSerializer
  // ========================================
  header("Test 2: JsonMetricsSerializer")

  let serializedData: Uint8Array | null | undefined = null
  try {
    const { JsonMetricsSerializer } = await import("@opentelemetry/otlp-transformer")
    info("JsonMetricsSerializer imported OK")

    // Build an internal SDK ResourceMetrics object (what PeriodicExportingMetricReader passes)
    const { Resource } = await import("@opentelemetry/resources")
    const resource = new Resource({ "service.name": "test" })

    const fakeMetrics = {
      resource,
      scopeMetrics: [{
        scope: { name: "test", version: "1.0" },
        metrics: [{
          descriptor: {
            name: "test.serialize",
            type: "COUNTER",
            description: "Test",
            unit: "",
            valueType: 1,
            advice: {},
          },
          aggregationTemporality: 2,
          dataPointType: 3,
          dataPoints: [{
            attributes: {},
            startTime: [Math.floor(Date.now() / 1000) - 1, 0],
            endTime: [Math.floor(Date.now() / 1000), 0],
            value: 42,
          }],
          isMonotonic: true,
        }],
      }],
    }

    serializedData = JsonMetricsSerializer.serializeRequest([fakeMetrics as any])
    if (serializedData) {
      const json = new TextDecoder().decode(serializedData)
      const parsed = JSON.parse(json)
      pass(`Serialization OK (${serializedData.length} bytes)`)
      info(`Keys: ${Object.keys(parsed).join(", ")}`)
      if (parsed.resourceMetrics) {
        pass("Output has 'resourceMetrics' key (correct OTLP format)")
        info(`Serialized: ${json.substring(0, 200)}...`)
      } else {
        fail("Missing 'resourceMetrics' key in serialized output")
      }
    } else {
      fail("Serialization returned null")
    }
  } catch (e) {
    fail(`Serializer error: ${e}`)
  }

  // ========================================
  // TEST 2b: Send serialized data to backend
  // ========================================
  if (serializedData) {
    header("Test 2b: Send SDK-serialized payload to backend")
    try {
      const resp = await fetch(`${ENDPOINT}/v1/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serializedData,
      })
      const body = await resp.text()
      if (resp.ok) {
        pass(`HTTP ${resp.status} - Backend accepts SDK-serialized JSON`)
        info(`Response: ${body}`)
      } else {
        fail(`HTTP ${resp.status} ${resp.statusText}`, body)
      }
    } catch (e) {
      fail(`Network error: ${e}`)
    }
  }

  // ========================================
  // TEST 3: OTLPMetricExporter.export() directly
  // ========================================
  header("Test 3: OTLPMetricExporter.export()")

  try {
    const { OTLPMetricExporter } = await import("@opentelemetry/exporter-metrics-otlp-http")
    const { Resource } = await import("@opentelemetry/resources")

    const exporter = new OTLPMetricExporter({
      url: `${ENDPOINT}/v1/metrics`,
      headers: {
        "Content-Type": "application/json",
        "x-user-email": "test@standalone.com",
        "x-user-id": "standalone-test",
      },
    })

    info("Exporter created, calling export()...")

    const resource = new Resource({ "service.name": "opencode-standalone-test" })
    const fakeMetrics = {
      resource,
      scopeMetrics: [{
        scope: { name: "test-scope", version: "1.0" },
        metrics: [{
          descriptor: {
            name: "test.exporter.direct",
            type: "COUNTER",
            description: "Direct exporter test",
            unit: "",
            valueType: 1,
            advice: {},
          },
          aggregationTemporality: 2,
          dataPointType: 3,
          dataPoints: [{
            attributes: {},
            startTime: [Math.floor(Date.now() / 1000) - 1, 0],
            endTime: [Math.floor(Date.now() / 1000), 0],
            value: 1,
          }],
          isMonotonic: true,
        }],
      }],
    }

    const result = await new Promise<{code: number, error?: any}>((resolve) => {
      exporter.export(fakeMetrics as any, (result) => {
        resolve(result)
      })
    })

    if (result.code === 0) {
      pass(`Export succeeded (code=${result.code})`)
    } else {
      fail(`Export failed (code=${result.code})`, {
        error: result.error,
        errorString: String(result.error),
        errorMessage: result.error?.message,
        errorName: result.error?.name,
        errorStack: result.error?.stack?.split("\n").slice(0, 3),
        errorStatusCode: result.error?.statusCode,
        errorData: result.error?.data,
      })
    }

    await exporter.shutdown()
  } catch (e) {
    fail(`Exporter error: ${e}`)
    if (e instanceof Error) info(e.stack || "")
  }

  // ========================================
  // TEST 4: Full MeterProvider pipeline
  // ========================================
  header("Test 4: Full MeterProvider → PeriodicExportingMetricReader → Exporter")

  try {
    const { OTLPMetricExporter } = await import("@opentelemetry/exporter-metrics-otlp-http")
    const { MeterProvider, PeriodicExportingMetricReader } = await import("@opentelemetry/sdk-metrics")
    const { Resource } = await import("@opentelemetry/resources")

    const exporter = new OTLPMetricExporter({
      url: `${ENDPOINT}/v1/metrics`,
      headers: {
        "x-user-email": "test@standalone.com",
        "x-user-id": "standalone-test",
      },
    })

    const reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 1000,  // 1 second for fast test
      exportTimeoutMillis: 5000,
    })

    const provider = new MeterProvider({
      resource: new Resource({ "service.name": "opencode-standalone-test" }),
      readers: [reader],
    })

    const meter = provider.getMeter("standalone-test")
    const counter = meter.createCounter("test.pipeline.counter", {
      description: "Full pipeline test",
    })

    counter.add(1, { test: "true" })
    info("Counter recorded, waiting for export cycle (2s)...")

    await new Promise(resolve => setTimeout(resolve, 2000))

    info("Calling forceFlush...")
    try {
      await provider.forceFlush()
      pass("forceFlush completed without error")
    } catch (e) {
      fail(`forceFlush error: ${e}`)
    }

    info("Shutting down...")
    await provider.shutdown()
    pass("Pipeline test complete")

  } catch (e) {
    fail(`Pipeline error: ${e}`)
    if (e instanceof Error) info(e.stack || "")
  }

  // ========================================
  // SUMMARY
  // ========================================
  console.log("\n" + "═".repeat(70))
  console.log(`${colors.bold}Summary:${colors.reset}`)
  console.log("  If Test 1 passes but Test 3 fails → Bun http.request compatibility issue")
  console.log("  If Test 2 fails → Serializer incompatibility")
  console.log("  If Test 3 passes but Test 4 fails → MeterProvider/Reader issue")
  console.log("  If all pass → The problem is in otel.ts configuration")
}

main().catch(e => {
  console.error(`\n${colors.red}Fatal: ${e}${colors.reset}`)
  process.exit(1)
})
