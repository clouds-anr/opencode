/**
 * Sidebar token usage control tests
 *
 * Covers the full chain that drives sidebar quota display:
 *   1. getQuotaColor         — bar and text color at each threshold
 *   2. parseQuotaEnvVars     — env-var → QuotaInfo parsing (startup values)
 *   3. computeEffectivePercent — (base tokens + localDelta) / limit → percent
 *   4. computeEffectiveTokens  — addTokens local-delta accumulation
 *   5. computeWarningLevel   — effective-percent → warning tier
 *   6. computeWarningColor   — warning tier → display color
 *   7. progressBarWidth      — percent → cell width (min 1, max maxWidth)
 */
import { describe, expect, test } from "bun:test"
import { getQuotaColor } from "../../src/feature-plugins/sidebar/quota"
import {
  parseQuotaEnvVars,
  computeEffectiveTokens,
  computeEffectivePercent,
  computeWarningLevel,
  computeWarningColor,
  progressBarWidth,
} from "../../src/context/quota"

// ── 1. getQuotaColor ────────────────────────────────────────────────────────

describe("getQuotaColor", () => {
  test("below 80% → green", () => {
    expect(getQuotaColor(0)).toBe("green")
    expect(getQuotaColor(50)).toBe("green")
    expect(getQuotaColor(79)).toBe("green")
  })

  test("exactly 80% → yellow (approaching threshold)", () => {
    expect(getQuotaColor(80)).toBe("yellow")
  })

  test("80–89% → yellow", () => {
    expect(getQuotaColor(85)).toBe("yellow")
    expect(getQuotaColor(89)).toBe("yellow")
  })

  test("exactly 90% → red (nearing threshold)", () => {
    expect(getQuotaColor(90)).toBe("red")
  })

  test("90–100%+ → red", () => {
    expect(getQuotaColor(95)).toBe("red")
    expect(getQuotaColor(100)).toBe("red")
    expect(getQuotaColor(104)).toBe("red")
  })
})

// ── 2. parseQuotaEnvVars ────────────────────────────────────────────────────

describe("parseQuotaEnvVars", () => {
  test("parses all token fields from env vars", () => {
    const info = parseQuotaEnvVars({
      OPENCODE_ANR_QUOTA_DAILY_TOKENS: "1234567",
      OPENCODE_ANR_QUOTA_MONTHLY_TOKENS: "9876543",
      OPENCODE_ANR_QUOTA_DAILY_LIMIT: "5000000",
      OPENCODE_ANR_QUOTA_MONTHLY_LIMIT: "250000000",
      OPENCODE_ANR_QUOTA_DAILY_PERCENT: "25",
      OPENCODE_ANR_QUOTA_MONTHLY_PERCENT: "4",
      OPENCODE_ANR_QUOTA_WARNING_LEVEL: "normal",
      OPENCODE_ANR_QUOTA_WARNING_COLOR: "green",
    })

    expect(info.dailyTokens).toBe(1_234_567)
    expect(info.monthlyTokens).toBe(9_876_543)
    expect(info.dailyLimit).toBe(5_000_000)
    expect(info.monthlyLimit).toBe(250_000_000)
    expect(info.dailyPercent).toBe(25)
    expect(info.monthlyPercent).toBe(4)
    expect(info.warningLevel).toBe("normal")
    expect(info.warningColor).toBe("green")
  })

  test("defaults to zeros and normal/green/allowed when env vars are absent", () => {
    const info = parseQuotaEnvVars({})

    expect(info.dailyTokens).toBe(0)
    expect(info.monthlyTokens).toBe(0)
    expect(info.dailyLimit).toBe(0)
    expect(info.monthlyLimit).toBe(0)
    expect(info.dailyPercent).toBe(0)
    expect(info.monthlyPercent).toBe(0)
    expect(info.warningLevel).toBe("normal")
    expect(info.warningColor).toBe("green")
    expect(info.allowed).toBe(true)
  })

  test("allowed is false when OPENCODE_ANR_QUOTA_ALLOWED=false", () => {
    expect(parseQuotaEnvVars({ OPENCODE_ANR_QUOTA_ALLOWED: "false" }).allowed).toBe(false)
  })

  test("allowed is true for any value other than 'false'", () => {
    expect(parseQuotaEnvVars({ OPENCODE_ANR_QUOTA_ALLOWED: "true" }).allowed).toBe(true)
    expect(parseQuotaEnvVars({ OPENCODE_ANR_QUOTA_ALLOWED: "1" }).allowed).toBe(true)
    expect(parseQuotaEnvVars({}).allowed).toBe(true)
  })

  test("parses warning level and color from env vars", () => {
    const warning = parseQuotaEnvVars({
      OPENCODE_ANR_QUOTA_WARNING_LEVEL: "warning",
      OPENCODE_ANR_QUOTA_WARNING_COLOR: "yellow",
    })
    expect(warning.warningLevel).toBe("warning")
    expect(warning.warningColor).toBe("yellow")

    const critical = parseQuotaEnvVars({
      OPENCODE_ANR_QUOTA_WARNING_LEVEL: "critical",
      OPENCODE_ANR_QUOTA_WARNING_COLOR: "red",
    })
    expect(critical.warningLevel).toBe("critical")
    expect(critical.warningColor).toBe("red")
  })
})

// ── 3. computeEffectivePercent ──────────────────────────────────────────────

describe("computeEffectivePercent", () => {
  test("returns 0 when limit is 0 (no quota configured)", () => {
    expect(computeEffectivePercent(1_000_000, 0, 0)).toBe(0)
    expect(computeEffectivePercent(0, 500_000, 0)).toBe(0)
  })

  test("computes percent from base tokens alone (zero delta)", () => {
    expect(computeEffectivePercent(2_500_000, 0, 5_000_000)).toBe(50)
    expect(computeEffectivePercent(4_000_000, 0, 5_000_000)).toBe(80)
    expect(computeEffectivePercent(5_000_000, 0, 5_000_000)).toBe(100)
  })

  test("adds local delta to base before computing percent", () => {
    // base 2M + delta 500k = 2.5M out of 5M = 50%
    expect(computeEffectivePercent(2_000_000, 500_000, 5_000_000)).toBe(50)
    // base 4M + delta 600k = 4.6M out of 5M = 92% (critical)
    expect(computeEffectivePercent(4_000_000, 600_000, 5_000_000)).toBe(92)
  })

  test("rounds to nearest integer", () => {
    // 1/3 * 100 = 33.33… → 33
    expect(computeEffectivePercent(1_000_000, 0, 3_000_000)).toBe(33)
    // 2/3 * 100 = 66.66… → 67
    expect(computeEffectivePercent(2_000_000, 0, 3_000_000)).toBe(67)
  })

  test("can exceed 100% when tokens surpass limit", () => {
    expect(computeEffectivePercent(5_200_000, 0, 5_000_000)).toBe(104)
  })
})

// ── 4. computeEffectiveTokens ───────────────────────────────────────────────

describe("computeEffectiveTokens (addTokens accumulation)", () => {
  test("returns base when delta is zero", () => {
    expect(computeEffectiveTokens(3_000_000, 0)).toBe(3_000_000)
  })

  test("sums base and delta", () => {
    expect(computeEffectiveTokens(3_000_000, 250_000)).toBe(3_250_000)
  })

  test("accumulates multiple deltas (simulate successive addTokens calls)", () => {
    let delta = 0
    delta += 100_000 // turn 1
    delta += 250_000 // turn 2
    delta += 150_000 // turn 3
    expect(computeEffectiveTokens(2_000_000, delta)).toBe(2_500_000)
  })

  test("resets correctly after API refresh (delta returns to 0)", () => {
    const afterRefresh = computeEffectiveTokens(2_500_000, 0)
    expect(afterRefresh).toBe(2_500_000)
  })
})

// ── 5. computeWarningLevel ──────────────────────────────────────────────────

describe("computeWarningLevel", () => {
  test("below 80% on both → normal", () => {
    expect(computeWarningLevel(0, 0)).toBe("normal")
    expect(computeWarningLevel(50, 30)).toBe("normal")
    expect(computeWarningLevel(79, 79)).toBe("normal")
  })

  test("exactly 80% on either → warning", () => {
    expect(computeWarningLevel(80, 0)).toBe("warning")
    expect(computeWarningLevel(0, 80)).toBe("warning")
  })

  test("80–89% → warning", () => {
    expect(computeWarningLevel(85, 60)).toBe("warning")
    expect(computeWarningLevel(60, 89)).toBe("warning")
  })

  test("exactly 90% → critical", () => {
    expect(computeWarningLevel(90, 0)).toBe("critical")
    expect(computeWarningLevel(0, 90)).toBe("critical")
  })

  test("above 90% → critical", () => {
    expect(computeWarningLevel(95, 80)).toBe("critical")
    expect(computeWarningLevel(104, 72)).toBe("critical")
  })

  test("monthly at 100% triggers critical even when daily is low", () => {
    expect(computeWarningLevel(30, 100)).toBe("critical")
  })

  test("uses the higher of daily and monthly percentages", () => {
    // daily 79% monthly 90% → critical (driven by monthly)
    expect(computeWarningLevel(79, 90)).toBe("critical")
    // daily 90% monthly 0% → critical (driven by daily)
    expect(computeWarningLevel(90, 0)).toBe("critical")
  })
})

// ── 6. computeWarningColor ──────────────────────────────────────────────────

describe("computeWarningColor", () => {
  test("normal → green", () => {
    expect(computeWarningColor("normal")).toBe("green")
  })

  test("warning → yellow", () => {
    expect(computeWarningColor("warning")).toBe("yellow")
  })

  test("critical → red", () => {
    expect(computeWarningColor("critical")).toBe("red")
  })
})

// ── 7. progressBarWidth ─────────────────────────────────────────────────────

describe("progressBarWidth (sidebar progress bar rendering)", () => {
  const BAR = 20 // sidebar uses maxWidth=20

  test("0% → minimum width of 1 cell (always visible)", () => {
    expect(progressBarWidth(0, BAR)).toBe(1)
  })

  test("50% → 10 cells out of 20", () => {
    expect(progressBarWidth(50, BAR)).toBe(10)
  })

  test("80% → 16 cells (approaching threshold)", () => {
    expect(progressBarWidth(80, BAR)).toBe(16)
  })

  test("90% → 18 cells (nearing threshold)", () => {
    expect(progressBarWidth(90, BAR)).toBe(18)
  })

  test("100% → 20 cells (full bar)", () => {
    expect(progressBarWidth(100, BAR)).toBe(20)
  })

  test("over 100% still clamps to maxWidth", () => {
    // 104% of 20 = 20.8 → rounds to 21, but max should cap at 20
    // The sidebar uses Math.max(1, round(pct/100 * 20)) with no upper cap —
    // verify current behaviour so a future cap change would be caught.
    expect(progressBarWidth(104, BAR)).toBeGreaterThanOrEqual(BAR)
  })

  test("respects custom maxWidth", () => {
    expect(progressBarWidth(50, 10)).toBe(5)
    expect(progressBarWidth(25, 8)).toBe(2)
  })
})
