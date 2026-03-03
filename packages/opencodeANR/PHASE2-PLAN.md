# Phase 2: Enterprise Integration Plan

## Current State (Phase 1 ✅)
- OpenCode ANR functions as a working CLI
- All base OpenCode commands operational
- Integration code scaffolded and tested
- Launches base OpenCode with ANR environment variables

## Phase 2 Goals
Add enterprise integrations incrementally without breaking the working CLI.

---

## Integration 1: AWS Profile Authentication
**Goal**: Auto-authenticate with AWS SSO before CLI starts

### Implementation
1. Modify `src/index.ts` to detect `.env.bedrock` file
2. If found, initialize AWS authentication before spawning opencode
3. Set AWS credentials in environment for child process
4. Handle SSO refresh/expiration

### Files to Modify
- `src/index.ts` - Add pre-launch authentication
- Use existing `src/integrations/cognito-sso.ts`

### Testing
```bash
bun dev:anr models bedrock
# Should auto-login via AWS SSO
```

---

## Integration 2: OpenTelemetry Metrics
**Goal**: Send usage metrics to internal OTEL collector

### Implementation
1. Initialize OTEL SDK with config from env file
2. Export metrics during CLI operation
3. Track: command usage, model calls, token counts

### Files to Modify
- `src/index.ts` - Initialize OTEL before spawning
- Fix SDK compatibility issue in `src/integrations/otel.ts`

### Research Needed
- Examine `GoApp/internal/otelhelper/` for working OTEL implementation
- Match their OTEL SDK version/approach

---

## Integration 3: DynamoDB Audit Logger
**Goal**: Log all CLI operations to DynamoDB for compliance

### Implementation
1. Initialize audit logger at CLI start
2. Log session events (start, end, commands)
3. Wrap API calls to Bedrock with audit logging

### Files to Modify
- `src/index.ts` - Initialize logger
- `src/middleware/audit-logger.ts` - Fix credential issues

### Research Needed
- Check how GoApp accesses DynamoDB (role assumption?)
- Verify IAM permissions for audit table access

---

## Integration 4: Quota API Enforcement
**Goal**: Check quota before expensive operations

### Implementation
1. Add pre-command hooks to check quota
2. Fail fast if quota exceeded
3. Support fail-open/fail-closed modes

### Files to Modify
- `src/index.ts` - Add quota check middleware
- `src/middleware/quota-policy.ts` - Fix endpoint path

### Research Needed
- Examine `GoApp/internal/audit/` for quota API usage
- Get correct endpoint paths and request format

---

## Integration 5: Dependency Detection
**Goal**: Automatically detect project dependencies

### Implementation
1. Run dependency detector on project load
2. Include in context for AI
3. Use for better code suggestions

### Files to Modify
- `src/index.ts` - Run detector at startup
- Already working: `src/middleware/dependency-detector.ts`

---

## Implementation Strategy

### Approach: Feature Flags
Add each integration with environment variable toggles:
```bash
# .env.bedrock
ANR_ENABLE_AUTH=true
ANR_ENABLE_OTEL=true
ANR_ENABLE_AUDIT=true
ANR_ENABLE_QUOTA=true
```

This allows:
- Incremental rollout
- Easy debugging
- Graceful degradation
- Testing in isolation

### Code Pattern
```typescript
// src/index.ts
if (config.ANR_ENABLE_AUTH) {
  await initializeAuth(config)
}

if (config.ANR_ENABLE_OTEL) {
  initializeOTEL(config)
}

// Then spawn base opencode CLI
spawnOpenCode()
```

---

## Next Steps

1. **Research**: Examine GoApp internals for working implementations
   - `internal/audit/` - Quota API and audit logging
   - `internal/otelhelper/` - OTEL metrics
   - `internal/config/` - Config patterns

2. **Fix Issues**: Resolve known problems
   - OTEL SDK version mismatch
   - DynamoDB credential permissions
   - Quota API endpoint path

3. **Integrate**: Add features one at a time
   - Start with auth (simplest)
   - Then OTEL, audit, quota
   - Test each thoroughly before next

4. **Document**: Update README as features activate
   - Change 🔧 to ✅ for completed features
   - Add configuration examples
   - Document troubleshooting

---

## Success Criteria

Phase 2 is complete when:
- ✅ All 5 integrations active
- ✅ Environment file drives all behavior
- ✅ Graceful fallback if AWS unavailable
- ✅ No breaking changes to base OpenCode
- ✅ Can be distributed as standalone binary
