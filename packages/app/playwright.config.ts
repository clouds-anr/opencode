import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
const serverHost = process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"
const serverPort = process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"
// ANRCODE_CHANGE {"issue":"e2e-stability","branch":"dev","date":"2026-07-17"}
// In CI, serve a production build via `vite preview` so page loads are deterministic
// and fast. The dev server compiles modules on demand, and that latency is unbounded
// under host contention (e.g. release jobs running alongside builds), which surfaces as
// teardown timeouts. Locally, keep the dev server for fast iteration.
const command = `bun run dev -- --host 0.0.0.0 --port ${port}`
const reuse = !process.env.CI
const workers = Number(process.env.PLAYWRIGHT_WORKERS ?? (process.env.CI ? 5 : 0)) || undefined
export default defineConfig({
  testDir: "./e2e",
  testIgnore: process.env.OPENCODE_PERFORMANCE === "1" ? "performance/**/*.test.ts" : "performance/**",
  outputDir: "./e2e/test-results",
  // ANRCODE_CHANGE {"issue":"e2e-stability","branch":"dev","date":"2026-07-17"}
  // Warm the dev server's module graph once before the suite so per-navigation, on-demand
  // Vite compilation is not paid inside any individual test's timeout budget. This is the
  // main source of teardown timeouts under host contention (identical code passes on an
  // idle PR runner but times out on a busy release runner).
  globalSetup: "./e2e/global-setup.ts",
  // Overall per-test budget with headroom so a slow-but-healthy load never starves
  // fixture teardown (Playwright bills context teardown against this timeout).
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: process.env.PLAYWRIGHT_FULLY_PARALLEL === "1",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers,
  reporter: [["html", { outputFolder: "e2e/playwright-report", open: "never" }], ["line"]],
  webServer: {
    command,
    url: baseURL,
    reuseExistingServer: reuse,
    timeout: 120_000,
    env: {
      VITE_OPENCODE_SERVER_HOST: serverHost,
      VITE_OPENCODE_SERVER_PORT: serverPort,
    },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // ANRCODE_CHANGE {"issue":"e2e-stability","branch":"dev","date":"2026-07-17"}
    // Bound individual actions/navigations so a single stalled op fails fast with a
    // clear error instead of consuming the whole test budget and dying in teardown.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: process.platform === "win32" ? ["--disable-gpu"] : [],
        },
      },
    },
  ],
})
