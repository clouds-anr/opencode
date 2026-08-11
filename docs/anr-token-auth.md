<!-- ANRCODE_CHANGE {"issue":310,"branch":"anr-token-based-auth","date":"2026-07-29"} -->

# ANR Token-Based Authentication Mode

Non-interactive, browserless auth for CI/CD pipelines. Set `OPENCODE_ANR_AUTH_MODE=token` to skip the OIDC browser flow.

**Recommended CI setup:** store a single long-lived Cognito **refresh token** in GitHub Actions secrets. At startup opencode exchanges it for a fresh ID token (refresh-first bootstrap), then federates that into AWS credentials — no manual token rotation, no browser.

## Environment Variable Contract

| Variable | Required | Description |
|---|---|---|
| `OPENCODE_ANR_AUTH_MODE` | No (default: `interactive`) | `interactive` or `token` |
| `OPENCODE_ANR_REFRESH_TOKEN` | Recommended for CI\* | Long-lived Cognito refresh token; a fresh ID token is minted at startup and on schedule |
| `OPENCODE_ANR_ID_TOKEN` | Only if no refresh token\* | Cognito OIDC ID token (JWT), short-lived (~1 h) |
| `AWS_ACCESS_KEY_ID` | No | If set with SECRET+TOKEN, skips federation exchange |
| `AWS_SECRET_ACCESS_KEY` | No | See above |
| `AWS_SESSION_TOKEN` | No | See above |
| `AWS_REGION` | No | Overrides config region when using static creds |
| `OPENCODE_ANR_SKIP_AUTH` | No | **Config-validation only** — not for real auth |

\* Token mode needs at least one of: `OPENCODE_ANR_REFRESH_TOKEN`, `OPENCODE_ANR_ID_TOKEN`, or the full static AWS credential triple.

## Credential Resolution

Token mode resolves credentials in this order:

1. **Static AWS creds** — if `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` are all set, use them directly. No Cognito call is made.
2. **Refresh-first bootstrap** — if `OPENCODE_ANR_REFRESH_TOKEN` is set, exchange it at Cognito's token endpoint for a fresh ID token, then federate that via the Cognito Identity Pool. If the refresh fails and `OPENCODE_ANR_ID_TOKEN` is also set, fall back to step 3; otherwise fail fast.
3. **Federation exchange** — exchange `OPENCODE_ANR_ID_TOKEN` via the Cognito Identity Pool configured in your `.env` file.

## Typical CI Usage

### Recommended: long-lived refresh token (autonomous)

```yaml
- name: Run opencode
  env:
    OPENCODE_FLAVOR: anr
    OPENCODE_ANR_AUTH_MODE: token
    OPENCODE_ANR_REFRESH_TOKEN: ${{ secrets.ANR_REFRESH_TOKEN }}
  run: opencode agent list
```

### With a short-lived ID token (manual rotation)

```yaml
- name: Run opencode
  env:
    OPENCODE_FLAVOR: anr
    OPENCODE_ANR_AUTH_MODE: token
    OPENCODE_ANR_ID_TOKEN: ${{ secrets.ANR_ID_TOKEN }}
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

## Provisioning the Refresh Token (one-time bootstrap)

1. Run opencode interactively once (`OPENCODE_ANR_AUTH_MODE` unset) and complete the browser OIDC login — ideally as a dedicated CI service account in the Cognito User Pool, not a personal account.
2. Capture the refresh token issued by the login and store it as the `ANR_REFRESH_TOKEN` GitHub Actions secret.
3. Confirm two settings on the Cognito **app client** with whoever administers the user pool:
   - **Refresh token validity** covers your desired CI credential lifetime (Cognito default is 30 days; configurable up to 10 years).
   - **Refresh token rotation is disabled.** If Cognito rotates the refresh token on each use, the statically stored secret is invalidated after the first CI run.

After that, every CI run self-serves fresh credentials for the life of the refresh token. The refresh call is a plain POST to Cognito's `/oauth2/token` endpoint using the public app client — no client secret is involved.

## Token Refresh Behaviour in Token Mode

| Scenario | Behaviour |
|---|---|
| `OPENCODE_ANR_REFRESH_TOKEN` set | Fresh ID token minted at startup; silent refresh on schedule thereafter — no browser |
| `OPENCODE_ANR_REFRESH_TOKEN` set, refresh fails at startup | Falls back to `OPENCODE_ANR_ID_TOKEN` if set; otherwise fails fast |
| `OPENCODE_ANR_REFRESH_TOKEN` set, scheduled refresh fails mid-run | Logs error, keeps existing creds until STS expiry. No browser fallback. |
| No `OPENCODE_ANR_REFRESH_TOKEN` | One-time warning logged. Creds remain valid until AWS STS expiry. No interactive fallback. |

Interactive mode (default) is unchanged: silent refresh attempted first, browser opened on failure.

## Fail-Fast Error Messages

Missing or invalid configuration exits immediately with a clear, actionable message:

```
[ANR] Token auth mode is missing required environment variable(s):
  - OPENCODE_ANR_ID_TOKEN is not set
  - OPENCODE_ANR_REFRESH_TOKEN is not set

To fix (one of):
  • Set OPENCODE_ANR_REFRESH_TOKEN to a long-lived Cognito refresh token
    (recommended for CI — a fresh ID token is minted automatically).
  • Set OPENCODE_ANR_ID_TOKEN to a valid, unexpired Cognito ID token.
  • Provide AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_SESSION_TOKEN
    to bypass federation entirely.
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

- **Refresh tokens** are the recommended CI secret: long-lived (configurable on the Cognito app client, up to 10 years), revocable, and exchanged automatically for short-lived ID tokens. Rotate per your org's policy.
- Cognito **ID tokens** are short-lived (typically 1 hour). Only use `ANR_ID_TOKEN` directly if you regenerate it before each CI run.
- AWS **STS session tokens** (`AWS_SESSION_TOKEN`) have their own expiry. If pre-issued, ensure they are valid for the duration of the job.
- Store all tokens exclusively in GitHub Actions secrets (or equivalent). Never commit them to `.env` files.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `missing required environment variable(s)` | No secret wired in workflow | Add `OPENCODE_ANR_REFRESH_TOKEN: ${{ secrets.ANR_REFRESH_TOKEN }}` to env |
| `refresh token exchange failed` | Expired/revoked refresh token, wrong app client, or rotation enabled | Re-provision the refresh token; verify `CLIENT_ID` matches the issuing app client; disable rotation on the app client |
| `federation exchange failed` | Expired or invalid ID token | Regenerate token; check identity pool ID and region in config |
| `does not appear to be a valid JWT` | Wrong secret mapped | Verify `ANR_ID_TOKEN` secret contains a valid Cognito ID token (three-part JWT) |
| `Unknown OPENCODE_ANR_AUTH_MODE value` | Typo in env var | Valid values: `interactive`, `token` |
| Credentials expire mid-job | No refresh token + long job | Add `OPENCODE_ANR_REFRESH_TOKEN` secret or break job into shorter steps |
| Second CI run fails after first succeeds | Refresh token rotation enabled on app client | Disable rotation, or update the stored secret with the rotated token |
