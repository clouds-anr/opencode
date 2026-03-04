import { createMemo, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"

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

function readQuotaEnv(): QuotaInfo {
  const env = process.env
  
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

/**
 * Refresh quota by calling the API endpoint directly
 * This allows the TUI to see updated quota usage in real-time
 */
async function refreshQuotaFromAPI(): Promise<QuotaInfo | null> {
  try {
    const endpoint = process.env.OPENCODE_ANR_QUOTA_API_ENDPOINT
    const idToken = process.env.OPENCODE_ANR_ID_TOKEN
    const userEmail = process.env.OPENCODE_ANR_USER_EMAIL

    if (!endpoint || !idToken || !userEmail) {
      return null
    }

    const url = `${endpoint.replace(/\/$/, "")}/check`
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as Record<string, unknown>
    const responseBody = typeof data?.body === "string" ? JSON.parse(data.body) : data

    const usage = (responseBody.usage as Record<string, unknown>) || {}
    const dailyTokens = parseInt(String(usage.daily_tokens ?? "0"))
    const monthlyTokens = parseInt(String(usage.monthly_tokens ?? "0"))
    const dailyLimit = parseInt(String(usage.daily_limit ?? "0"))
    const monthlyLimit = parseInt(String(usage.monthly_limit ?? "0"))

    const dailyPercent = dailyLimit > 0 ? Math.round((dailyTokens / dailyLimit) * 100) : 0
    const monthlyPercent = monthlyLimit > 0 ? Math.round((monthlyTokens / monthlyLimit) * 100) : 0

    // Determine warning level
    const maxPercent = Math.max(dailyPercent, monthlyPercent)
    let warningLevel: "normal" | "warning" | "critical" = "normal"
    if (maxPercent >= 90) warningLevel = "critical"
    else if (maxPercent >= 80) warningLevel = "warning"

    // Determine color
    let warningColor: "green" | "yellow" | "red" = "green"
    if (warningLevel === "critical") warningColor = "red"
    else if (warningLevel === "warning") warningColor = "yellow"

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
  } catch {
    return null
  }
}

const initialQuota = readQuotaEnv()

export const { use: useQuota, provider: QuotaProvider } = createSimpleContext({
  name: "Quota",
  init: () => {
    const [quota, setQuota] = createStore(initialQuota)

    // Set up periodic refresh from API
    const interval = parseInt(process.env.OPENCODE_QUOTA_CHECK_INTERVAL || "300")
    
    if (interval > 0) {
      const timerId = setInterval(async () => {
        const updated = await refreshQuotaFromAPI()
        if (updated) {
          setQuota(updated)
        }
      }, interval * 1000)

      onCleanup(() => {
        clearInterval(timerId)
      })
    }

    return quota
  },
})
