#!/usr/bin/env bun
/**
 * Simple OTEL Test - Verify protobuf metrics export works
 * Directly tests the OTEL exporter without auth dependencies
 */

import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto"
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources/build/src/ResourceImpl"
import { appendFileSync, mkdirSync, existsSync } from "fs"
import { resolve } from "path"

const logDir = resolve(process.env.HOME || "/tmp", ".config", "opencode-anr", "logs")
const logFile = resolve(logDir, "otel-test.log")

function log(msg: string, data?: any) {
  const timestamp = new Date().toISOString()
  const line = data ? `${timestamp} ${msg}\n  ${JSON.stringify(data, null, 2)}\n` : `${timestamp} ${msg}\n`
  
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  
  appendFileSync(logFile, line)
  console.log(msg)
  if (data) console.log("  ", JSON.stringify(data, null, 2))
}

async function runTest() {
  try {
    log("🧪 Starting OTEL Protobuf Export Test")
    log("📋 Configuration:")
    log("", {
      protocol: process.env.OTEL_EXPORTER_OTLP_PROTOCOL || "http/protobuf",
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector-alb-395007917.us-east-2.elb.amazonaws.com",
      logFile
    })

    // Create resource with test attributes
    const resourceAttrs = {
      "service.name": "opencode-test",
      "service.version": "1.0.0",
      "deployment.environment": "test",
      "user.email": "test@example.com",
      "user.id": "test-user-123",
      "department": "engineering",
      "team.id": "test-team"
    }

    log("📦 Creating resource with attributes:", resourceAttrs)
    const resource = defaultResource().merge(
      require("@opentelemetry/resources/build/src/ResourceImpl").resourceFromAttributes(resourceAttrs)
    )

    // Create exporter with protobuf protocol
    const exporter = new OTLPMetricExporter({
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector-alb-395007917.us-east-2.elb.amazonaws.com"}/v1/metrics`,
      headers: {
        "x-user-email": "test@example.com",
        "x-user-id": "test-user-123",
        "x-department": "engineering",
        "x-team-id": "test-team"
      }
    })

    log("✅ OTEL Exporter created with protobuf protocol")

    // Create meter  
    const meterProvider = new MeterProvider({
      resource
    })

    // Add reader with exporter
    meterProvider.addMetricReader(new PeriodicExportingMetricReader(exporter, { intervalMillis: 1000 }))

    log("✅ Meter Provider configured")

    // Get meter and create test metric
    const meter = meterProvider.getMeter("test-meter", "1.0.0")
    const counter = meter.createCounter("test.metric.count", { description: "Test metric" })

    log("✅ Created test counter")

    // Record a metric
    counter.add(42, {
      model: "claude-3-sonnet",
      type: "test"
    })

    log("📊 Recorded test metric: test.metric.count = 42")

    // Wait for export to happen
    log("⏳ Waiting for metrics export (2 seconds)...")
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Try graceful shutdown
    await meterProvider.shutdown()

    // Export callback check - wrap exporter export method
    let exportAttempts = 0
    let exportSuccess = 0

    const originalExport = exporter.export.bind(exporter)
    exporter.export = function(metrics, callback) {
      exportAttempts++
      log(`[Export #${exportAttempts}] Called with metrics`, { scopeMetricsCount: (metrics as any).scopeMetrics?.length })
      
      return originalExport(metrics, (error) => {
        if (!error) {
          exportSuccess++
          log(`✅ [Export #${exportAttempts}] SUCCESS`)
        } else {
          log(`❌ [Export #${exportAttempts}] FAILED`, { 
            error: String(error),
            code: (error as any).code
          })
        }
        callback(error)
      })
    }

    log("\n✨ Test completed! Check logs at:", { logFile })

  } catch (error) {
    log("❌ Test failed:", { 
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    process.exit(1)
  }
}

runTest()
