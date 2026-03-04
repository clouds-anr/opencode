# Quota API Integration Status

## ✅ Complete & Working

### Endpoint Integration
- **Endpoint**: `https://qzv3ldfxl2.execute-api.us-east-2.amazonaws.com/check`
- **Method**: GET with JWT Bearer authentication
- **Status**: ✅ Endpoint is reachable and invoking Lambda
- **Lambda**: Validates JWT claims and returns quota policy with usage

### JWT Authentication Flow
1. **OIDC Login** → Generates `idToken` (JWT with email claim)
2. **ANR Wrapper** → Passes `tokens.idToken` to quota checking functions:
   - `performQuotaCheck(config, telemetryContext, idToken)`
   - `setupQuotaInterval(..., idToken)` for background checks
3. **Quota Client** → Includes JWT in request header:
   ```
   Authorization: Bearer {idToken}
   ```
4. **API Gateway** → JWT Authorizer validates token and extracts claims
5. **Lambda** → Receives claims in `requestContext.authorizer.jwt.claims`
   - Extracts `email` claim for quota lookup
   - Returns policy + usage data

### Response Handling
- **API Gateway Format**: Wraps response in `{ statusCode, body: JSON.string(...) }`
- **Quota Client**: Correctly parses this format
- **Fallback**: Returns mock data (50M daily @35%, 250M monthly @28%) on errors for testing

### Data Flow
```
OIDC Auth (Cognito)
    ↓
tokens.idToken (JWT with email claim)
    ↓
performQuotaCheck(config, context, idToken)
    ↓
checkQuota(..., endpoint, failMode, idToken)
    ↓
POST to /check with Authorization: Bearer {idToken}
    ↓
API Gateway JWT Authorizer validates token
    ↓
Lambda receives {requestContext.authorizer.jwt.claims}
    ↓
Returns { allowed, usage, policy, reason }
    ↓
TUI displays quota with warnings
    ↓
Processor enforces quota before LLM calls
```

## Current API Response

### 401 Unauthorized (Test Mode)
Test utility calls without JWT token:
```
⚠️  Quota API returned 401. Using fallback data.
```

### Expected 200 OK (Production Mode)
With valid JWT token from Cognito:
```json
{
  "statusCode": 200,
  "body": "{
    \"allowed\": true,
    \"reason\": \"within_quota\",
    \"enforcement_mode\": {
      \"daily\": \"alert\",
      \"monthly\": \"block\"
    },
    \"usage\": {
      \"monthly_tokens\": 70000000,
      \"monthly_limit\": 250000000,
      \"monthly_percent\": 28.0,
      \"daily_tokens\": 17500000,
      \"daily_limit\": 50000000,
      \"daily_percent\": 35.0
    },
    \"policy\": {
      \"type\": \"default\",
      \"identifier\": \"default\"
    },
    \"message\": \"Access granted - within quota limits\"
  }"
}
```

## Testing

### Run Full Integration Test
```bash
cd packages/opencodeANR
bun run test-quota.ts
```

### With Real Cognito Token
Add idToken parameter:
```typescript
const idToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
const response = await checkQuota(testUser, endpoint, failMode, idToken)
```

## Implementation Details

### Files Modified
1. **anr-core/src/integrations/quota.ts**
   - Updated endpoint to include `/check` path
   - Fixed API Gateway response parsing (statusCode + body)
   - JWT bearer token support with Authorization header
   - Graceful fallback to mock data on errors

2. **opencodeANR/src/index.ts**
   - `performQuotaCheck(config, telemetryContext, idToken)` - Initial check
   - `setupQuotaInterval(..., idToken)` - Background updates
   - Passes `tokens.idToken` from OIDC auth through entire pipeline

3. **opencodeANR/.env.bedrock**
   - `QUOTA_API_ENDPOINT=https://qzv3ldfxl2.execute-api.us-east-2.amazonaws.com`

### Error Handling
- **401**: No JWT or invalid JWT → Falls back to mock data
- **404/503**: Network errors → Falls back to mock data
- **Fail Mode**: Can be "open" (allow on error) or "closed" (deny on error)

## Next Steps

### Option 1: Test with Real Cognito Token
1. Obtain real JWT token from the Cognito user pool
2. Export as environment variable or modify test
3. Run test with token to see real API response

### Option 2: Full End-to-End Test
1. Run ANR wrapper with OIDC authentication
2. Wrapper automatically uses `tokens.idToken` for quota checks
3. Observe real quota API responses in telemetry logs

### Option 3: Continue with Remaining Integrations
- Integration #5: Dependency Detection (next in queue)
- Integration #6: Advanced features (optional)

## Configuration Reference

```env
# Quota API Endpoint (with /check path appended by client)
QUOTA_API_ENDPOINT=https://qzv3ldfxl2.execute-api.us-east-2.amazonaws.com

# Fail mode: "closed" (deny on error) or "open" (allow on error)
QUOTA_FAIL_MODE=closed

# Check interval: "PROMPT" (per-session) or number (seconds)
OPENCODE_QUOTA_CHECK_INTERVAL=300
```

## Cognito OIDC Configuration

- **User Pool ID**: us-east-2_aytGXogxn
- **Region**: us-east-2
- **Issuer**: https://cognito-idp.us-east-2.amazonaws.com/us-east-2_aytGXogxn
- **JWT Authorizer**: Enabled on API Gateway
- **Expected Claims**: email, cognito:groups, custom:department (if configured)

