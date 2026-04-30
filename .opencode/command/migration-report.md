---
description: "Analyze a codebase and generate an HTML migration assessment report"
---

> **Before doing anything else**, load the `anr-csp-knowledge` skill. That skill contains domain expertise on Cloud One (C1), GovCloud CSP selection, App Analysis requirements, C1 restrictions, interface constraints, and migration gotchas. Apply this knowledge at every phase of the assessment. If the target is Cloud One or any restricted government platform, the C1-specific scoring, restrictions, and process guidance from that skill takes precedence over generic cloud migration criteria.

Perform a comprehensive migration assessment of the codebase at: $ARGUMENTS

If no path is provided, analyze the current working directory.

## Your Task

Conduct a deep codebase analysis and produce a self-contained HTML report file in the project root (or the analyzed directory if a path was given).

**Output filename:** Before writing, check if `migration-report.html` already exists in the target directory. If it does, check for `migration-report-2.html`, `migration-report-3.html`, and so on until you find the first available number. Use that filename. If no prior report exists, use `migration-report.html` (no number suffix).

---

## Cloud One / Restricted Government Platform Context

If this migration targets **Cloud One (C1)** or any DoD/Government restricted platform, apply the full `anr-csp-knowledge` skill throughout this assessment. Key C1 constraints that must be surfaced in every relevant section:

- **Port 443/HTTPS only** — any non-443 interface is a hard blocker; flag every occurrence
- **GCDS/SAML SSO** — applications must integrate with C1's SSO; flag custom auth or non-SAML systems
- **C1 service catalog** — not all CSP services are available; flag any service dependency that must be verified
- **Pre-configured VPC/subnet** — the program cannot customize C1's network guardrails
- **C1 is not NIPRNet** — NIPRNet-only dependencies over non-443 ports cannot be reached from C1
- **Interface partners** — program-to-program communication across C1 VPC boundaries is the most commonly missed blocker

Refer to the `anr-csp-knowledge` skill's reference files for deeper guidance:
- `c1-migration-process.md` — full onboarding sequence
- `csp-selection-guide.md` — CSP decision matrix
- `c1-restrictions-and-gotchas.md` — complete restrictions and lessons learned
- `app-analysis-guide.md` — App Analysis content and validation requirements
- `CCE App Analysis Checklist_v2.csv` — 45-item go/no-go checklist; validate every App Analysis section against it
- `CloudOne_DetailedSchedule_Template_Master_v1.0.csv` — official sprint schedule template; use as the basis for Migration Phases (sprint structure, hour estimates, CDRL timing)
- `A004_CloudOne_Configuration Management Plan_TEMPLATE_v1_4_1.md` — required CDRL deliverable; reference when assessing CM plan readiness
- `A038_CloudOne_Test Script_TEMPLATE_v1_6_1.md` — required CDRL deliverable; reference when assessing test coverage and test planning

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
9. **C1 / GovCloud signals** *(apply when target is a restricted government platform)*:
   - Interface inventory — scan all socket/TCP connections, HTTP clients, message queue clients, database drivers; note every port and protocol in use
   - Authentication mechanisms — custom auth, LDAP, OAuth, JWT, SAML; flag anything not SAML-compatible
   - Legacy technology — COBOL, Mainframe, very old app servers or database versions
   - Microsoft stack signals (Windows Server, SQL Server, .NET, Azure AD) → Azure CSP candidate
   - Oracle stack signals (Oracle DB, Oracle Linux, EBS, ERP) → OCI CSP candidate
   - NIPRNet dependencies — any references to AF network services or government-only endpoints
   - Architecture documentation — are current-state architecture diagrams available?

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
| 9 | **C1 / GovCloud Compliance** *(when applicable)* | Port 443/HTTPS-only interface compliance; SAML/GCDS SSO readiness; C1 service catalog compatibility; Mainframe/COBOL presence; NIPRNet dependency exposure; VPC/subnet assumption risks |

**Overall Score** = weighted average (Cloud Readiness 20%, Containerizability 15%, Serverless Fit 10%, Data Portability 15%, Dependency Risk 15%, Test Coverage 10%, Operational Complexity 10%, Security Posture 5%). When C1/GovCloud Compliance is scored, apply it as an additional weighted factor (15%) and reduce other weights proportionally.

> **C1 Scoring Note:** A score of 1-3 on C1/GovCloud Compliance indicates hard blockers that will prevent migration without significant remediation. Common blockers: non-443 interfaces, COBOL/Mainframe workloads, NIPRNet-only services, missing SAML support. Refer to `c1-restrictions-and-gotchas.md` for the full catalog.

---

## Phase 3: Migration Assessment

Based on Phase 1 and 2, determine:

1. **Recommended Migration Approach** — one of:
   - Lift & Shift (Rehost)
   - Replatform (minor changes)
   - Refactor / Re-architect
   - Replace (rebuild or buy)
   - Retire

   *C1 context:* Most C1 migrations aim for Lift & Shift or Replatform to minimize code changes. Full refactor is required for COBOL/Mainframe. Interface refactoring (port 443) and auth changes (GCDS/SAML) are almost always needed regardless of approach.

2. **Target Platform** — primary recommendation + alternatives with tradeoffs:
   - Containerized (Kubernetes / AKS / EKS / GKE)
   - Serverless (Azure Functions / AWS Lambda / Cloud Run)
   - PaaS (App Service / Elastic Beanstalk / Cloud Run)
   - CSP-native (full managed services)
   - Hybrid
   - **Cloud One — AWS GovCloud** *(default for DoD programs; broadest C1 service catalog)*
   - **Cloud One — Azure Government** *(preferred for Microsoft-stack programs)*
   - **Cloud One — OCI GovCloud** *(preferred for Oracle-stack programs)*
   - **Cloud One — GCP** *(consider for big data; limited C1 support)*

   *C1 CSP selection:* Apply the decision matrix from `csp-selection-guide.md` when the target is C1. Default to AWS unless the technology stack strongly favors Azure (Microsoft) or OCI (Oracle).

3. **Target Architecture** — describe the recommended end-state architecture as Mermaid diagrams:
   - **System Context Diagram** — current system and its external dependencies
   - **Target Architecture Diagram** — cloud-native end state with services, data flows, and boundaries

4. **Migration Phases** — a sequenced phase plan (Phase 1 MVP → Phase 2 → Target State)

   *C1 context:* Use `CloudOne_DetailedSchedule_Template_Master_v1.0.csv` as the structural template for C1 migrations. Align phases to its sprint model: Sprint 0 (setup/onboarding), Sprints 1-5 (Refactor Phase), Sprint 6 (Integration), Sprints 7-9 (Test Phase), Sprint 10 (Production Cutover), Sprints 11-14 (Burn-in & Knowledge Transfer). Surface the role-based hour estimates and CDRL deliverable timing from that template.

5. **Key Risks & Blockers** — top 3–5 issues that must be resolved for migration success

   *C1-specific risks to always evaluate (apply when target is C1):*
   - Non-443/HTTPS interfaces (hard blocker — list all affected interfaces)
   - Missing GCDS/SAML authentication integration (auth refactor required)
   - COBOL/Mainframe workloads (requires full refactor or Mainframe simulator)
   - NIPRNet service dependencies unreachable from C1 (connectivity blocker)
   - Inaccurate compute/storage estimates (directly affects funding accuracy)
   - Outdated/missing architecture documentation (blocks App Analysis)
   - Unapproved CSP services in the design (must verify against C1 service catalog)
   - Missing or incomplete CDRL deliverables: CM Plan (`A004`) and Test Script (`A038`) are required for all C1 programs — flag if the codebase shows no evidence of either

   Refer to `c1-restrictions-and-gotchas.md` for the full catalog of C1-specific risks.

   *C1 App Analysis validation:* Before finalizing the assessment, cross-check all findings against the 45-item `CCE App Analysis Checklist_v2.csv`. Surface any checklist items that are incomplete or unaddressed in the codebase evidence. Flag items that require confirmation from the Mission App Team (code freeze plan, data migration cutover approach, interface trading partner approvals, cloud tool funding sources).

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
  4. **C1 / GovCloud Compliance Summary** *(include when target is C1)* — interface port compliance table, GCDS readiness, CSP recommendation with rationale, list of hard blockers found
  5. Target Architecture (Mermaid diagrams: System Context + Target State)
  6. Migration Phases (timeline or numbered phase table)
  7. Detailed Findings (per-category evidence)
  8. Key Risks & Blockers
  9. Appendix: Discovery Summary (languages, file counts, key files found)

Use this color scheme:
- Score ≥ 7: `#22c55e` (green)
- Score 4–6: `#f59e0b` (amber)  
- Score ≤ 3: `#ef4444` (red)
- Background: `#0f172a`, Cards: `#1e293b`, Text: `#e2e8f0`, Accent: `#38bdf8`

After writing the file, confirm:
- The file path where the report was written (including the resolved filename)
- The overall score
- The recommended migration approach and target platform
- The top 3 risks identified
