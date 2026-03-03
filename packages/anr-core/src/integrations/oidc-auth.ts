/**
 * OIDC Authentication for ANR OpenCode
 * Follows the Go app's OIDC flow with PKCE for Cognito authentication
 */

import { createServer, IncomingMessage, ServerResponse } from "http"
import { randomBytes } from "crypto"
import { createHash } from "crypto"
import { exec } from "child_process"
import { promisify } from "util"
import type { ANRConfig } from "../config/types"

const execAsync = promisify(exec)

export interface OIDCTokens {
  idToken: string
  accessToken: string
}

function generateRandomString(bytes: number): string {
  return randomBytes(bytes).toString("base64url")
}

function computeCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

async function openBrowser(url: string): Promise<void> {
  try {
    const { platform } = await import("os")
    const os = platform()

    if (os === "darwin") {
      await execAsync(`open "${url}"`)
    } else if (os === "win32") {
      // Try multiple approaches for Windows
      try {
        await execAsync(`powershell -NoProfile -Command "Start-Process '${url}'"`)
      } catch {
        try {
          await execAsync(`rundll32 url.dll,FileProtocolHandler "${url}"`)
        } catch {
          console.error(`Failed to open browser. Please visit: ${url}`)
        }
      }
    } else {
      await execAsync(`xdg-open "${url}"`)
    }
  } catch (err) {
    console.error(`Could not open browser: ${err}`)
  }
}

export async function authenticateWithOIDC(config: ANRConfig): Promise<OIDCTokens> {
  const redirectPort = 8400
  const redirectURI = `http://localhost:${redirectPort}/callback`

  // Generate PKCE parameters
  const state = generateRandomString(16)
  const nonce = generateRandomString(16)
  const codeVerifier = generateRandomString(32)
  const codeChallenge = computeCodeChallenge(codeVerifier)

  // Build authorization URL
  const domain = config.providerDomain
  const baseURL = `https://${domain}`

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid email",
    redirect_uri: redirectURI,
    state: state,
    nonce: nonce,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  })

  const authURL = `${baseURL}/login?${params.toString()}`

  console.log(`🌐 Opening browser for authentication...`)
  console.log(`   Callback: ${redirectURI}`)

  // Set up callback server
  let callbackCode: string | null = null
  let callbackError: string | null = null
  let serverReady = false
  let clientConnected = false

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400)
      res.end("Bad request")
      return
    }

    if (req.url.startsWith("/callback")) {
      clientConnected = true
      const url = new URL(req.url, `http://localhost:${redirectPort}`)
      const code = url.searchParams.get("code")
      const returnedState = url.searchParams.get("state")
      const error = url.searchParams.get("error")

      if (error) {
        callbackError = url.searchParams.get("error_description") || error
        res.writeHead(400, { "Content-Type": "text/html" })
        res.end(
          `<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Authentication Failed</h1>
            <p>${callbackError}</p>
            <p>Return to your terminal to continue.</p>
          </body></html>`
        )
        return
      }

      if (returnedState !== state || !code) {
        callbackError = "Invalid state or missing code"
        res.writeHead(400, { "Content-Type": "text/html" })
        res.end(
          `<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Authentication Failed</h1>
            <p>Invalid response from server</p>
            <p>Return to your terminal to continue.</p>
          </body></html>`
        )
        return
      }

      callbackCode = code
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(
        `<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>Authentication Successful!</h1>
          <p>You can close this window and return to your terminal.</p>
        </body></html>`
      )
    }
  })

  return new Promise((resolve, reject) => {
    server.listen(redirectPort, "127.0.0.1", async () => {
      serverReady = true
      console.log(`   Server ready on http://localhost:${redirectPort}`)

      // Open browser
      await openBrowser(authURL)

      // Wait for callback
      const timeout = 5 * 60 * 1000 // 5 minutes
      const startTime = Date.now()

      const checkInterval = setInterval(() => {
        if (callbackCode) {
          clearInterval(checkInterval)
          exchangeCode()
        } else if (callbackError) {
          clearInterval(checkInterval)
          server.close()
          reject(new Error(`Authentication failed: ${callbackError}`))
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval)
          server.close()
          reject(new Error("Authentication timeout"))
        }
      }, 100)
    })

    async function exchangeCode() {
      if (!callbackCode) {
        server.close()
        reject(new Error("No authorization code received"))
        return
      }

      try {
        const baseURL = `https://${config.providerDomain}`
        const tokenURL = `${baseURL}/oauth2/token`

        const body = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: config.clientId,
          code: callbackCode,
          redirect_uri: redirectURI,
          code_verifier: codeVerifier,
        })

        const res = await fetch(tokenURL, {
          method: "POST",
          body: body.toString(),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })

        if (!res.ok) {
          throw new Error(`Token request failed: ${res.statusText}`)
        }

        const data = await res.json() as { id_token?: string; access_token?: string }

        if (!data.id_token) {
          throw new Error("No ID token in response")
        }

        server.close()
        resolve({
          idToken: data.id_token,
          accessToken: data.access_token || "",
        })
      } catch (err) {
        server.close()
        reject(err)
      }
    }

    server.on("error", (err) => {
      reject(err)
    })
  })
}
