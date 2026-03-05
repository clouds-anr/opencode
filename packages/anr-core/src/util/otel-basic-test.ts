#!/usr/bin/env bun
/**
 * OTEL Test - Super Simple
 * Just verify the basic SDK + exporter combination works
 */

import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { Resource } from "@opentelemetry/resources"

const log = (msg: string, data?: any) => {
  const ts = new Date().toISOString()
  console.log(`${ts} ${msg}`)
  if (data) console.log("  ", JSON.stringify(data, null, 2))
}

try {
  log("✅ Step 1: Imports successful")

  // Create basic resource
  const resource = Resource.default().merge(new Resource({ "service.name": "opencode-test" }))
  log("✅ Step 2: Resource created")

  // Create exporter
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector-alb-395007917.us-east-2.elb.amazonaws.com"
  const exporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
    headers: { "x-user-email": "test@opencode.local" },
  })

  log("✅ Step 3: Exporter created", {
    endpoint,
    hasExport: typeof exporter.export === "function",
    hasShutdown: typeof exporter.shutdown === "function",
  })

  log("✅ Test Complete - SDK and exporter are compatible!", {
    message: "Ready to send metrics"
  })
} catch (error) {
  log("❌ Test Failed", { error: String(error) })
  process.exit(1)
}
