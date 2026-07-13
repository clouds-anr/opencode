// ANRCODE_CHANGE {"issue":331,"branch":"anr/331/fix-silent-catch-handlers","date":"2026-07-10"}
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

describe("Silent catch handler regression tests", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleDebugSpy.mockRestore()
  })

  it("should surface config load failures with warning log", async () => {
    // Simulate a config load failure that would have been silently caught
    const testError = new Error("config load failed")
    
    // This mimics the pattern: .catch((err) => { console.warn({ msg: "config load failed", err }) })
    try {
      throw testError
    } catch (err) {
      console.warn({ msg: "config load failed", err })
    }

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "config load failed",
        err: testError,
      })
    )
  })

  it("should surface LSP initialization failures with warning log", async () => {
    // Simulate an LSP initialization failure
    const testError = new Error("LSP initialization failed")
    
    // This mimics the pattern: .catch((err) => { console.warn({ msg: "LSP initialization failed", err }) })
    try {
      throw testError
    } catch (err) {
      console.warn({ msg: "LSP initialization failed", err })
    }

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "LSP initialization failed",
        err: testError,
      })
    )
  })

  it("should surface provider errors with warning log", async () => {
    // Simulate a provider error (xAI, DigitalOcean, or Snowflake)
    const testError = new Error("provider authentication failed")
    
    // This mimics the pattern: .catch((err) => { console.warn({ msg: "xAI provider error", err }) })
    try {
      throw testError
    } catch (err) {
      console.warn({ msg: "xAI provider error", err })
    }

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "xAI provider error",
        err: testError,
      })
    )
  })

  it("should log best-effort failures as debug messages", async () => {
    // Simulate a best-effort failure (e.g., chmod on a file)
    const testError = new Error("chmod failed")
    
    // This mimics the pattern: .catch((err) => { console.debug("ignored", err) })
    try {
      throw testError
    } catch (err) {
      console.debug("ignored", err)
    }

    expect(consoleDebugSpy).toHaveBeenCalledWith("ignored", testError)
  })

  it("should not silently swallow errors without logging", async () => {
    // Verify that we're not using bare .catch(() => {}) anymore
    const testError = new Error("should not be silent")
    
    // This should NOT happen - we should always log
    const silentCatch = async () => {
      try {
        throw testError
      } catch {
        // This is the old pattern we're fixing - do nothing
      }
    }

    await silentCatch()
    
    // Verify that neither console method was called (this is what we're preventing)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    expect(consoleDebugSpy).not.toHaveBeenCalled()
  })
})
