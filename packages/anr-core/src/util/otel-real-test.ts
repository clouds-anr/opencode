#!/usr/bin/env bun
/**
 * REAL OTEL Test - Actually sends metrics to backend
 */

import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { Resource } from "@opentelemetry/resources"

const log = (msg: string, data?: any) => {
  const ts = new Date().toISOString()
  console.log(`${ts} ${msg}`)
  if (data) console.log(JSON.stringify(data, null, 2))
}

async function realTest() {
  let exportAttempts = 0
  let exportSuccesses = 0
  let exportFailures = 0
  let lastError: any = null

  try {
    log("🧪 Starting REAL OTEL Metrics Test")
    
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector-alb-395007917.us-east-2.elb.amazonaws.com"
    
    // Create resource
    const resource = Resource.default().merge(new Resource({
      "service.name": "opencode-real-test",
      "user.email": "test@opencode.local",
    }))
    
    // Create exporter with tracking
    const exporter = new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
      headers: {
        "x-user-email": "test@opencode.local",
        "x-user-id": "test-123",
      },
    })
    
    // Wrap export to track results
    const originalExport = exporter.export.bind(exporter)
    exporter.export = (metrics: any, callback: any) => {
      exportAttempts++
      log(`📤 Export attempt #${exportAttempts}`)
      
      return originalExport(metrics, (error: any) => {
        if (error) {
          exportFailures++
          lastError = error
          log(`❌ Export #${exportAttempts} FAILED:`, {
            error: String(error),
            code: error?.code,
            message: error?.message
          })
        } else {
          exportSuccesses++
          log(`✅ Export #${exportAttempts} SUCCESS`)
        }
        callback(error)
      })
    }

    // Create meter provider WITHOUT PeriodicExportingMetricReader
    // (which has the selectAggregation issue)
    const provider = new MeterProvider({ resource })
    
    log("✅ Provider created, manually triggering export...")
    
    // Get meter and create counter
    const meter = provider.getMeter("test", "1.0.0")
    const counter = meter.createCounter("opencode.test.metric", {
      description: "Test metric"
    })
    
    // Record a metric
    counter.add(42, { test: "real" })
    log("📊 Recorded metric: opencode.test.metric = 42")
    
    // Manually collect and export
    log("⏳ Collecting and exporting metrics...")
    
    const reader = (provider as any).metricReader
    if (reader) {
      await reader.collect()
      log("✅ Manual collection completed")
    } else {
      // If no reader, we need to force an export differently
      log("⚠️  No metric reader found, trying direct export...")
      
      // Get metrics from provider
      const resourceMetrics = await provider.forceFlush()
      log("✅ Force flush completed")
    }
    
    // Wait a bit for async export
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Shutdown
    await provider.shutdown()
    
    log("\n📊 Test Results:", {
      exportAttempts,
      exportSuccesses,
      exportFailures,
      lastError: lastError ? String(lastError) : null,
      verdict: exportSuccesses > 0 ? "✅ WORKING" : "❌ NOT WORKING"
    })
    
    return exportSuccesses > 0
    
  } catch (error) {
    log("❌ Test crashed:", {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return false
  }
}

realTest()
  .then(success => process.exit(success ? 0 : 1))
  .catch(() => process.exit(1))
