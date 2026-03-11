import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { getCurrentWindow } from "@tauri-apps/api/window"

let counter = 0

export async function openAuthWindow(url: string): Promise<() => void> {
  const label = `auth-${++counter}`
  const parent = getCurrentWindow()

  const webview = new WebviewWindow(label, {
    url,
    title: "Sign in",
    width: 520,
    height: 720,
    center: true,
    resizable: true,
    focus: true,
    parent,
  })

  const close = () => {
    webview.close().catch(() => undefined)
  }

  await new Promise<void>((resolve, reject) => {
    webview.once("tauri://created", () => resolve())
    webview.once("tauri://error", (e) => reject(new Error(String(e.payload))))
  })

  return close
}
