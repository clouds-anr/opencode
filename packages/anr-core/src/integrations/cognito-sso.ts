/**
 * AWS Cognito SSO Integration for ANR OpenCode
 * Handles automatic authentication via Cognito Identity Pool
 */

import { fromIni } from "@aws-sdk/credential-providers"
import type { ANRConfig } from "../config/types"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export interface CognitoCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  expiration?: Date
}

/**
 * Check if SSO credentials are available and valid
 */
async function checkSSOCredentials(profile: string): Promise<boolean> {
  try {
    const credentialProvider = fromIni({ profile })
    const creds = await Promise.race([
      credentialProvider(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))
    ]) as any
    
    // Check if credentials appear expired locally
    if (creds?.expiration) {
      const now = new Date()
      // Add 1 minute buffer to proactively refresh expiring credentials
      const bufferTime = new Date(now.getTime() + 1 * 60 * 1000)
      
      if ((creds.expiration as any) <= bufferTime) {
        return false // Credentials are expired or expiring soon
      }
    }
    
    return true
  } catch (error) {
    // Any error means credentials are invalid/unavailable
    return false
  }
}

/**
 * Initiate SSO login via AWS CLI
 */
async function initiateSSO(profile: string, quiet = false): Promise<void> {
  if (!quiet) {
    console.log("\n🔐 AWS SSO authentication required")
    console.log(`   Profile: ${profile}`)
    console.log("   Running: aws sso login")
    console.log("   ⏳ A browser window should open for authentication...")
    console.log("   If not, please manually run: aws sso login --profile " + profile)
    console.log()
  }

  try {
    // Use spawn instead of exec to inherit stdio and allow browser interaction
    const { spawn } = require("child_process")
    
    const ssoProcess = spawn("aws", ["sso", "login", "--profile", profile], {
      stdio: quiet ? "pipe" : "inherit",
      shell: true,
    })

    await new Promise<void>((resolve, reject) => {
      ssoProcess.on("exit", (code: number) => {
        if (code === 0) {
          if (!quiet) console.log("\n✅ SSO authentication complete!\n")
          resolve()
        } else {
          reject(new Error(`SSO login failed with code ${code}`))
        }
      })
      
      ssoProcess.on("error", (err: Error) => {
        reject(err)
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw new Error("AWS CLI not found. Please install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html")
    }
    throw error
  }
}

/**
 * Auto-login via AWS Profile (supports SSO with automatic browser auth)
 */
export async function authenticateWithCognito(config: ANRConfig, quiet = false, forceSSORefresh = false): Promise<CognitoCredentials> {
  if (!quiet) console.log("🔐 Checking AWS credentials...")

  // Always initiate SSO login flow (like the Go app does)
  // This ensures browser opens for authentication
  if (!quiet) console.log("   Initiating AWS SSO login...")
  await initiateSSO(config.awsProfile, quiet)

  try {
    // Get credentials
    const credentialProvider = fromIni({
      profile: config.awsProfile,
    })

    const credentials = await credentialProvider()

    if (!quiet) console.log("✅ Successfully authenticated with AWS profile:", config.awsProfile)

    return {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      expiration: credentials.expiration,
    }
  } catch (error) {
    if (!quiet) console.error("❌ AWS authentication failed:", error)
    throw new Error(`Failed to authenticate with AWS profile '${config.awsProfile}': ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Check if credentials are expired or expiring soon
 */
export function areCredentialsExpired(credentials: CognitoCredentials): boolean {
  if (!credentials.expiration) return false

  const now = new Date()
  const bufferMinutes = 5 // Refresh 5 minutes before expiry
  const expiryWithBuffer = new Date(credentials.expiration.getTime() - bufferMinutes * 60 * 1000)

  return now >= expiryWithBuffer
}

/**
 * Refresh credentials if needed
 */
export async function ensureValidCredentials(
  config: ANRConfig,
  currentCredentials?: CognitoCredentials
): Promise<CognitoCredentials> {
  if (currentCredentials && !areCredentialsExpired(currentCredentials)) {
    return currentCredentials
  }

  console.log("🔄 Refreshing AWS credentials...")
  return authenticateWithCognito(config)
}

/**
 * Set AWS credentials in environment for Bedrock access
 */
export function setAWSCredentialsEnv(credentials: CognitoCredentials): void {
  process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId
  process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey
  if (credentials.sessionToken) {
    process.env.AWS_SESSION_TOKEN = credentials.sessionToken
  }
}
