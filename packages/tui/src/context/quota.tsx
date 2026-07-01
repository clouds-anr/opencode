import { createMemo, createEffect, onCleanup, createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"
import * as fs from "fs"
import * as path from "path"

const QUOTA_LOG = path.join(process.env.HOME || "/tmp", ".opencode-quota.log")

function logQuota(msg: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const line = data ? `[${timestamp}] ${msg} ${JSON.stringify(data)}` : `[${timestamp}] ${msg}`
  try {
    fs.appendFileSync(QUOTA_LOG, line + "\n")
  } catch {
    // ignore write errors
  }
}

export interface QuotaInfo {
  dailyTokens: number
  monthlyTokens: number
  dailyLimit: number
  monthlyLimit: number
  dailyPercent: number
  monthlyPercent: number
  warningLevel: "normal" | "warning" | "critical"
  warningColor: "green" | "yellow" | "red"
  allowed: boolean
}

/** Parse quota fields from a plain env-var map (injectable in tests). */
export function parseQuotaEnvVars(env: Record<string, string | undefined>): QuotaInfo {
  return {
    dailyTokens: parseInt(env.OPENCODE_ANR_QUOTA_DAILY_TOKENS || "0"),
    monthlyTokens: parseInt(env.OPENCODE_ANR_QUOTA_MONTHLY_TOKENS || "0"),
    dailyLimit: parseInt(env.OPENCODE_ANR_QUOTA_DAILY_LIMIT || "0"),
    monthlyLimit: parseInt(env.OPENCODE_ANR_QUOTA_MONTHLY_LIMIT || "0"),
    dailyPercent: parseInt(env.OPENCODE_ANR_QUOTA_DAILY_PERCENT || "0"),
    monthlyPercent: parseInt(env.OPENCODE_ANR_QUOTA_MONTHLY_PERCENT || "0"),
    warningLevel: (env.OPENCODE_ANR_QUOTA_WARNING_LEVEL || "normal") as "normal" | "warning" | "critical",
    warningColor: (env.OPENCODE_ANR_QUOTA_WARNING_COLOR || "green") as "green" | "yellow" | "red",
    allowed: env.OPENCODE_ANR_QUOTA_ALLOWED !== "false",
  }
}

/** Effective token count = base tokens from last API refresh + untracked local delta. */
export function computeEffectiveTokens(base: number, localDelta: number): number {
  return base + localDelta
}

/** Effective usage percent for a single dimension (daily or monthly). Returns 0 when no limit is set. */
export function computeEffectivePercent(tokens: number, localDelta: number, limit: number): number {
  return limit > 0 ? Math.round(((tokens + localDelta) / limit) * 100) : 0
}

/** Derive warning level from effective daily and monthly percentages. */
export function computeWarningLevel(
  dailyPercent: number,
  monthlyPercent: number,
): "normal" | "warning" | "critical" {
  const max = Math.max(dailyPercent, monthlyPercent)
  if (max >= 90) return "critical"
  if (max >= 80) return "warning"
  return "normal"
}

/** Map warning level to the corresponding display color. */
export function computeWarningColor(
  level: "normal" | "warning" | "critical",
): "green" | "yellow" | "red" {
  if (level === "critical") return "red"
  if (level === "warning") return "yellow"
  return "green"
}

/** Progress bar fill width (out of maxWidth cells); always at least 1 cell wide. */
export function progressBarWidth(percent: number, maxWidth: number): number {
  return Math.max(1, Math.round((percent / 100) * maxWidth))
}

function readQuotaEnv(): QuotaInfo {
  const env = process.env

  logQuota("🔍 Checking process.env for quota vars:", {
    OPENCODE_ANR_QUOTA_DAILY_LIMIT: env.OPENCODE_ANR_QUOTA_DAILY_LIMIT,
    OPENCODE_ANR_QUOTA_MONTHLY_LIMIT: env.OPENCODE_ANR_QUOTA_MONTHLY_LIMIT,
    OPENCODE_ANR_QUOTA_DAILY_TOKENS: env.OPENCODE_ANR_QUOTA_DAILY_TOKENS,
    OPENCODE_ANR_QUOTA_MONTHLY_TOKENS: env.OPENCODE_ANR_QUOTA_MONTHLY_TOKENS,
  })

  const info = parseQuotaEnvVars(env)

  logQuota("📋 Quota env vars loaded:", {
    dailyLimit: info.dailyLimit,
    monthlyLimit: info.monthlyLimit,
    dailyTokens: info.dailyTokens,
    monthlyTokens: info.monthlyTokens,
  })

  return info
}

/**
 * Refresh quota by calling the API endpoint directly
 * This allows the TUI to see updated quota usage in real-time
 */
async function refreshQuotaFromAPI(): Promise<QuotaInfo | null> {
  try {
    const endpoint = process.env.OPENCODE_API_ENDPOINT
    const idToken = process.env.OPENCODE_ANR_ID_TOKEN
    const userEmail = process.env.OPENCODE_ANR_USER_EMAIL

    if (!endpoint || !idToken || !userEmail) {
      logQuota("❌ Quota API: Missing credentials (endpoint, token, or email)")
      return null
    }

    const url = `${endpoint.replace(/\/$/, "")}/quota`
    logQuota(`📡 Quota API: Calling ${url.split("/").slice(0, 3).join("/")}...`)

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      logQuota(`❌ Quota API: HTTP ${response.status}`)
      return null
    }

    const data = (await response.json()) as Record<string, unknown>
    const responseBody = typeof data?.body === "string" ? JSON.parse(data.body) : data

    logQuota("✅ Quota API: Response received", {
      usage: responseBody.usage,
      allowed: responseBody.allowed,
      hasPolicy: !!responseBody.policy,
    })

    const usage = (responseBody.usage as Record<string, unknown>) || {}
    const dailyTokens = parseInt(String(usage.daily_tokens ?? "0"))
    const monthlyTokens = parseInt(String(usage.monthly_tokens ?? "0"))
    const dailyLimit = parseInt(String(usage.daily_limit ?? "0"))
    const monthlyLimit = parseInt(String(usage.monthly_limit ?? "0"))

    logQuota("📊 Quota parsed:", { dailyTokens, monthlyTokens, dailyLimit, monthlyLimit })

    const dailyPercent = computeEffectivePercent(dailyTokens, 0, dailyLimit)
    const monthlyPercent = computeEffectivePercent(monthlyTokens, 0, monthlyLimit)
    const warningLevel = computeWarningLevel(dailyPercent, monthlyPercent)
    const warningColor = computeWarningColor(warningLevel)

    return {
      dailyTokens,
      monthlyTokens,
      dailyLimit,
      monthlyLimit,
      dailyPercent,
      monthlyPercent,
      warningLevel,
      warningColor,
      allowed: (responseBody.allowed as boolean) ?? true,
    }
  } catch (error) {
    logQuota("❌ Quota API error:", error instanceof Error ? error.message : String(error))
    return null
  }
}

const initialQuota = readQuotaEnv()

export interface QuotaContext extends QuotaInfo {
  /** Local token delta accumulated since last API refresh */
  localDelta: number
  /** Effective daily tokens (API + local delta) */
  effectiveDailyTokens: number
  /** Effective monthly tokens (API + local delta) */
  effectiveMonthlyTokens: number
  /** Effective daily usage percent */
  effectiveDailyPercent: number
  /** Effective monthly usage percent */
  effectiveMonthlyPercent: number
  /** Effective warning level based on effective percentages */
  effectiveWarningLevel: "normal" | "warning" | "critical"
  /** Effective warning color based on effective percentages */
  effectiveWarningColor: "green" | "yellow" | "red"
  /** Add tokens to the local delta (call after each model step) */
  addTokens: (count: number) => void
  /** Schedule an API refresh after model activity */
  scheduleRefresh: () => void
}

const POST_ACTIVITY_REFRESH_DELAY = 30_000

export const { use: useQuota, provider: QuotaProvider } = createSimpleContext<QuotaContext, { quotaInfo?: QuotaInfo }>({
  name: "Quota",
  init: (props?: { quotaInfo?: QuotaInfo }) => {
    const passedQuotaInfo = props?.quotaInfo
    const [quota, setQuota] = createStore(passedQuotaInfo || initialQuota)
    const [localDelta, setLocalDelta] = createSignal(0)

    let refreshTimer: ReturnType<typeof setTimeout> | undefined

    const doRefresh = async () => {
      const updated = await refreshQuotaFromAPI()
      if (updated) {
        setLocalDelta(0)
        setQuota(updated)
        logQuota("API refresh completed, localDelta reset to 0", {
          dailyTokens: updated.dailyTokens,
          monthlyTokens: updated.monthlyTokens,
        })
      }
    }

    // Set up periodic refresh from API
    const interval = parseInt(process.env.OPENCODE_QUOTA_CHECK_INTERVAL || "300")

    if (interval > 0) {
      const timerId = setInterval(doRefresh, interval * 1000)
      onCleanup(() => clearInterval(timerId))
    }

    const addTokens = (count: number) => {
      setLocalDelta((prev) => prev + count)
      logQuota("localDelta updated", { added: count, newDelta: localDelta() + count })
    }

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(doRefresh, POST_ACTIVITY_REFRESH_DELAY)
    }

    onCleanup(() => {
      if (refreshTimer) clearTimeout(refreshTimer)
    })

    const effectiveDailyTokens = createMemo(() => computeEffectiveTokens(quota.dailyTokens, localDelta()))
    const effectiveMonthlyTokens = createMemo(() => computeEffectiveTokens(quota.monthlyTokens, localDelta()))
    const effectiveDailyPercent = createMemo(() =>
      computeEffectivePercent(quota.dailyTokens, localDelta(), quota.dailyLimit),
    )
    const effectiveMonthlyPercent = createMemo(() =>
      computeEffectivePercent(quota.monthlyTokens, localDelta(), quota.monthlyLimit),
    )
    const effectiveWarningLevel = createMemo(() =>
      computeWarningLevel(effectiveDailyPercent(), effectiveMonthlyPercent()),
    )
    const effectiveWarningColor = createMemo(() => computeWarningColor(effectiveWarningLevel()))

    // Return a reactive object that merges the API store with computed effective values
    const [result, setResult] = createStore<QuotaContext>({
      ...quota,
      localDelta: localDelta(),
      effectiveDailyTokens: effectiveDailyTokens(),
      effectiveMonthlyTokens: effectiveMonthlyTokens(),
      effectiveDailyPercent: effectiveDailyPercent(),
      effectiveMonthlyPercent: effectiveMonthlyPercent(),
      effectiveWarningLevel: effectiveWarningLevel(),
      effectiveWarningColor: effectiveWarningColor(),
      addTokens,
      scheduleRefresh,
    })

    // Keep result in sync with quota store changes
    createEffect(() => {
      setResult({
        ...quota,
        localDelta: localDelta(),
        effectiveDailyTokens: effectiveDailyTokens(),
        effectiveMonthlyTokens: effectiveMonthlyTokens(),
        effectiveDailyPercent: effectiveDailyPercent(),
        effectiveMonthlyPercent: effectiveMonthlyPercent(),
        effectiveWarningLevel: effectiveWarningLevel(),
        effectiveWarningColor: effectiveWarningColor(),
        addTokens,
        scheduleRefresh,
      })
    })

    return result
  },
})
