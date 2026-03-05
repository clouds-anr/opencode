/**
 * Debug logger for development and troubleshooting
 * Provides structured logging with log levels and filtering
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error"

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: Record<string, any>
  context?: Record<string, any>
}

class DebugLogger {
  private logs: LogEntry[] = []
  private maxLogs = 10000
  private logLevel: LogLevel = "info"
  private enabled = process.env.OPENCODE_DEBUG_OTEL === "1" || process.env.OPENCODE_DEBUG === "1"

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false
    const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error"]
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }

  private addLog(level: LogLevel, message: string, data?: Record<string, any>, context?: Record<string, any>): void {
    if (!this.enabled) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data && { data }),
      ...(context && { context }),
    }

    this.logs.push(entry)

    // Trim old logs if we exceed max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  trace(message: string, data?: Record<string, any>): void {
    if (this.shouldLog("trace")) {
      this.addLog("trace", message, data)
    }
  }

  debug(message: string, data?: Record<string, any>): void {
    if (this.shouldLog("debug")) {
      this.addLog("debug", message, data)
    }
  }

  info(message: string, data?: Record<string, any>): void {
    if (this.shouldLog("info")) {
      this.addLog("info", message, data)
    }
  }

  warn(message: string, data?: Record<string, any>): void {
    if (this.shouldLog("warn")) {
      this.addLog("warn", message, data)
    }
  }

  error(message: string, data?: Record<string, any>): void {
    if (this.shouldLog("error")) {
      this.addLog("error", message, data)
    }
  }

  getLogs(filter?: { level?: LogLevel; keyword?: string; maxResults?: number }): LogEntry[] {
    let result = [...this.logs]

    if (filter?.level) {
      const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error"]
      const minLevel = levels.indexOf(filter.level)
      result = result.filter((log) => levels.indexOf(log.level) >= minLevel)
    }

    if (filter?.keyword) {
      const kw = filter.keyword.toLowerCase()
      result = result.filter(
        (log) =>
          log.message.toLowerCase().includes(kw) ||
          (log.data && JSON.stringify(log.data).toLowerCase().includes(kw))
      )
    }

    if (filter?.maxResults) {
      result = result.slice(-filter.maxResults)
    }

    return result
  }

  clear(): void {
    this.logs = []
  }

  exportJSON(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  exportCSV(): string {
    const headers = ["timestamp", "level", "message", "data"]
    const rows = this.logs.map((log) => [
      log.timestamp,
      log.level,
      log.message,
      log.data ? JSON.stringify(log.data) : "",
    ])

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    return csvContent
  }

  getSummary(): {
    total: number
    byLevel: Record<LogLevel, number>
    errors: LogEntry[]
    warnings: LogEntry[]
  } {
    const byLevel: Record<LogLevel, number> = {
      trace: 0,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    }

    this.logs.forEach((log) => {
      byLevel[log.level]++
    })

    return {
      total: this.logs.length,
      byLevel,
      errors: this.logs.filter((log) => log.level === "error"),
      warnings: this.logs.filter((log) => log.level === "warn"),
    }
  }
}

export const debugLogger = new DebugLogger()
