/**
 * Helper script to initiate AWS SSO login before running ANR OpenCode
 */

import { exec } from "child_process"
import { promisify } from "util"
import { loadANRConfig } from "./config/env-loader"

const execAsync = promisify(exec)

async function ssoLogin() {
  console.log("🔐 AWS SSO Login Helper\n")

  try {
    // Load config to get profile name
    const config = await loadANRConfig()
    const profile = config.awsProfile

    console.log(`Initiating SSO login for profile: ${profile}`)
    console.log("This will open your browser for authentication...\n")

    // Run aws sso login
    const { stdout, stderr } = await execAsync(`aws sso login --profile ${profile}`, {
      timeout: 120000, // 2 minutes
    })

    if (stdout) console.log(stdout)
    if (stderr) console.error(stderr)

    console.log("\n✅ SSO login complete!")
    console.log("   You can now run: bun dev:anr-full")

  } catch (error) {
    console.error("\n❌ SSO login failed")
    
    if (error instanceof Error) {
      if (error.message.includes("aws: command not found")) {
        console.error("\n💡 AWS CLI not found. Please install it:")
        console.error("   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html")
      } else if (error.message.includes("timeout")) {
        console.error("\n💡 Login timed out. Please complete authentication in your browser.")
      } else {
        console.error("   ", error.message)
      }
    }

    process.exit(1)
  }
}

ssoLogin()
