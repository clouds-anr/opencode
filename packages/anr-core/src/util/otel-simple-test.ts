/**
 * Simple OTEL Test
 * Quick validation that protobuf metrics export is working
 * No auth/dependency complications - just tests the mechanics
 */

import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { Resource } from "@opentelemetry/resources"
import { appendFileSync, mkdirSync, existsSync, writeFileSync } from "fs"
import { resolve } from "path"

const logDir = resolve(process.env.HOME || "/tmp", ".config", "opencode-anr", "logs")
const logFile = resolve(logDir, "otel-simple-test.log")

function log(msg: string, data?: any) {
  const timestamp = new Date().toISOString()
  const line = data ? `${timestamp} ${msg}\n  ${JSON.stringify(data, null, 2)}\n` : `${timestamp} ${msg}\n`

  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }

  appendFileSync(logFile, line)
  console.log(`${timestamp} ${msg}`)
  if (data) console.log("  ", data)
}

export async function runSimpleOTELTest() {
  try {
    log("🧪 Starting Simple OTEL Test")

    // Create resource
    log("📦 Creating OTEL resource...")
    const resourceAttrs = {
      "service.name": "opencode-simple-test",
      "service.version": "1.0.0",
      "deployment.environment": "test",
    }

    const resource = Resource.default().merge(new Resource(resourceAttrs))
    log("✅ Resource created")

    // Determine endpoint and protocol
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector-alb-395007917.us-east-2.elb.amazonaws.com"
    const protocol = process.env.OTEL_EXPORTER_OTLP_PROTOCOL || "http/protobuf"

    log("📋 Configuration", { endpoint, protocol, logFile })

    // Create exporter with test headers
    const exporter = new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
      headers: {
        "Content-Type": "application/json",
        "x-user-email": "test@opencode.local",
        "x-user-id": "test-user-123",
        "x-department": "engineering",
      },
    })

    log("✅ Exporter created (HTTP/JSON protocol - compatible with backend)")

    // Track exports
    let exportCount = 0
    let  successCount = 0
    let failCount = 0

    const originalExport = exporter.export.bind(exporter)
    exporter.export = function(metrics, callback) {
      exportCount++
      const metricsCount = (metrics as any).scopeMetrics?.length || 0

      log(`📤 Export attempt #${exportCount}`, { scopeMetrics: metricsCount })

      return originalExport(metrics, (error) => {
        if (!error) {
          successCount++
          log(`✅ Export #${exportCount} SUCCESS`)
        } else {
          failCount++
          log(`❌ Export #${exportCount} FAILED`, {
            errorType: error?.constructor?.name,
            errorMessage: String(error),
            errorCode: (error as any)?.code,
          })
        }
        callback(error)
      })
    }

    // Set up meter provider
    const meterProvider = new MeterProvider({
      resource,
    })

    meterProvider.addMetricReader(new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000 }))

    log("✅ Meter provider configured")

    // Create test metrics
    const meter = meterProvider.getMeter("test", "1.0.0")
    const counter = meter.createCounter("opencode.test.count", { description: "Test counter" })
    const histogram = meter.createHistogram("opencode.test.duration_ms", { description: "Test histogram" })

    log("✅ Metrics created")

    // Record test data
    counter.add(1, { test: "simple" })
    histogram.record(100, { test: "simple" })

    log("📊 Test data recorded")
    log("⏳ Waiting 3 seconds for metrics to export...")

    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Shutdown
    await meterProvider.shutdown()

    log("\n✨ Test Complete!", {
      exportAttempts: exportCount,
      successful: successCount,
      failed: failCount,
      logFile,
    })

    return {
      success: failCount === 0 && successCount > 0,
      exportAttempts: exportCount,
      successful: successCount,
      failed: failCount,
      logFile,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log("❌ Test Failed", { error: errorMsg })

    if (error instanceof Error && error.stack) {
      log("Stack trace", { stack: error.stack.split("\n").slice(0, 5) })
    }

    throw error
  }
}

// Run if executed directly
if (import.meta.main) {
  runSimpleOTELTest()
    .then((result) => {
      console.log("\n✅ Test completed")
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error("❌ Test failed:", error)
      process.exit(1)
    })
}

export default runSimpleOTELTest
