# ANR OpenCode - Quick Start Guide

## 🎉 Setup Complete!

Your opencodeANR package has been successfully created with all enterprise integrations.

## 📁 Package Structure

```
packages/opencodeANR/
├── src/
│   ├── index.ts                          # Main entry point (extends base OpenCode)
│   ├── config/
│   │   ├── types.ts                      # TypeScript types for configuration
│   │   └── env-loader.ts                 # Environment config loader
│   ├── integrations/
│   │   ├── cognito-sso.ts               # AWS Cognito authentication
│   │   └── otel.ts                       # OpenTelemetry integration
│   └── middleware/
│       ├── audit-logger.ts               # DynamoDB audit logging
│       ├── quota-policy.ts               # Quota API enforcement
│       └── dependency-detector.ts        # Auto dependency detection
├── bin/
│   └── opencode-anr                      # CLI wrapper executable
├── test/
│   └── index.test.ts                     # Example tests
├── .env.example                          # Template configuration
├── package.json                          # Package manifest
├── README.md                             # Full documentation
└── AGENTS.md                             # Developer guidelines

```

## 🚀 Next Steps

### 1. Configure Your Environment

```bash
cd packages/opencodeANR
cp .env.example .env
# Edit .env with your actual values
```

### 2. Test the Configuration

```bash
# Run tests
bun test

# Typecheck
bun run typecheck
```

### 3. Use in Your Application

**Option A: CLI Usage**
```bash
# From anywhere after building
opencode-anr

# With custom config
opencode-anr --env=/path/to/.env
```

**Option B: Programmatic Usage**
```typescript
import { initializeANR, getMissingDependencies } from "@opencode-ai/opencode-anr"

// Initialize with all integrations
const session = await initializeANR()

// Check quota before operations
await session.checkQuota(session.userId, "model.call", "tokens", 1000)

// Detect missing dependencies
const code = `import { foo } from "my-package"`
const missing = await getMissingDependencies(code, "typescript")
console.log(missing) // Shows uninstalled packages
```

## 🔄 Keeping Base OpenCode Updated

Since opencodeANR is a lightweight wrapper, updates are easy:

```bash
# Update base opencode
cd packages/opencode
git pull upstream dev
bun install

# Your opencodeANR automatically benefits
# No conflicts in your custom code!
```

## 🏗️ Architecture Highlights

**Composition Over Inheritance:**
- opencodeANR imports opencode as a peer dependency
- All base functionality is re-exported
- Only ANR-specific features are added
- Zero code duplication

**Integration Flow:**
```
User → opencodeANR CLI
  ↓
  1. Load .env config
  2. Authenticate with Cognito → get AWS credentials
  3. Initialize OpenTelemetry → start metrics
  4. Initialize DynamoDB audit logger
  5. Create quota middleware
  6. Launch base OpenCode with ANR context
```

## 🔌 Integration Details

### AWS Cognito SSO
- **File:** `src/integrations/cognito-sso.ts`
- Auto-refreshes credentials before expiry
- Sets AWS env vars for Bedrock access

### OpenTelemetry
- **File:** `src/integrations/otel.ts`
- Exports metrics every 60 seconds
- Graceful shutdown on SIGTERM/SIGINT

### Quota API
- **File:** `src/middleware/quota-policy.ts`
- Checks quota before expensive operations
- Configurable fail mode (open/closed)
- Best-effort usage tracking

### DynamoDB Audit Logger
- **File:** `src/middleware/audit-logger.ts`
- Logs all significant events
- 1-year TTL on records
- Non-blocking (failures don't stop ops)

### Dependency Detection
- **File:** `src/middleware/dependency-detector.ts`
- Parses code for imports/requires
- Checks if packages are installed
- Generates install commands

## 📦 Distribution Options

### CLI Distribution
Bundle the .env file with the binary:
```bash
bun build src/index.ts --compile --outfile opencode-anr
# Include .env in distribution package
```

### Desktop Distribution
In your Tauri app:
```typescript
// src-tauri/src/main.rs - bundle .env as resource
// src/App.tsx
import { initializeANR } from "@opencode-ai/opencode-anr"
await initializeANR("./resources/.env")
```

### Web Distribution
Inject env at build time:
```bash
# During build, create env.js from .env
echo "export const config = { ... }" > src/env.js
```

## 🧪 Testing

```bash
# Run all tests
bun test

# With your actual .env
bun test --env-file=.env

# Watch mode
bun test --watch
```

## 📝 Adding New Features

1. **Create the integration file:**
   ```bash
   touch src/integrations/my-feature.ts
   ```

2. **Export from index.ts:**
   ```typescript
   export * from "./integrations/my-feature"
   ```

3. **Add configuration to types.ts:**
   ```typescript
   export interface ANRConfig {
     // ... existing config
     myFeatureEndpoint: string
   }
   ```

4. **Update .env.example:**
   ```bash
   MY_FEATURE_ENDPOINT=https://...
   ```

5. **Document in README.md**

## 🛠️ Troubleshooting

**Quota API unavailable?**
- Check `QUOTA_FAIL_MODE` setting
- "closed" = deny on error
- "open" = allow on error

**Credentials expired?**
- Credentials auto-refresh before expiry
- Check Cognito Identity Pool permissions
- Verify `IDENTITY_POOL_ID` is correct

**OTEL not sending metrics?**
- Verify `OTEL_EXPORTER_OTLP_ENDPOINT` is reachable
- Check network/firewall rules
- Telemetry failures don't block operations

## 📚 Additional Resources

- [Base OpenCode Documentation](../opencode/README.md)
- [Full ANR OpenCode README](./README.md)
- [Developer Guidelines](./AGENTS.md)
- [AWS Cognito Identity Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html)
- [OpenTelemetry](https://opentelemetry.io/docs/)

## ✅ Checklist

- [ ] Copied `.env.example` to `.env`
- [ ] Updated `.env` with your values
- [ ] Ran `bun install` successfully
- [ ] Ran `bun test` to verify setup
- [ ] Read the full README.md
- [ ] Understand the architecture (composition pattern)
- [ ] Know how to merge upstream opencode updates

---

**Questions?** Contact ANR DevOps team or check the README.md for detailed documentation.
