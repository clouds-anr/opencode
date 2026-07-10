# ANR Token-Based Authentication Mode

Non-interactive, browserless auth for CI/CD pipelines. Set `OPENCODE_ANR_AUTH_MODE=token` to skip the OIDC browser flow.

## Environment Variable Contract

| Variable | Required | Description |
|---|---|---|
| `OPENCODE_ANR_AUTH_MODE` | No (default: `interactive`) | `interactive` or `token` |
| `OPENCODE_ANR_ID_TOKEN` | Yes in token mode\* | Cognito OIDC ID token (JWT) |
| `OPENCODE_ANR_REFRESH_TOKEN` | No | Enables scheduled token refresh without browser |
| `AWS_ACCESS_KEY_ID` | No | If set with SECRET+TOKEN, skips federation exchange |
| `AWS_SECRET_ACCESS_KEY` | No | See above |
| `AWS_SESSION_TOKEN` | No | See above |
| `AWS_REGION` | No | Overrides config region when using static creds |
| `OPENCODE_ANR_SKIP_AUTH` | No | **Config-validation only** — not for real auth |

\* Not required if `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_SESSION_TOKEN` are all set.

## Credential Resolution

Token mode resolves credentials in this order:

1. **Static AWS creds** — if `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` are all set, use them directly. No Cognito Identity Pool call is made.
2. **Federation exchange** — otherwise, exchange `OPENCODE_ANR_ID_TOKEN` via the Cognito Identity Pool configured in your `.env` file.

## Typical CI Usage

### With federation exchange (Cognito token → AWS creds)

```yaml
- name: Run opencode
  env:
    OPENCODE_FLAVOR: anr
    OPENCODE_ANR_AUTH_MODE: token
    OPENCODE_ANR_ID_TOKEN: ${{ secrets.ANR_ID_TOKEN }}
    OPENCODE_ANR_REFRESH_TOKEN: ${{ secrets.ANR_REFRESH_TOKEN }}  # optional
  run: opencode agent list
```

### With pre-issued AWS credentials (skip federation)

```yaml
- name: Run opencode
  env:
    OPENCODE_FLAVOR: anr
    OPENCODE_ANR_AUTH_MODE: token
    OPENCODE_ANR_ID_TOKEN: ${{ secrets.ANR_ID_TOKEN }}  # still used for telemetry context
    AWS_ACCESS_KEY_ID: ${{ secrets.ANR_AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.ANR_AWS_SECRET_ACCESS_KEY }}
    AWS_SESSION_TOKEN: ${{ secrets.ANR_AWS_SESSION_TOKEN }}
  run: opencode agent list
```

## Token Refresh Behaviour in Token Mode

| Scenario | Behaviour |
|---|---|
| `OPENCODE_ANR_REFRESH_TOKEN` set, refresh succeeds | Silent refresh — no browser |
| `OPENCODE_ANR_REFRESH_TOKEN` set, refresh fails | Logs error, keeps existing creds until STS expiry. No browser fallback. Re-run with a fresh token. |
| No `OPENCODE_ANR_REFRESH_TOKEN` | One-time warning logged. Creds remain valid until AWS STS expiry. No interactive fallback. |

Interactive mode (default) is unchanged: silent refresh attempted first, browser opened on failure.

## Fail-Fast Error Messages

Missing or invalid configuration exits immediately with a clear, actionable message:

```
[ANR] Token auth mode is missing required environment variable(s):
  - OPENCODE_ANR_ID_TOKEN is not set

To fix:
  • Set OPENCODE_ANR_ID_TOKEN to a valid Cognito ID token.
  • Or provide AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_SESSION_TOKEN
    to bypass federation entirely.
  • OPENCODE_ANR_REFRESH_TOKEN is optional but enables token refresh in CI.
```

Error messages **never** include secret values.

## Differences: `OPENCODE_ANR_SKIP_AUTH` vs `OPENCODE_ANR_AUTH_MODE=token`

| | `OPENCODE_ANR_SKIP_AUTH=1` | `OPENCODE_ANR_AUTH_MODE=token` |
|---|---|---|
| Purpose | Config-lint / validation only | Real production CI auth |
| Authentication | Skipped entirely | Performed (token or federation) |
| AWS credentials | Not obtained | Obtained and set in env |
| Telemetry | Not initialized | Initialized |
| Quota check | Skipped | Performed |
| Use in | `validate-opencode-config.ts` | Any CI job needing full ANR |

**Do not** use `OPENCODE_ANR_SKIP_AUTH` for jobs that need to reach backend services — it bypasses all auth and will result in missing credentials.

## Secret Rotation and Expiry

- Cognito ID tokens are **short-lived** (typically 1 hour). Rotate `ANR_ID_TOKEN` before each CI run or use a workflow that generates a fresh token at job start.
- If `OPENCODE_ANR_REFRESH_TOKEN` is provided, opencode will refresh automatically before STS expiry. Refresh tokens are longer-lived but should be rotated regularly per your org's policy.
- AWS STS session tokens (`AWS_SESSION_TOKEN`) have their own expiry. If pre-issued, ensure they are valid for the duration of the job.
- Store all tokens exclusively in GitHub Actions secrets (or equivalent). Never commit them to `.env` files.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `OPENCODE_ANR_ID_TOKEN is not set` | Secret not wired in workflow | Add `OPENCODE_ANR_ID_TOKEN: ${{ secrets.ANR_ID_TOKEN }}` to env |
| `federation exchange failed` | Expired or invalid ID token | Regenerate token; check identity pool ID and region in config |
| `does not appear to be a valid JWT` | Wrong secret mapped | Verify `ANR_ID_TOKEN` secret contains a valid Cognito ID token (three-part JWT) |
| `Unknown OPENCODE_ANR_AUTH_MODE value` | Typo in env var | Valid values: `interactive`, `token` |
| Credentials expire mid-job | No refresh token + long job | Add `OPENCODE_ANR_REFRESH_TOKEN` secret or break job into shorter steps |
