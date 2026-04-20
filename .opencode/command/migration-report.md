---
description: "Analyze a codebase and generate an HTML migration assessment report"
---

Perform a comprehensive migration assessment of the codebase at: $ARGUMENTS

If no path is provided, analyze the current working directory.

## Your Task

Conduct a deep codebase analysis and produce a self-contained HTML report file named `migration-report.html` in the project root (or the analyzed directory if a path was given).

---

## Phase 1: Discovery (Read Everything Relevant)

Explore the codebase thoroughly before scoring anything:

1. **Structure** — directory tree, package manifests (`package.json`, `pom.xml`, `requirements.txt`, `go.mod`, `*.csproj`, `Cargo.toml`, etc.), language breakdown
2. **Infrastructure signals** — `Dockerfile`, `docker-compose.yml`, `kubernetes/`, `helm/`, `.github/workflows/`, `terraform/`, `serverless.yml`, `azure-pipelines.yml`, `Makefile`
3. **Data layer** — database drivers, ORM usage, migration files, schema definitions, connection strings
4. **Dependencies** — third-party libraries, licensing, EOL components, cloud-vendor-specific SDKs
5. **Configuration** — environment variable usage, secrets management, config files
6. **Testing** — test files, coverage config, CI test steps
7. **Security signals** — auth libraries, secret handling, HTTPS enforcement, dependency vulnerability hints
8. **Operational signals** — logging libraries, monitoring/tracing, health check endpoints

---

## Phase 2: Scoring

Score each category from **1–10** (10 = best/most ready). Provide a 2–4 sentence rationale and list 2–5 specific evidence items (file paths, patterns found) per category.

### Categories

| # | Category | What to Assess |
|---|----------|----------------|
| 1 | **Cloud Readiness** | 12-factor compliance, externalized config, statelessness, horizontal scalability signals |
| 2 | **Containerizability** | Dockerfile presence/quality, OS dependencies, build reproducibility, port bindings, volume assumptions |
| 3 | **Serverless Fit** | Statelessness, startup time signals, function granularity, long-running process patterns, cold-start tolerance |
| 4 | **Data Portability** | DB vendor lock-in, schema migration tooling, data volume hints, cross-DB compatibility, ORM abstraction |
| 5 | **Dependency Risk** | EOL libraries, vendor-specific lock-in, license conflicts, unpinned versions, supply-chain hygiene |
| 6 | **Test Coverage** | Test file presence, coverage tooling, CI test gates, test-to-code ratio signals |
| 7 | **Operational Complexity** | Logging maturity, observability (metrics/tracing), secret management, runbook/doc presence |
| 8 | **Security Posture** | Auth/authz patterns, secrets in code, HTTPS enforcement, dependency vulnerability signals, input validation |

**Overall Score** = weighted average (Cloud Readiness 20%, Containerizability 15%, Serverless Fit 10%, Data Portability 15%, Dependency Risk 15%, Test Coverage 10%, Operational Complexity 10%, Security Posture 5%).

---

## Phase 3: Migration Assessment

Based on Phase 1 and 2, determine:

1. **Recommended Migration Approach** — one of:
   - Lift & Shift (Rehost)
   - Replatform (minor changes)
   - Refactor / Re-architect
   - Replace (rebuild or buy)
   - Retire
   
2. **Target Platform** — primary recommendation + alternatives with tradeoffs:
   - Containerized (Kubernetes / AKS / EKS / GKE)
   - Serverless (Azure Functions / AWS Lambda / Cloud Run)
   - PaaS (App Service / Elastic Beanstalk / Cloud Run)
   - CSP-native (full managed services)
   - Hybrid

3. **Target Architecture** — describe the recommended end-state architecture as Mermaid diagrams:
   - **System Context Diagram** — current system and its external dependencies
   - **Target Architecture Diagram** — cloud-native end state with services, data flows, and boundaries

4. **Migration Phases** — a sequenced phase plan (Phase 1 MVP → Phase 2 → Target State)

5. **Key Risks & Blockers** — top 3–5 issues that must be resolved for migration success

---

## Phase 4: Write the HTML Report

Write a self-contained `migration-report.html` file. Requirements:

- **Self-contained** — all CSS inline, no external dependencies except Mermaid CDN
- **Professional** — clean layout, color-coded scores (green ≥7, amber 4–6, red ≤3)
- **Mermaid diagrams** — use `<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js">` and `<div class="mermaid">` blocks
- **Sections in order:**
  1. Executive Summary (approach, target platform, overall score, top risk)
  2. Overall Score card (visual gauge or large number + color)
  3. Category Scores (table + progress bars, each with rationale)
  4. Target Architecture (Mermaid diagrams: System Context + Target State)
  5. Migration Phases (timeline or numbered phase table)
  6. Detailed Findings (per-category evidence)
  7. Key Risks & Blockers
  8. Appendix: Discovery Summary (languages, file counts, key files found)

Use this color scheme:
- Score ≥ 7: `#22c55e` (green)
- Score 4–6: `#f59e0b` (amber)  
- Score ≤ 3: `#ef4444` (red)
- Background: `#0f172a`, Cards: `#1e293b`, Text: `#e2e8f0`, Accent: `#38bdf8`

After writing the file, confirm:
- The file path where `migration-report.html` was written
- The overall score
- The recommended migration approach and target platform
- The top 3 risks identified
