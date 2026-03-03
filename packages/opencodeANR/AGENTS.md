- PROPRIETARY: This package is for Alaska Northstar Resources internal use only
- Do not commit sensitive credentials or configuration to git
- Keep base opencode package unchanged to facilitate upstream merges
- All ANR-specific functionality lives in this package (opencodeANR)
- The architecture uses composition over inheritance to extend opencode
- Configuration is loaded from .env files matching the Go wrapper format
- Use the same style guide as the main opencode package (see ../../AGENTS.md)

## ANR Integration Points

### AWS Cognito SSO
- Auto-authenticates users via Cognito Identity Pool
- Credentials refresh automatically before expiry
- Session tokens stored per `CREDENTIAL_STORAGE` setting

### OpenTelemetry
- Metrics exported to internal OTEL collector every 60 seconds
- Service name: `opencode-anr`
- Tagged with deployment environment and region

### Quota API
- All significant actions checked against quota API before execution
- Fail mode (open/closed) configurable
- Usage tracking is fire-and-forget (doesn't block operations)

### DynamoDB Audit Logging
- All events logged to `AUDIT_TABLE_NAME`
- 1-year TTL on audit events
- Non-blocking: failures don't stop operations

### Dependency Detection
- Automatically analyzes code for missing dependencies
- Supports TypeScript, JavaScript, and Python
- Generates install commands for detected missing packages

## Development Workflow

When adding new ANR features:
1. Add new integration in `src/integrations/` or `src/middleware/`
2. Export from `src/index.ts`
3. Document configuration in `.env.example` and README
4. Test with your local .env file
5. Update README with usage examples

## Testing

Use your actual .env file for integration testing:
```bash
bun test --env-file=.env
```

## Distribution

This package can be distributed as:
- **CLI**: `opencode-anr` binary with embedded .env
- **Desktop**: Tauri app with .env bundled
- **Web**: SPA with .env injected at build time
