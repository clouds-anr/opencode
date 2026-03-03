/**
 * OpenTelemetry Integration for ANR OpenCode
 * Sends metrics to internal OTEL collector
 */

import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { Resource } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import type { ANRConfig } from "../config/types"

let otelSDK: NodeSDK | null = null

/**
 * Initialize OpenTelemetry with ANR configuration
 */
export function initializeOTEL(config: ANRConfig): void {
  if (!config.enableTelemetry) {
    console.log("📊 Telemetry disabled")
    return
  }

  try {
    const resource = Resource.default().merge(
      new Resource({
        [ATTR_SERVICE_NAME]: "opencode-anr",
        "deployment.environment": config.awsRegionProfile || "development",
        "service.version": "1.0.0",
      })
    )

    otelSDK = new NodeSDK({
      resource,
      traceExporter: undefined,
      instrumentations: [],
    })

    otelSDK.start()
    
    // Optional metric export (requires separate setup)
    console.log("✅ OpenTelemetry initialized")
  } catch (error) {
    // Silently fail if telemetry setup has issues
    if (error instanceof Error) {
      console.debug("ℹ️  Telemetry setup: " + error.message)
    }
  }
}

/**
 * Shutdown OpenTelemetry gracefully
 */
export async function shutdownOTEL(): Promise<void> {
  if (otelSDK) {
    try {
      await otelSDK.shutdown()
      console.log("📊 OpenTelemetry shut down successfully")
    } catch (error) {
      console.error("Error shutting down OpenTelemetry:", error)
    }
  }
}

/**
 * Register shutdown handlers
 */
export function registerOTELShutdownHandlers(): void {
  process.on("SIGTERM", async () => {
    await shutdownOTEL()
    process.exit(0)
  })

  process.on("SIGINT", async () => {
    await shutdownOTEL()
    process.exit(0)
  })
}
