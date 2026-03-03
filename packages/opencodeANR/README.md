# OpenCode ANR

Alaska Northstar Resources custom distribution of OpenCode - a **standalone, fully distributable CLI** with enterprise integrations.

## Status: Phase 1 Complete ✅

OpenCode ANR is now a **working CLI** that runs all base OpenCode functionality. Enterprise integrations are scaffolded and ready for Phase 2 implementation.

## What It Is

**OpenCode ANR is OpenCode itself**, not a wrapper. It's a complete distribution with ANR-specific features:

### Currently Active
- ✅ **All OpenCode CLI commands** - Full TUI, web, serve, models, etc.
- ✅ **Automatic AWS SSO authentication** - Browser login for credentials
- ✅ **Dedicated ANR launcher** - Environment setup for future integrations
- ✅ **Integration scaffolding** - Ready for Phase 2 feature activation

### Phase 2 - Enterprise Features (Code Ready, Not Yet Integrated)
- 🔧 **AWS Profile Authentication** - Auto-login via AWS SSO profiles
- 🔧 **OpenTelemetry Integration** - Metrics sent to internal OTEL collector
- 🔧 **DynamoDB Audit Logging** - All activity logged for compliance
- 🔧 **Quota & Policy Enforcement** - Centralized usage controls
- 🔧 **Environment-Driven Configuration** - Single env file drives all settings

## Architecture

```
┌─────────────────────────────────────┐
│     OpenCode ANR CLI Binary         │
│  (Standalone Executable)            │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Base OpenCode Features     │  │
│  │   - AI Chat                  │  │
│  │   - Code Generation          │  │
│  │   - Tool Execution           │  │
│  │   - MCP Integration          │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   ANR Enterprise Features    │  │
│  │   - AWS SSO Auth             │  │
│  │   - OTEL Telemetry           │  │
│  │   - Audit Logging            │  │
│  │   - Quota Enforcement        │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
            ↓
      Configured via
    .env.bedrock file
```

**Key Difference from Go App:**
- Go App: Wrapper that **launches** Claude Code
- OpenCode ANR: **IS** OpenCode with ANR features built-in

## Quick Start

```bash
# From repo root - launches OpenCode with authentication
bun dev:anr

# Run specific commands
bun dev:anr models
bun dev:anr run "analyze this project"

# Force SSO refresh if credentials expired  
bun dev:anr --force-sso
```

That's it! The CLI is fully functional. All OpenCode commands work with automatic AWS authentication.

## Authentication

When you run `bun dev:anr`:

1. **Loads configuration** - Reads your `.env.bedrock` file
2. **Validates credentials** - Checks AWS SSO profile status
3. **Opens browser if needed** - Automatically authenticates if expired
4. **Launches OpenCode** - Your CLI starts with valid AWS credentials

### Troubleshooting

If you get "AWS SSO expired" error:

```bash
# Force credentials refresh
bun dev:anr --force-sso

# Or manually refresh
aws sso login --profile anr-bedrock-internal-us-east-1
```

A browser window should open. Complete authentication and return to the terminal.

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_PROFILE` | AWS profile for authentication | `anr-bedrock-internal-us-east-1` |
| `AWS_REGION` | Primary AWS region | `us-east-2` |
| `ANTHROPIC_MODEL` | Bedrock model ID | `us.anthropic.claude-sonnet-4-5...` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTEL collector URL | `http://otel-collector-alb-...` |
| `QUOTA_API_ENDPOINT` | Quota enforcement API | `https://...execute-api...` |
| `QUOTA_FAIL_MODE` | Behavior on API failure | `closed` or `open` |
| `AUDIT_TABLE_NAME` | DynamoDB table for audits | `AuditEvents` |
| `IDENTITY_POOL_ID` | Cognito identity pool | `us-east-2:122b8cce-...` |

See [.env.example](.env.example) for complete configuration.

## Development

```bash
# Type checking
bun run typecheck

# Run tests
bun test

# Build
bun run build
```

## Support

For issues with:
- **Base OpenCode functionality** → See [opencode package](../opencode)
- **ANR integrations** → Contact ANR DevOps team

## License

Proprietary - Alaska Northstar Resources Internal Use Only
