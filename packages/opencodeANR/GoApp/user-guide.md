# Claude Bedrock Client — User Guide

**Version:** 1.0+

This guide explains how to use Claude Bedrock Client to authenticate and launch Claude Code with AWS Bedrock.

---

## What Is This?

Claude Bedrock Client is a single application that:
- Authenticates you via your company's login system (Okta, Azure AD, Cognito, etc.)
- Sets up the necessary AWS permissions automatically
- Launches Claude Code with AWS Bedrock as the AI backend

**You only need to run it once** — it handles everything in the background after that.

---

## Getting Started

### First Time Setup

1. **Launch the application:**
   - **Windows:** Double-click `claude-bedrock.exe`
   - **macOS/Linux:** Run `./claude-bedrock` or `claude-bedrock` from terminal

2. **Authenticate:**
   - Your browser will open automatically
   - Sign in with your company credentials
   - Authorize the application when prompted
   - Close the browser window (or it closes automatically)

3. **Claude Code Launches:**
   - After authentication, Claude Code opens automatically
   - You're ready to start using Bedrock models

### After First Time

Just run the application — everything is cached and ready to go. Credentials refresh automatically.

```bash
# All you need:
./claude-bedrock
```

---

## CLI Reference

### Everyday Commands

| Command | What It Does | Example |
|---------|-------------|---------|
| *(none)* | Launch Claude Code | `./claude-bedrock` |
| `--setup` | Reconfigure without launching | `./claude-bedrock --setup` |
| `--status` | Check if everything is working | `./claude-bedrock --status` |
| `--version` | Show installed versions | `./claude-bedrock --version` |

### Maintenance Commands

| Command | Use When | Example |
|---------|----------|---------|
| `--clear-cache` | Credentials aren't working / Stuck in login loop | `./claude-bedrock --clear-cache` |
| `--check-expiration` | Want to verify credentials are still valid | `./claude-bedrock --check-expiration` |
| `--quota` | Need to see your token usage | `./claude-bedrock --quota` |

### Environment & Debugging

| Flag | What It Does | Example |
|------|-------------|---------|
| `-e <file>` | Use a different configuration | `./claude-bedrock -e env.staging` |
| `-p <profile>` | Use a different AWS profile | `./claude-bedrock -p staging` |
| `--verbose` | Enable detailed logging | `./claude-bedrock --verbose` |
| `--log-file <path>` | Save logs to a file | `./claude-bedrock --log-file debug.log` |

---

## Common Tasks

### Re-authenticate (Credentials Expired)

```bash
./claude-bedrock --clear-cache
./claude-bedrock
```

Then sign in again when the browser opens.

### Check If Your Setup Is Working

```bash
./claude-bedrock --status
```

This will test:
- ✅ Connection to your login provider
- ✅ AWS permissions
- ✅ Access to Bedrock models
- ✅ Any configured monitoring systems

### View Your Token Usage / Quota

```bash
./claude-bedrock --quota
```

Shows how many tokens you've used this month and your limit.

### Run Setup Again (Reconfigure)

```bash
./claude-bedrock --setup
```

This recreates your configuration files without launching Claude Code.

### Use a Different Environment

If your IT team gave you multiple config files (`env.bedrock`, `env.staging`, etc.):

```bash
./claude-bedrock -e env.staging
```

---

## Troubleshooting

### Claude Code Won't Launch

**Try this:**
```bash
./claude-bedrock --status
```

This will show what's not working.

**If credentials are expired:**
```bash
./claude-bedrock --clear-cache
./claude-bedrock
```

Then sign in again.

### "Connection Failed" or "Unauthorized"

**Your credentials may have expired. Clear them and try again:**
```bash
./claude-bedrock --clear-cache
./claude-bedrock
```

### Stuck in Login Loop

**Clear everything and start over:**
```bash
./claude-bedrock --clear-cache
./claude-bedrock --setup
./claude-bedrock
```

### Getting Error Messages

**Enable verbose logging to see what's happening:**
```bash
./claude-bedrock --verbose --log-file debug.log
cat debug.log        # macOS/Linux
type debug.log       # Windows
```

Then share the log with your IT support team.

### Claude Code Isn't in PATH (macOS/Linux)

Make sure Claude Code CLI is installed:

```bash
# macOS
brew install claude-code

# Linux (Ubuntu/Debian)
sudo apt-get install claude-code
# Or download from: https://docs.anthropic.com/en/docs/claude-code/getting-started
```

Then try again:
```bash
./claude-bedrock
```

---

## Configuration Files

Your settings are stored automatically in these locations:

| File | Purpose | Location |
|------|---------|----------|
| AWS Config | AWS credential refresh | `~/.aws/config` |
| Claude Settings | Claude Code environment | `~/.claude/settings.json` |
| Cached Credentials | Login tokens | `~/.aws/credentials` |

**You don't need to edit these** — the application manages them automatically.

---

## Security & Privacy

- ✅ Your login credentials are **never stored** — only temporary AWS tokens
- ✅ Credentials are **encrypted** (Windows Credential Manager, macOS Keychain, Linux credential storage)
- ✅ Credentials **automatically expire** and refresh
- ✅ All communication is **HTTPS encrypted**

---

## Getting Help

If something isn't working:

1. **Run diagnostics:**
   ```bash
   ./claude-bedrock --status
   ```

2. **Collect verbose logs:**
   ```bash
   ./claude-bedrock --verbose --log-file debug.log
   ```

3. **Share with your IT support team:**
   - The output from `--status`
   - The `debug.log` file
   - What you were trying to do
   - What error you saw

---

## Keyboard Shortcuts (While Using Claude Code)

These are specific to Claude Code, not the launcher:

- **⌘/Ctrl + K** — Open Claude Code chat
- **⌘/Ctrl + Shift + L** — View conversation history
- **Escape** — Close panels

See Claude Code documentation for more: https://docs.anthropic.com/en/docs/claude-code

---

## Questions?

For issues or questions, contact your IT support team or refer to the full technical documentation in `README.md`.
