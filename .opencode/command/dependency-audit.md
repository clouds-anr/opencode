---
description: "Audit all dependencies for vulnerabilities, EOL status, license issues, and supply-chain risk"
---

Audit the dependencies of the project at: $ARGUMENTS

If no path is provided, analyze the current working directory.

## Your Task

Perform a comprehensive dependency audit across all package manifests in the project and produce a self-contained HTML report named `dependency-audit.html` in the project root.

---

## Phase 1: Discovery

Find and read every dependency manifest in the project:

- **JavaScript/TypeScript** — `package.json` (all workspaces), `package-lock.json`, `yarn.lock`, `bun.lockb`
- **Python** — `requirements.txt`, `requirements-dev.txt`, `Pipfile`, `pyproject.toml`, `poetry.lock`
- **Java** — `pom.xml`, `build.gradle`, `build.gradle.kts`
- **Go** — `go.mod`, `go.sum`
- **Rust** — `Cargo.toml`, `Cargo.lock`
- **.NET** — `*.csproj`, `*.fsproj`, `packages.config`
- **Ruby** — `Gemfile`, `Gemfile.lock`
- **Docker** — `Dockerfile` (base image versions)

For each manifest, extract:
- Package name
- Current version (pinned vs. range)
- Whether it is a runtime dependency or dev/build dependency
- Whether it appears in a lockfile (locked = good; unpinned with no lockfile = risk)

---

## Phase 2: Analysis

Evaluate each dependency across five dimensions:

### 1. Known Vulnerabilities (CVE / Security Advisories)
Flag packages with known CVEs based on:
- Packages on the CISA KEV list or with recent critical/high CVEs from your training knowledge
- Very old pinned versions of high-profile libraries (e.g., `log4j < 2.17`, `lodash < 4.17.21`, `axios < 1.6.0`, `django < 4.2`, `spring-boot < 3.x`)
- Base Docker images that are outdated (e.g., `node:14`, `python:3.8`, `ubuntu:18.04`)

Severity: **Critical** (CVSS ≥ 9.0) | **High** (7.0–8.9) | **Medium** (4.0–6.9) | **Low** (< 4.0)

### 2. End-of-Life (EOL) Status
Flag packages and runtimes that are past end-of-life or approaching it (within 6 months):
- Node.js LTS schedule
- Python version support
- Java LTS versions
- .NET support lifecycle
- Common library major versions with declared EOL

### 3. License Risk
Flag licenses that create legal/compliance risk:

| Risk Level | Licenses |
|------------|---------|
| **Blocked** (cannot use in proprietary software) | AGPL-3.0, GPL-2.0, GPL-3.0, LGPL-2.0 (without linking exception) |
| **Review Required** | LGPL-2.1, MPL-2.0, EUPL, CC-BY-SA |
| **Permissive (OK)** | MIT, Apache-2.0, BSD-2/3-Clause, ISC, CC0 |
| **Unknown** | No license declared — flag for review |

### 4. Version Pinning & Supply-Chain Hygiene
- **Unpinned versions** — ranges like `^1.0.0`, `>=2.0`, `*` create reproducibility risk
- **No lockfile** — package manager without a committed lockfile
- **Abandoned packages** — packages with no releases in 3+ years that are not mature/stable
- **Single-maintainer packages** — high-value packages with no organizational backing (assess based on known context)
- **Typosquatting risk** — package names suspiciously close to popular packages

### 5. Duplication & Bloat
- Packages that appear to serve the same purpose (e.g., multiple HTTP clients, multiple test frameworks)
- Very large packages where a lighter alternative exists
- Dev dependencies incorrectly in production dependencies

---

## Phase 3: Findings Report

### Severity Tiers

| Tier | Criteria | Action |
|------|----------|--------|
| **Critical** | Known CVE with CVSS ≥ 9.0, or AGPL/GPL license in proprietary code | Fix before next deployment |
| **High** | Known CVE CVSS 7–9, EOL runtime, unknown license | Fix within current sprint |
| **Medium** | Outdated minor versions, approaching EOL, license review needed | Plan remediation |
| **Low** | Unpinned ranges, no lockfile, bloat | Address in maintenance cycle |
| **Info** | Observations without risk (duplication, alternatives available) | Consider |

---

## Phase 4: Write the HTML Report

Write a self-contained `dependency-audit.html` file with:

- **Executive Summary** — total dependencies scanned, count per severity tier, top 3 actions
- **Critical & High Findings** — each as a card with: package name, current version, issue, recommended fix
- **Full Findings Table** — all flagged items filterable by severity, type (CVE / EOL / License / Pinning), and ecosystem
- **License Inventory** — table of all unique licenses found across all dependencies
- **EOL Timeline** — any runtimes or libraries with upcoming EOL dates (next 12 months)
- **Remediation Checklist** — ordered action list: fix criticals first, then highs, then mediums

Use this color scheme:
- Background: `#0f172a`, Cards: `#1e293b`, Text: `#e2e8f0`, Accent: `#38bdf8`
- Critical: `#ef4444`, High: `#f97316`, Medium: `#f59e0b`, Low: `#6b7280`, Info: `#38bdf8`

After writing the file, confirm:
- The file path where `dependency-audit.html` was written
- Total dependencies scanned
- Count of findings per severity tier
- The single highest-priority remediation item
