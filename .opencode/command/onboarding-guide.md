---
description: "Analyze a repo and generate a developer onboarding guide"
---

Analyze the repository at: $ARGUMENTS

If no path is provided, analyze the current working directory.

## Your Task

Generate a comprehensive developer onboarding guide as a markdown file named `ONBOARDING.md` in the repository root. The goal: a developer who has never seen this codebase should be able to clone it, run it locally, and make their first contribution — following only this guide, without asking anyone for help. It should be committable to the repo and render cleanly in GitHub/GitLab.

---

## Phase 1: Discovery

Read the repo thoroughly to extract everything a new developer needs:

1. **Purpose** — what does this project do? What problem does it solve?
2. **Tech stack** — languages, frameworks, runtime versions, package manager
3. **Repository structure** — key directories and what they contain; monorepo vs. single package
4. **Prerequisites** — tools that must be installed before setup (Node, Python, Docker, etc.) with version requirements
5. **Environment variables** — all `.env.example`, `env.sample`, config files; every variable a developer needs to set locally
6. **Setup steps** — install, build, seed/migrate, start commands; infer the correct sequence from scripts and README
7. **Running locally** — dev server command, expected port, how to verify it's working
8. **Testing** — how to run tests, run a single test, check coverage
9. **Linting & formatting** — how to run lint, format on save config, pre-commit hooks
10. **Key scripts** — all scripts in `package.json`, `Makefile`, `scripts/` worth knowing
11. **Architecture** — how the major pieces fit together (services, packages, layers)
12. **External dependencies** — third-party services needed locally (databases, queues, mock APIs); note which have Docker Compose equivalents
13. **CI/CD** — where the pipeline is, what it checks, how to read a failed run
14. **Contribution workflow** — branch naming, commit conventions, PR process (infer from CONTRIBUTING.md, PR templates, commit history patterns)
15. **Common gotchas** — TODOs, FIXMEs, comments warning future developers, known setup friction points

---

## Phase 2: Onboarding Guide Content

Structure the guide with these sections:

### 1. What Is This?
2–4 sentence plain-language description of the project. What it does, who uses it, why it exists.

### 2. Architecture Overview
- Mermaid diagram showing major components and their relationships
- Brief description of each major component/package/service

### 3. Prerequisites
Checklist of everything to install before starting, with version requirements and installation links:

| Tool | Required Version | Install |
|------|-----------------|---------|
| Node.js | >= X.X | https://nodejs.org |
| ... | | |

### 4. First-Time Setup
Numbered step-by-step setup from clone to running. No steps skipped. Include the exact commands to run.

### 5. Environment Variables
Table of all environment variables:

| Variable | Required | Example Value | Description |
|----------|----------|---------------|-------------|

Note which can be left as defaults for local development and which need real values (API keys, DB credentials, etc.).

### 6. Running Locally
- Start command
- Expected URL / port
- How to verify the app is working (what to look for)
- Hot reload behavior

### 7. Testing
- Run all tests: `[command]`
- Run a single test: `[command]`
- Run with coverage: `[command]`
- Where test files live
- Anything special about the test setup (fixtures, test DB, mocks)

### 8. Key Scripts Reference
Table of all useful scripts:

| Script | Command | What It Does |
|--------|---------|-------------|

### 9. Codebase Map
For each major directory/package, one sentence describing what it owns and what NOT to put in it. Help a new developer know where to look and where to make changes.

### 10. Contribution Workflow
- Branch naming convention
- Commit message format
- How to open a PR
- What the CI pipeline checks
- Review process / who to request review from

### 11. Gotchas & Known Issues
Anything that trips up new developers. Draw from TODOs, FIXMEs, and non-obvious setup requirements found during discovery.

### 12. Getting Help
Where to go when stuck — Slack channels, wiki links, team contacts (infer from CODEOWNERS, README, or package.json author fields where available).

---

## Phase 3: Write the Onboarding Guide

Write `ONBOARDING.md` in the repository root. Requirements:

- **Markdown** — standard CommonMark; renders in GitHub, GitLab, Notion, and Confluence
- **Navigable** — use a Table of Contents at the top with anchor links to each section
- **Copy-friendly** — all commands in fenced code blocks with the appropriate language tag
- **Mermaid diagrams** — use fenced ` ```mermaid ` blocks for the architecture overview
- **Checklist items** — use `- [ ]` checkbox syntax for prerequisite and setup step lists
- **Gotcha callouts** — use `> ⚠️ **Gotcha:**` blockquote format for known friction points

- **File paths**: use forward slashes in all tool call `filePath` arguments, even on Windows. Use relative paths from the project root (e.g., `ONBOARDING.md`), not absolute Windows paths.

After writing the file, confirm:
- The file path where `ONBOARDING.md` was written
- Tech stack detected
- Count of environment variables documented
- Any gaps found where the guide had to make assumptions (missing README, no test command found, etc.)
