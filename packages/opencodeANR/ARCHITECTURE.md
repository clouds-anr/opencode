# OpenCode ANR - Architecture & Implementation Plan

## Current Status ✅

You now have a working foundation with:

1. **Environment Configuration** - Loads `.env.bedrock` (or any `.env.*` file)
2. **AWS SSO Authentication** - Uses AWS profiles (matches Go app pattern)
3. **OpenTelemetry Integration** - Configured (needs SDK fix)
4. **Quota API Client** - Ready (needs correct endpoint paths)
5. **DynamoDB Audit Logger** - Configured (needs proper credentials)
6. **Dependency Detection** - Automatic import analysis

## Architecture: Standalone vs Wrapper

### ❌ Go App Pattern (What We DON'T Want)
```
claude-bedrock.exe
  └─> Launches Claude Code as subprocess
  └─> Passes environment variables
  └─> Acts as credential process
  └─> Proxy/wrapper pattern
```

### ✅ OpenCode ANR Pattern (What We DO Want)
```
opencode-anr.exe
  └─> IS OpenCode (not a wrapper)
  └─> ANR features baked into the codebase
  └─> Standalone, distributable binary
  └─> Env file drives configuration
```

## Key Differences from Go App

| Aspect | Go App (claude-bedrock) | OpenCode ANR |
|--------|-------------------------|--------------|
| What it does | **Launches** Claude Code | **IS** OpenCode |
| Process model | Wrapper/launcher | Standalone application |
| Integration | External (env vars) | Internal (direct code) |
| Distribution | Binary + Claude Code separate | Single integrated binary |
| Config | Writes ~/.claude/settings.json | Uses .env directly |

## Next Steps to Complete

### 1. Fix Integration Issues

**OpenTelemetry** (Currently failing - SDK version mismatch)
```typescript
// Need to use compatible SDK versions or simplify to just HTTP metrics export
// The Go app sends OTEL headers, we should do the same
```

**DynamoDB Audit** (Credential issue)
```typescript
// Currently getting "security token invalid"
// Need to verify the AWS profile credentials work with DynamoDB
// May need to assume a role or use different credential chain
```

**Quota API** (404 on /check endpoint)
```typescript
// Need to examine Go app's quota implementation to get correct endpoint
// Check internal/audit/ or related files for the actual API structure
```

### 2. Make It a True CLI

Instead of this:
```typescript
// src/index.ts - currently just initializes and shows "ready"
export async function startANRCLI() {
  const session = await initializeANR()
  console.log("Ready!")  // Then exits
}
```

Do this:
```typescript
// src/index.ts - actually BE the CLI
export async function startANRCLI() {
  const session = await initializeANR()
  
  // Import opencode's main CLI and run it
  const opencode = await import("opencode/src/index")
  await opencode.main()  // This makes it actually function as OpenCode
}
```

### 3. Build as Standalone Binary

```bash
# Currently runs via bun
bun dev:anr

# Goal: Standalone executable
./opencode-anr.exe

# Build command (when ready):
bun build src/index.ts --compile --outfile=opencode-anr.exe
```

### 4. Distribution Package

Like the Go app, create a distribution folder:
```
opencode-anr-distribution/
├── opencode-anr.exe        # Standalone binary
├── .env.bedrock            # Config template
├── README.md               # User guide
└── DISTRIBUTION.md         # IT deployment guide
```

## What's Working Now

✅ Config loading from `.env.bedrock`
✅ AWS SSO authentication  (with manual `aws sso login` first)
✅ Integration framework in place
✅ Tests passing
✅ Auto-detection of `.env.*` files

## What Needs Investigation

From the Go app, we should examine:

1. **`internal/audit/`** - How they call DynamoDB and the quota API
2. **`internal/otelhelper/`** - How they structure OTEL headers/metrics
3. **`cmd/main.go:getOtelHeaders`** - The fast-path OTEL implementation
4. **Credential chain** - How they ensure DynamoDB access works

Let me know if you want me to:
- Examine specific Go files to fix the integrations
- Make opencodeANR actually launch as a functional CLI
- Fix the OpenTelemetry/DynamoDB/Quota issues
- Create the distribution build process

The foundation is solid - we just need to wire up the final pieces!
