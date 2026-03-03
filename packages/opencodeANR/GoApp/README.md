# Claude Bedrock

A single, portable Go binary that authenticates users via OIDC, federates into AWS, and launches [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with [Amazon Bedrock](https://aws.amazon.com/bedrock/) as the model backend.

A statically-linked executable that handles authentication, credential management, telemetry, quota enforcement, and process supervision — no runtime dependencies beyond the Claude Code CLI.

---

## What It Does

1. **Authenticates** the user via browser-based OIDC (Cognito, Okta, Auth0, or Azure AD) with PKCE  
2. **Federates** the OIDC token into temporary AWS credentials (Cognito Identity Pool or STS AssumeRoleWithWebIdentity)  
3. **Configures** `~/.aws/config` and `~/.claude/settings.json` automatically  
4. **Launches** Claude Code in a PTY with the correct Bedrock environment variables  
5. **Serves** as an AWS `credential_process` so credentials refresh transparently  
6. **Provides** OTEL telemetry headers for monitoring/attribution  
7. **Enforces** token quotas via DynamoDB or an API endpoint  

---

## Prerequisites

- **Go 1.24+** (build only)
- **Claude Code CLI** installed and on PATH ([Download the native installer](https://docs.anthropic.com/en/docs/claude-code/getting-started))
- An **env file** (`env.bedrock`, `env.govcloud`, etc.) with your endpoint configuration
- AWS infrastructure deployed (Cognito User Pool, Identity Pool, IAM roles)

---

## Quick Start


```powershell
# Windows PowerShell: Build and copy to sandbox folder
go build -o $env:USERPROFILE\desktop\sandbox\claude-bedrock.exe ./cmd/main.go
Copy-Item -Path env.bedrock -Destination $env:USERPROFILE\desktop\sandbox\env.bedrock -Force

# Or, for a local build in the project root:
go build -o claude-bedrock.exe ./cmd/main.go
Copy-Item -Path env.bedrock -Destination .\env.bedrock -Force

# Run setup (writes ~/.aws/config + ~/.claude/settings.json)
./claude-bedrock.exe --setup

# Launch Claude Code
./claude-bedrock.exe
```

---

## Environment File

The binary is configured entirely by a `KEY=VALUE` env file. You can maintain multiple files for different endpoints:

```
env.bedrock          # Commercial Bedrock
env.govcloud         # GovCloud Bedrock
env.staging          # Staging environment
```

Select which file to use:

```bash
./claude-bedrock -e env.govcloud
# or
export CCWB_ENV_FILE=env.govcloud
./claude-bedrock
```

If no file is specified, the binary auto-discovers the first `env.*` file next to itself, in the current directory, or in `~/claude-code-with-bedrock/`.

### Required Keys

| Key | Description |
|-----|------------|
| `AWS_PROFILE` | AWS CLI profile name to create/use |
| `AWS_REGION` | Bedrock runtime region (e.g. `us-east-1`) |
| `PROVIDER_DOMAIN` | OIDC provider domain (e.g. `xxx.auth.us-east-2.amazoncognito.com`) |
| `CLIENT_ID` | OIDC client ID (public, no secret) |
| `IDENTITY_POOL_ID` | Cognito Identity Pool ID (for Cognito federation) |
| `FEDERATION_TYPE` | `cognito` or `direct` (STS AssumeRoleWithWebIdentity) |
| `ANTHROPIC_MODEL` | Model ID (e.g. `us.anthropic.claude-sonnet-4-5-20250929-v1:0`) |

### Optional Keys

| Key | Description | Default |
|-----|------------|---------|
| `PROVIDER_TYPE` | `cognito`, `okta`, `auth0`, `azure`, or `auto` | `auto` (detected from domain) |
| `AWS_REGION_PROFILE` | Region for the auth/identity pool (if different from Bedrock region) | Same as `AWS_REGION` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID (for login key construction) | — |
| `FEDERATED_ROLE_ARN` | IAM role ARN (required when `FEDERATION_TYPE=direct`) | — |
| `CREDENTIAL_STORAGE` | `session` | `session` |
| `CROSS_REGION_PROFILE` | Cross-region inference profile prefix | — |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector URL | — (telemetry disabled) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | OTLP protocol | `http/protobuf` |
| `QUOTA_API_ENDPOINT` | Quota checking API URL | — (no quota enforcement) |
| `QUOTA_FAIL_MODE` | `open` (allow on error) or `closed` (deny on error) | `open` |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Enable Claude Code telemetry | `1` |

See [env.bedrock](env.bedrock) for a complete example.

---

## CLI Reference

```
claude-bedrock [flags]
```

### Modes

| Flag | Description |
|------|-------------|
| *(default)* | Authenticate, configure, and launch Claude Code |
| `--setup` | Write `~/.aws/config` and `~/.claude/settings.json` without launching |
| `--credential-process` | AWS credential_process mode — outputs JSON credentials to stdout |
| `--get-otel-headers` | Output OTEL monitoring headers as JSON to stdout |
| `--status` | Run connectivity diagnostics (Cognito, OTEL, Bedrock endpoints) |
| `--quota` | Display token quota usage from DynamoDB |
| `--quota-hook` | Run as a Claude Code `UserPromptSubmit` hook (stdin/stdout JSON) |
| `--install-hooks` | Add quota hooks to `~/.claude/settings.json` |
| `--clear-cache` | Clear cached credentials and monitoring tokens |
| `--check-expiration` | Exit 0 if credentials valid, 1 if expired |
| `--version` | Print component versions (launcher, Claude Code, Node.js, AWS CLI) |

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--env-file <path>` | `-e` | Path to env file (default: auto-detect) |
| `--profile <name>` | `-p` | Override the profile name from the env file |
| `--claude-path <path>` | | Path to Claude CLI binary (default: `$PATH` lookup) |
| `--bedrock` | | Use AWS Bedrock (default: `true`) |

---

## Build

### Local


```bash
# IMPORTANT: Copy the entire path below (including ./cmd/main.go), not just 'main.go'.
# If you copy from the rendered markdown, make sure the path is not shortened to just 'main.go'.
go build -o claude-bedrock ./cmd/main.go
```


# Cross-Compile

```bash
GOOS=linux   GOARCH=amd64 go build -o claude-bedrock-linux       ./cmd/main.go
GOOS=darwin  GOARCH=arm64 go build -o claude-bedrock-mac          ./cmd/main.go
GOOS=windows GOARCH=amd64 go build -o claude-bedrock-windows.exe  ./cmd/main.go
```

### With Version

```bash
go build -ldflags "-s -w -X github.com/clouds-anr/GovClaudeClient/internal/version.Version=1.0.0" \
  -o claude-bedrock ./cmd/main.go
```


### GoReleaser Installation

GoReleaser must be installed to build release artifacts. Install it before running any `goreleaser` commands:

#### Windows
1. Download the latest `goreleaser_Windows_x86_64.exe` from [GoReleaser Releases](https://github.com/goreleaser/goreleaser/releases).
2. Rename it to `goreleaser.exe` and place it in a directory in your `PATH` (e.g., `C:\Go\bin` or `C:\Windows`).
3. Open a new terminal and run `goreleaser --version` to verify installation.

#### macOS (Homebrew)
```bash
brew install goreleaser
```

#### Linux
```bash
curl -sSfL https://install.goreleaser.com/github.com/goreleaser/goreleaser.sh | sh
```

---

### Release Build (GoReleaser)

```bash
git tag v1.0.0
goreleaser release --clean
```

This produces archives for all six platform/arch combinations (linux/darwin/windows × amd64/arm64) with checksums.

---

## GitHub Workflows

### Release (`release.yml`)

**Trigger**: Push a semver tag (`v*.*.*`)

**What it does**:
1. Checks out the repository
2. Sets up Go 1.22+
3. Installs and runs [GoReleaser](https://goreleaser.com)
4. Builds binaries for 6 platform/arch targets
5. Creates a GitHub Release with archives and checksums

**Secrets required**: `GITHUB_TOKEN` (provided automatically by GitHub Actions)

**Usage**:
```bash
git tag v1.2.3
git push origin v1.2.3
# → GitHub Actions builds and publishes the release
```

The release configuration is in [goreleaser.yaml](goreleaser.yaml). Binaries are stripped (`-s -w`) and version-stamped via ldflags.

---

## Architecture

### High-Level Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│              │     │                 │     │                  │
│   User       │────▶│  claude-bedrock │────▶│   Claude Code    │
│   (browser)  │◀────│  (launcher)     │◀────│   (Bedrock)      │
│              │     │                 │     │                  │
└──────────────┘     └────────┬────────┘     └──────────────────┘
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              ┌──────────┐ ┌──────┐ ┌────────┐
              │ Cognito/ │ │ STS/ │ │ DynamoDB│
              │ OIDC     │ │ IAM  │ │ Quota  │
              └──────────┘ └──────┘ └────────┘
```

### Package Structure

```
cmd/
  main.go              CLI entry point (Cobra), dispatches to modes

internal/
  config/
    config.go            Env file loader, provider detection, AppConfig struct
    env.go               Runtime environment variable capture
    settings.go          Writes ~/.claude/settings.json and ~/.aws/config

  auth/
    oidc.go              OIDC PKCE flow (browser → localhost:8400 callback → token exchange)
    jwt.go               JWT payload decoding, email/group extraction

  aws/
    credential_process.go  Main credential-process pipeline + federation (Cognito/STS)
    cache.go               Credential caching via ~/.aws/credentials (INI read/write)
    quota.go               Quota checks via API endpoint and DynamoDB
    setup.go               AWS SDK config loading

  health/
    status.go            Connectivity diagnostics (Cognito, OTEL, Bedrock, deps)

  otel/
    setup.go             OpenTelemetry tracer provider initialization

  otelhelper/
    headers.go           JWT → user info → OTEL HTTP headers (JSON to stdout)

  proxy/
    exec.go              PTY proxy — launches Claude Code with full terminal passthrough

  version/
    version.go           Build-time version injection via ldflags
```

### Authentication Flow

```
1. User runs: claude-bedrock
2. Launcher loads env file → determines OIDC provider
3. Generates PKCE parameters (code_verifier, code_challenge, state, nonce)
4. Opens browser to provider's /authorize endpoint
5. Starts HTTP server on localhost:8400
6. User authenticates in browser → provider redirects to localhost:8400/callback
7. Launcher exchanges authorization code for tokens at /token endpoint
8. Validates nonce from ID token claims
9. Returns OIDCTokens { IDToken, AccessToken, Claims }
```

### Credential Federation

Two modes, selected by `FEDERATION_TYPE` in the env file:

**Cognito Identity Pool** (`cognito`, default):
```
ID token → Cognito GetId (IdentityPoolId + Logins map)
         → Cognito GetCredentialsForIdentity
         → Temporary AWS credentials
```

**Direct STS** (`direct`):
```
ID token → STS AssumeRoleWithWebIdentity (RoleArn, 12-hour duration)
         → Temporary AWS credentials
```

Both paths use an unauthenticated AWS SDK client (empty static credentials) to avoid recursive `credential_process` calls.

### Credential Process Loop

Once set up, Claude Code never calls the launcher directly. Instead:

```
Claude Code → reads ~/.aws/config
            → sees: credential_process = claude-bedrock --credential-process --profile X
            → executes claude-bedrock
            → claude-bedrock checks ~/.aws/credentials cache
            → if valid: outputs cached credentials as JSON
            → if expired: re-authenticates (browser OIDC), federates, caches, outputs JSON
            → Claude Code uses credentials for Bedrock API calls
```

Credentials are cached in `~/.aws/credentials` as standard INI with an `x-expiration` field. A 30-second buffer prevents using nearly-expired credentials.

### Quota Enforcement

Two complementary mechanisms:

**API-based** (real-time, via `--quota-hook`):
- Claude Code calls the hook before each prompt
- Hook GETs the quota API with the user's JWT as a Bearer token
- Returns `{"result":"continue"}` or `{"result":"block","message":"..."}`
- Respects `QUOTA_FAIL_MODE` (open = allow on error, closed = deny on error)

**DynamoDB-based** (display, via `--quota`):
- Queries `QuotaPolicies` table for user-specific → fallback to default policy
- Queries `UserQuotaMetrics` for monthly/daily token counts
- Displays formatted quota status with usage percentages

### OTEL Telemetry

When `OTEL_EXPORTER_OTLP_ENDPOINT` is configured:
- `settings.json` includes `otelHeadersHelper` pointing to `claude-bedrock --get-otel-headers`
- Claude Code calls this before sending telemetry
- The helper decodes the user's JWT, extracts claims, and outputs HTTP headers:

```json
{
  "x-user-email": "user@example.com",
  "x-user-id": "a1b2c3...",
  "x-department": "engineering",
  "x-team-id": "platform",
  "x-organization": "ExampleCorp"
}
```

### Settings Merging

`WriteClaudeSettings()` never overwrites `~/.claude/settings.json` destructively. It:
1. Reads the existing file
2. Merges launcher env vars on top of existing `env` keys
3. Sets `awsAuthRefresh` and `otelHeadersHelper` commands
4. Adds `UserPromptSubmit` quota hooks (if quota endpoint configured)
5. Preserves all other user-added keys

---

## File Locations

| Path | Purpose | Permissions |
|------|---------|-------------|
| `~/.aws/config` | AWS profile with `credential_process` | 0600 |
| `~/.aws/credentials` | Cached temporary credentials | 0600 |
| `~/.claude/settings.json` | Claude Code env, auth refresh, hooks | 0644 |
| `~/.claude-code-session/` | Monitoring tokens, quota state | 0700 |

All file writes are atomic (write to temp file → `chmod` → `rename`).

---

## Security

- **PKCE (S256)** on all OIDC flows — no client secret required
- **State + nonce** validated on every callback to prevent CSRF and replay attacks
- Credentials and tokens written with **0600 permissions** via atomic temp-file-and-rename
- JWT tokens decoded without signature verification (HTTPS transport security is relied upon)
- AWS SDK clients for federation use **empty static credentials** to prevent recursive credential_process loops
- No hardcoded secrets — `CLIENT_ID` is a public OAuth identifier; infrastructure secrets live in AWS
