# Claude Bedrock Client — Distribution Guide

**Version:** 1.0+  
**Last Updated:** February 2026  

This guide is for IT/desktop teams distributing the Claude Bedrock Client across your organization.

---

## Overview

Claude Bedrock Client is a single, self-contained executable that:
- ✅ Authenticates users via browser-based OIDC (Cognito, Okta, Auth0, Azure AD)
- ✅ Federates OIDC tokens into temporary AWS credentials
- ✅ Automatically configures Claude Code for AWS Bedrock
- ✅ Provides transparent credential refresh via AWS credential_process
- ✅ Enforces token quotas and usage policies
- ✅ Sends telemetry/monitoring data via OTEL

**No runtime dependencies** — the binary is self-contained and statically linked.

---

## Installation

### System Requirements

| Requirement | Details |
|---|---|
| **OS Support** | Windows 10+, macOS 11+, Linux (RHEL 8+, Ubuntu 20.04+, Debian 11+) |
| **Architecture** | x86-64 (amd64) or ARM64 (Mac M1/M2/M3) |
| **Disk Space** | ~25 MB for binary |
| **Network** | HTTPS access to OIDC provider and AWS Bedrock endpoints |
| **Claude Code CLI** | Must be installed separately ([link](https://docs.anthropic.com/en/docs/claude-code/getting-started)) |

### Bundled Installers (Optional)

The binary can work in two modes:

**Mode 1: With bundled installers (offline/air-gapped)**
- Place installer files in an `installers/` folder alongside the binary
- On first run, the binary uses these local installers
- No internet required for dependency installation
- Ideal for secure/air-gapped environments

**Mode 2: Without bundled installers (default)**
- Binary automatically downloads and installs dependencies from the internet
- Claude Code and Git are downloaded on first run if missing
- Requires network access to download sources
- Simplest deployment (just copy the binary)

**Bundled Installer Files (optional):**
```
installers/
├── claude-code-installer.exe      # Windows only
└── git-for-windows-installer.exe  # Windows only
```

If these files are present, they will be used. If not present, the binary will attempt to download them.

**Note:** On macOS/Linux, bundled installers are not supported. Users must install Claude Code and Git manually or via package managers:
```bash
# macOS
brew install claude-code git

# Linux (Ubuntu/Debian)
sudo apt-get install git
# Claude Code installation: https://docs.anthropic.com/en/docs/claude-code/getting-started
```

### Distribution Package Contents

**Minimum (online deployment):**
```
claude-bedrock-distribution/
├── claude-bedrock.exe              # Windows executable
├── claude-bedrock                  # Linux/macOS executable
├── env.bedrock                     # Configuration template
├── DISTRIBUTION.md                 # This file
└── README.md                        # Technical documentation
```

**Optional (offline/air-gapped deployment):**
```
claude-bedrock-distribution/
├── claude-bedrock.exe              # Windows executable
├── env.bedrock                     # Configuration template
├── DISTRIBUTION.md
├── README.md
└── installers/                      # Optional — for offline installs
    ├── claude-code-installer.exe    # Downloaded from Anthropic
    └── git-for-windows-installer.exe # Downloaded from Git for Windows
```

If the `installers/` folder is present, the binary will use it. If not, it will automatically download installers from the internet.

### Deploy via Package Manager

**Windows (via MSI or NSIS installer):**
```bash
# Group Policy / SCCM deployment
msiexec /i claude-bedrock-1.0.0.msi /quiet /norestart
```

**macOS (via DMG or Homebrew):**
```bash
# Homebrew
brew install GovClaudeClient

# Manual DMG installation
open claude-bedrock-1.0.0.dmg
```

**Linux (via .deb or .rpm):**
```bash
# Ubuntu/Debian
sudo apt-get install ./claude-bedrock_1.0.0_amd64.deb

# RHEL/CentOS
sudo rpm -i claude-bedrock-1.0.0.x86_64.rpm
```

### Manual Installation

1. Extract or copy the binary to a directory in PATH:
   ```bash
   # Windows
   Copy-Item claude-bedrock.exe C:\Program Files\claude-bedrock\

   # macOS/Linux
   sudo install -m 0755 claude-bedrock /usr/local/bin/
   ```

2. Place the env file alongside the binary or in a known configuration directory:
   ```bash
   # Windows
   Copy-Item env.bedrock C:\Program Files\claude-bedrock\env.bedrock

   # macOS/Linux
   sudo install -m 0644 env.bedrock /etc/claude-bedrock/env.bedrock
   ```

3. Verify installation:
   ```bash
   claude-bedrock --version
   ```

---

## Configuration

### Environment File (`env.bedrock`)

The binary is configured entirely via a `KEY=VALUE` file. Your IT team should:

1. **Customize the template** with your organization's OIDC/AWS settings:
   ```bash
   # Example for enterprise Okta + AWS
   PROVIDER_DOMAIN=company.okta.com
   CLIENT_ID=0oa12abc34DEF56ghi        # Public OAuth client ID
   IDENTITY_POOL_ID=us-east-1:12345678-abcd-1234-abcd-123456789012
   FEDERATION_TYPE=cognito             # or 'direct' for STS AssumeRoleWithWebIdentity
   ```

2. **Place the file** where the binary can find it:
   - **Same directory** as the binary (recommended)
   - **User home directory** under `.claude-bedrock/`
   - **System config** at `/etc/claude-bedrock/env.bedrock` (Linux/macOS)

3. **Maintain multiple configurations** for different environments:
   ```
   env.bedrock          # Production
   env.staging          # Staging/Testing
   env.govcloud         # GovCloud
   ```

### Select Configuration

Users can specify which env file to use:

**Command line:**
```bash
claude-bedrock -e env.staging
```

**Environment variable:**
```bash
export CCWB_ENV_FILE=env.staging
claude-bedrock
```

**Auto-detection (default):**
- Searches for first `env.*` file next to binary
- Falls back to `~/.claude-bedrock/`
- Falls back to `~/.config/claude-bedrock/` (Linux)

---

## CLI Reference

### Main Modes

Users invoke the binary with these primary commands:

| Command | Purpose | Output |
|---------|---------|--------|
| *(none)* | Default: authenticate and launch Claude Code | None (launches GUI) |
| `--setup` | Configure without launching | Status messages |
| `--status` | Run connectivity diagnostics | Diagnostic report |
| `--quota` | Display token quota usage | JSON quota data |
| `--version` | Show installed versions | Version info |

### Administrative Commands

| Command | Purpose | Output |
|---------|---------|--------|
| `--install-hooks` | Add quota enforcement hooks to Claude settings | Status |
| `--clear-cache` | Clear cached credentials | Clear confirmation |
| `--check-expiration` | Test if credentials are still valid | Exit code: 0=valid, 1=expired |

### Hidden/Advanced Commands

These are invoked automatically by Claude Code or by IT automation:

| Command | Purpose |
|---------|---------|
| `--credential-process` | AWS credential refresh (called by AWS SDK) |
| `--get-otel-headers` | Telemetry header injection (called by Claude Code) |
| `--quota-hook` | Quota enforcement (called as Claude Code hook) |
| `--otel-stats-hook` | Usage telemetry (called as Claude Code hook) |

### Common Flags

```bash
# Use a specific configuration
claude-bedrock -e env.govcloud

# Use a specific AWS profile
claude-bedrock -p staging

# Enable verbose logging
claude-bedrock --verbose

# Log to file
claude-bedrock --log-file /var/log/claude-bedrock.log

# Location of Claude CLI (if not in PATH)
claude-bedrock --claude-path /usr/local/bin/claude
```

---

## Platform-Specific Deployment

### Windows

**Installation:**
- Copy `claude-bedrock.exe` to `C:\Program Files\claude-bedrock\`
- Place `env.bedrock` in same directory
- (Optional) Create Start Menu shortcut pointing to binary

**First-Run:**
- **Bundled installers** for Claude Code and Git are downloaded and installed automatically if missing
- Administrative prompt may appear for Git/Claude installation
- No user intervention required (can be pre-installed via SCCM/Intune)

**Credentials:**
- Stored in Windows Credential Manager (`~\.aws\` directory)
- Secured with 0600 permissions
- Automatically refreshed when expired

**Logging:**
- Logs to `C:\Users\<user>\AppData\Roaming\claude-code\launcher.log`
- Can be redirected with `--log-file` flag

**Group Policy / SCCM (Online):**
```powershell
# Deploy the binary + env file
# On first run, user's machine downloads Claude Code and Git automatically
msiexec /i claude-bedrock-1.0.0.msi /quiet /norestart
```

**Group Policy / SCCM (Offline/Air-Gapped):**
```powershell
# Deploy binary + env file + bundled installers/ folder
# On first run, uses pre-downloaded installers from installers/ folder
# No internet required
msiexec /i claude-bedrock-1.0.0-offline.msi /quiet /norestart
```

**Note:** Prepare offline package by including:
1. The binary
2. `env.bedrock` 
3. `installers/` folder with pre-downloaded `.exe` files

### macOS

**Installation:**
```bash
# Via Homebrew (recommended by IT)
brew install claude-bedrock

# Manual installation
sudo install -m 0755 claude-bedrock /usr/local/bin/
sudo install -m 0644 env.bedrock /etc/claude-bedrock/
```

**First-Run:**
- Claude Code must be installed manually or via Homebrew
- Git is pre-installed on most modern Macs
- No bundled installers (use system package managers)

**Credentials:**
- Stored in macOS Keychain
- Accessible only to the user
- Automatically refreshed

**Logging:**
- `~/Library/Logs/claude-code/launcher.log`

**Distribution:**
- DMG package for direct installation
- Homebrew tap for IT automation
- Notarization recommended (Apple code signing)

**Managed Distribution:**
```bash
# Via Jamf Pro MDM
# Deploy as policy with:
# - Installer: claude-bedrock-1.0.0.dmg
# - Post-install script: copy env.bedrock to /etc/claude-bedrock/

# Via Munki (macOS software management)
munkitools_admin -a --installer Homebrew
# Then manage installation via standard Munki workflow
```

### Linux

**Installation:**
```bash
# Ubuntu/Debian
sudo apt-get install ./claude-bedrock_1.0.0_amd64.deb

# RHEL/CentOS
sudo rpm -i claude-bedrock-1.0.0.x86_64.rpm

# Or manual
sudo install -m 0755 claude-bedrock /usr/local/bin/
sudo install -m 0644 env.bedrock /etc/claude-bedrock/env.bedrock
```

**First-Run:**
- Claude Code: Install via package manager or from https://download.anthropic.com
- Git: `sudo apt-get install git` (Ubuntu/Debian) or `sudo yum install git` (RHEL)
- No bundled installers

**Credentials:**
- Stored in `~/.aws/credentials` (with 0600 permissions)
- Can use system keyring if configured
- Automatically refreshed

**Logging:**
- `~/.local/share/claude-code/launcher.log` (XDG Base Directory)
- Or `/var/log/claude-bedrock.log` if run as system user

**Distribution:**
```bash
# Via Ansible (enterprise Linux)
- name: Deploy Claude Bedrock
  apt:
    deb: /tmp/claude-bedrock_1.0.0_amd64.deb
  
- name: Configure env file
  copy:
    src: env.bedrock
    dest: /etc/claude-bedrock/env.bedrock
    mode: 0644

# Via Saltstack
srv/saltstack/pillar/claude-bedrock/init.sls:
# Install and configure

# Via SystemD timer (optional, for automatic cache refresh)
/etc/systemd/system/claude-bedrock-refresh.timer
# Runs credential refresh periodically
```

---

## Troubleshooting

### User Can't Launch Claude Code

**Check 1: Claude CLI not found**
```bash
claude-bedrock --version
# Should show Claude Code version
```
If not, ensure Claude is installed and in PATH.

**Check 2: AWS credentials invalid**
```bash
claude-bedrock --check-expiration
# Exit 0 = valid, Exit 1 = expired/missing
```

**Check 3: Enable verbose logging**
```bash
claude-bedrock --verbose --log-file debug.log
# Review debug.log for errors
```

### Quota Enforcement Not Working

```bash
# Verify quota endpoint is configured
cat ~/.claude/settings.json | grep quota

# Test quota hook manually
claude-bedrock --quota
# Should return usage statistics
```

### Credential Refresh Failures

**Clear cache and re-authenticate:**
```bash
claude-bedrock --clear-cache
claude-bedrock --setup
```

**Check AWS permissions on Cognito Identity Pool role:**
```bash
# The role must have:
# - bedrock:InvokeModel
# - dynamodb:PutItem (for audit logging)
# - dynamodb:GetItem, Query (for quota checks)
```

### OTEL Telemetry Not Sending

**Verify endpoint is reachable:**
```bash
curl -v http://<otel-endpoint>
```

**Check configuration:**
```bash
grep OTEL_EXPORTER ~/.claude/settings.json
```

### On Windows: "Can't auto-install Claude/Git"

- Ensure binary has write permissions to installation directories
- May require admin elevation for first-run setup
- Pre-install as part of deployment image

---

## Monitoring & Support

### Collect Diagnostic Information

IT can gather diagnostics for troubleshooting:

```bash
# Status diagnostics
claude-bedrock --status > diagnostics.txt

# Verbose logs
claude-bedrock --verbose --log-file /tmp/claude.log 2>&1 | tee diagnostics-verbose.txt

# Version information
claude-bedrock --version >> diagnostics.txt

# AWS/credential status
cat ~/.aws/config | grep -A 5 "claude-bedrock" >> diagnostics.txt
```

### Monitoring & Metrics

If OTEL is configured:
- **User attribution** — OTEL sends user email/org/department with each prompt
- **Token usage** — DynamoDB tracks quota consumption per user/month
- **Audit logs** — Authentication and quota decision events logged to DynamoDB

---

## Updates & Versioning

### Release Schedule

- **Major versions** (1.0, 2.0): New features/breaking changes
- **Minor versions** (1.1, 1.2): Feature additions, backward compatible
- **Patch versions** (1.0.1, 1.0.2): Bug fixes, security patches

### Update Procedure

**Manual update:**
```bash
# 1. Download new binary
# 2. Backup old binary
cp /usr/local/bin/claude-bedrock /usr/local/bin/claude-bedrock.old

# 3. Replace with new version
sudo install -m 0755 claude-bedrock /usr/local/bin/

# 4. Verify
claude-bedrock --version
```

**Automated via package manager:**
```bash
# Windows SCCM/Intune: Update policy
# macOS Jamf/Munki: Deploy new version
# Linux apt/yum: sudo apt-get upgrade claude-bedrock
```

### Breaking Changes

Check release notes for any env file changes or configuration updates.

---

## Security & Compliance

### Credential Storage

- **Windows:** Windows Credential Manager (encrypted at rest)
- **macOS:** Keychain (system encrypted)
- **Linux:** `~/.aws/credentials` with 0600 permissions

### Audit & Logging

When configured (optional):
- ✅ Audit logs sent to DynamoDB `AuditEvents` table
- ✅ User authentication (success/failure) logged
- ✅ Quota decisions logged
- ✅ OTEL metrics sent for usage analysis

### SSL/TLS

- Enforced for OIDC provider communication
- Enforced for AWS Bedrock API calls
- Certificate validation enabled by default

### Network Requirements

Firewall rules needed:
- **HTTPS (443)** to OIDC provider domain
- **HTTPS (443)** to AWS Bedrock endpoints (`*.bedrock.amazonaws.com`)
- **HTTPS (443)** to OTEL collector (if configured)
- **HTTPS (443)** to quota API endpoint (if configured)
- **HTTP (80)** to localhost:8400 for OIDC callback (browser only)

---

## Support & Feedback

- **Documentation:** See [README.md](README.md) for technical details
- **Issues:** [GitHub Issues](https://github.com/clouds-anr/GovClaudeClient/issues)
- **Architecture:** See [README.md — Architecture](README.md#architecture) section

---

**For questions or feedback, contact the development team.**
