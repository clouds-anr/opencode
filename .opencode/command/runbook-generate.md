---
description: "Analyze a service and generate an operations runbook"
---

> **If this service is deployed on Cloud One (C1) or any DoD/Government GovCloud platform**, load the `anr-csp-knowledge` skill before proceeding. It will add C1-specific failure modes (GCDS SSO outage, Artifactory connectivity loss, STIG scan findings blocking deployment, C1 account policy violations), surface C1-specific configuration variables, and shape the deployment/rollback procedures to reflect Artifactory-based artifact delivery rather than direct registry pushes.

Analyze the service or codebase at: $ARGUMENTS

If no path is provided, analyze the current working directory.

## Your Task

Generate a comprehensive operations runbook as a markdown file named `RUNBOOK.md` in the analyzed directory. The runbook should give an on-call engineer everything they need to operate the service on day one — without requiring them to read the source code. It should be committable, diffable, and renderable in GitHub/GitLab/Confluence.

---

## Phase 1: Discovery

Read the codebase to extract operational facts:

1. **Service identity** — what does this service do? What does it own? What calls it?
2. **Entry points** — HTTP endpoints, queue consumers, scheduled jobs, CLI entrypoints
3. **Dependencies** — upstream services, downstream services, databases, caches, message queues, external APIs
4. **Configuration** — all environment variables and config files; note which are required vs. optional, and what happens if they are missing
5. **Health & readiness** — health check endpoints, readiness probes, liveness probes
6. **Startup & shutdown** — how the service starts, any initialization steps, graceful shutdown behavior
7. **Logging** — log library, log levels, where logs go, any structured log fields
8. **Metrics & tracing** — metrics endpoints, tracing instrumentation, dashboards referenced
9. **Error patterns** — error handling, retry logic, dead letter queues, fallback behavior
10. **Deployment** — Dockerfile, CI/CD pipeline, deployment scripts, rollback mechanism
11. **Data** — databases owned, schema migration tooling, backup/restore references
12. **Security** — auth mechanisms, secret sources (env, vault, secret manager), TLS configuration

---

## Phase 2: Runbook Content

Structure the runbook with the following sections:

### 1. Service Overview
- What the service does in 2–3 sentences
- Owner / team
- Tech stack summary
- Links to key resources (repo, CI pipeline, dashboard — infer from config where possible)

### 2. Architecture
- Mermaid diagram showing this service, its dependencies, and data flows
- Dependency table: name, type (DB/API/queue), direction (in/out), criticality (hard/soft dependency)

### 3. Configuration Reference
Table of all environment variables:

| Variable | Required | Default | Description | Where set |
|----------|----------|---------|-------------|-----------|

Flag any variables that have no default and no evidence of being set in config — these are operational risk items.

### 4. Startup & Shutdown

**Starting the service:**
- Prerequisites (dependencies that must be healthy first)
- Start command
- Expected startup log messages / indicators of healthy start
- Estimated startup time

**Stopping the service:**
- Graceful shutdown command
- Drain time / in-flight request handling
- Any cleanup steps required

### 5. Health Checks
- Health check endpoint URL and expected response
- Readiness vs. liveness distinction (if applicable)
- What a healthy vs. unhealthy response looks like
- Manual verification command (e.g., `curl` example)

### 6. Common Failure Modes

For each identified dependency and error pattern, document:

| Failure | Symptoms | Likely Cause | Remediation Steps |
|---------|----------|--------------|-------------------|

At minimum cover:
- Service fails to start
- Database connection failure
- Upstream dependency unavailable
- Memory/CPU pressure
- Deployment failure / bad rollout

*C1-specific failure modes to add when deployed on Cloud One:*
- GCDS/SSO outage — symptoms, fallback behavior, who to contact at C1
- Artifactory unreachable — deployment pipeline fails, artifact pull fails
- STIG scan findings blocking a release — what findings block vs. what can be waived
- C1 account policy violation — service action blocked by SCP or guardrail; how to identify and escalate
- Certificate expiry (AF-PKI) — HTTPS/SAML breaks; renewal process

### 7. Runbook Procedures

#### Deploy
Step-by-step deployment procedure including pre-deploy checks, deployment command, post-deploy verification, and rollback steps.

#### Rollback
How to roll back to a previous version. Include the exact commands where discoverable.

#### Restart
Safe restart procedure without data loss.

#### Scale
How to scale the service up/down (horizontal or vertical).

#### Check Logs
Where logs live, how to query them, key log patterns to look for when debugging.

### 8. Monitoring & Alerting
- Key metrics to watch (infer from instrumentation found)
- Alert thresholds if defined in config
- Dashboard links if referenced

### 9. On-Call Escalation
- Who to contact if the runbook doesn't resolve the issue
- Severity definitions (P1/P2/P3) if defined anywhere in the repo

### 10. Known Issues & Gotchas
Any non-obvious behavior discovered during analysis that would surprise an on-call engineer. Flag TODOs, FIXMEs, and comments marked with `HACK`, `WORKAROUND`, or similar.

---

## Phase 3: Write the Runbook

**Filename:** Before writing, check whether `RUNBOOK.md` already exists in the analyzed directory. If it does, use `RUNBOOK-2.md`; if that exists too, use `RUNBOOK-3.md`, and so on — never overwrite an existing file.

Write the runbook (using the resolved filename above) in the analyzed directory. Requirements:

- **Markdown** — standard CommonMark; use fenced code blocks, tables, and `>` blockquotes for warnings
- **Mermaid diagrams** — use fenced ` ```mermaid ` blocks (renders natively in GitHub, GitLab, and most wikis)
- **Warning callouts** — use `> ⚠️ **Warning:**` blockquote format for critical gaps
- **Sections in order** matching Phase 2 above
- **Copy-friendly commands** — all shell commands in fenced code blocks with the language tag

- **File paths**: use forward slashes in all tool call `filePath` arguments, even on Windows. Use relative paths from the project root (e.g., `packages/app/RUNBOOK.md`), not absolute Windows paths.

After writing the file, confirm:
- The file path where the runbook was written (include the resolved filename)
- Count of environment variables documented
- Count of failure modes documented
- Any critical gaps found (missing health check, no rollback mechanism, unset required config, etc.)
