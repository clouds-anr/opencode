// ANRCODE_CHANGE {"issue":"e2e-stability","branch":"dev","date":"2026-07-17"}
import { chromium } from "@playwright/test"

// The e2e suite runs against the Vite dev server, which transpiles modules on demand the
// first time a route imports them. That first-hit latency is unbounded under host
// contention (idle PR runners are fast; busy release runners are not), and because
// Playwright bills fixture teardown against the per-test timeout it surfaces as flaky
// "Tearing down context exceeded the test timeout" failures.
//
// Warming the shared dev server once here compiles the core graph and the heaviest lazy
// route chunks up front, outside any individual test's budget, so per-test navigations hit
// a warm transform cache. Data calls will fail without a mock server; that is fine — the
// point is to force Vite to compile the modules the router lazily imports.
export default async function globalSetup() {
  const port = process.env.PLAYWRIGHT_PORT ?? "3000"
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
  // Representative routes that pull the largest lazy chunks (session view, new-session).
  const routes = ["/", "/new-session", `/${btoa("C:/OpenCode/Warmup")}/session`]

  const browser = await chromium.launch({
    args: process.platform === "win32" ? ["--disable-gpu"] : [],
  })
  const page = await browser.newPage()
  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 90_000 }).catch(() => {})
  }
  await browser.close()
}
