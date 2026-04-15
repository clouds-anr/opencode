# AGENTS.md - Tech Team Multi-Agent Template

> **This is a template AGENTS.md - customize for your project**

## Project Overview

<!-- TODO: Add project-specific content -->
<!-- Describe what your project does, its language/framework, and key features -->

## The Agent System

This project uses the Tech multi-agent system for context-efficient software engineering across any language or framework.

### Agents

#### Core Agents

| Agent | Role | Mode |
|-------|------|------|
| **@tech_orchestrator** | Tech Orchestrator - coordinates, delegates, synthesizes | primary |
| **@researcher** | Researcher + Planner - deep analysis, actionable plans | subagent |
| **@implementor_tech** | Implementor Tech - feature work, refactors, bug fixes across any language | subagent |
| **@tester_tech** | Tester Tech - test design, execution, coverage validation | subagent |
| **@principal_engineer** | Principal Engineer - architecture, GoF patterns, SOLID, technical debt | subagent |
| **@software_engineer** | Software Engineer - autonomous executor with zero-confirmation policy | subagent |
| **@documentation** | Documentation - architecture docs, ADRs, and API docs | subagent |
| **@truth_teller** | Truth-Teller (default) - challenges assumptions | subagent |

#### Truth-Teller Variants

| Agent | Model | Purpose |
|-------|-------|---------|
| **@truth_teller** | Claude Opus | Default truth-teller |
| **@truth_teller_opus** | Claude Opus | Explicit Opus variant |
| **@truth_teller_qwen** | Qwen3 Coder | Code-focused analysis |
| **@truth_teller_grok** | Grok | Alternative perspective |

### Workflow

```
User Request
    │
    ▼
  Tech Orchestrator ──────────────────────────────────────────┐
    │                                                         │
    ├──→ Researcher (research + plan)                        │
    │         │                                               │
    │         ├──→ Truth-Teller (challenge)                  │ ← optional, for complex changes
    │         ▼                                               │
    ├──→ Principal Engineer (architecture review)             │
    ├──→ Implementor Tech (implement)                         │
    ├──→ Tester Tech (tests + coverage)                       │
    └──→ Documentation (ADRs + API docs) ──→ Done ◄──────────┘
```

### When to Use @implementor_tech vs @software_engineer

| Agent | When to Use |
|-------|-------------|
| **@implementor_tech** | Has a Researcher plan; follows spec precisely; reports completion |
| **@software_engineer** | Fully scoped, self-contained tasks; autonomous with zero-confirmation |

### Truth-Teller Consensus Pattern

For high-stakes decisions, run all three Truth-Teller variants in parallel:

```
Tech Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use:**
- Core abstraction changes (modifying foundational interfaces)
- Risky refactors touching >5 files
- New architectural patterns being introduced project-wide
- When the team is stuck on a technical approach

### Key Principles

- **Orchestrator delegates everything** - preserves context
- **Researcher digs deep, plans lean** - research flows into actionable implementation tasks
- **Implementor Tech follows SOLID** - SRP, OCP, LSP, ISP, DIP enforced; no gold-plating
- **Principal Engineer reviews architecture** - consulted for any decision touching >3 modules
- **Tester Tech validates behavior** - tests required before completion on non-trivial changes
- **Documentation synchronizes understanding** - ADRs and API docs updated with every interface change
- **Truth-Teller challenges** - called for complex refactors (>5 files) or core abstraction changes

## Quick Start

<!-- TODO: Add project-specific content -->
<!-- Add setup instructions, build commands, and daily workflow -->

```bash
# Install dependencies
npm install         # or: bun install / pip install -r requirements.txt / go mod download

# Build
npm run build       # or: bun run build / python -m build / go build ./...

# Run tests
npm test            # or: bun test / pytest / go test ./...

# Type check (if applicable)
npm run typecheck   # or: bun run typecheck / mypy . / tsc --noEmit
```

## Tooling Baseline

**CRITICAL:** Keep build and test commands reproducible across local and CI.

```bash
# Full validation sequence
npm run build && npm test && npm run typecheck
```

Use the same commands in CI as locally. No environment-specific flags that can't be reproduced.

## Workflow Rules

<workflow>
### After Code Fixes
When `@implementor_tech` completes a fix for a GitHub issue:
1. **Delegate testing** to `@tester_tech` and confirm pass status
2. **Delegate documentation updates** to `@documentation` for architecture/API behavior changes
3. **Commit** with message format: `fix #<issue_number>: <short description>`
4. **Push** to remote immediately
5. **Close issue** with `gh issue close <number> --reason completed --comment "<summary of fix>"`
6. **Move to next** issue in priority order

### Commit Frequency
- **In branches:** Commit after EVERY meaningful change (don't batch)
- **Small, atomic commits** are preferred over large ones
- **Always push** after committing - don't let commits pile up locally

### Branch Workflow
When working in a feature branch:
1. Commit and push frequently (after each fix/change)
2. When all issues for the branch are complete:
   - Check if other branches exist: `git branch -a`
   - If **no other branches**: prepare PR and merge to main
   - If **other branches exist**: prepare PR but **do NOT merge** - ask user first
3. Always use `gh pr create` with clear summary

### Issue Management
- Close issues **immediately** after fix is verified (tests pass)
- Always include in close comment:
  - What was changed
  - Problems encountered and how they were solved
  - Which file(s) were modified
  - Commit hash if relevant

### Commit Message Format
```
<type> #<issue>: <description>

Types: fix, feat, refactor, docs, test, chore
```

Examples:
- `fix #42: handle null response from API`
- `feat #15: add user authentication`
- `refactor #30: extract validation logic`
</workflow>

## Scripts

<!-- TODO: Add project-specific content -->
<!-- Document your project's scripts and their purposes -->

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile the project |
| `npm test` | Run the test suite |
| `npm run lint` | Run linter |

## Project Structure

<!-- TODO: Add project-specific content -->
<!-- Document your project's directory structure -->

```
your-project/
├── AGENTS.md                 # This file
├── src/                      # Source code
├── tests/                    # Test suite
├── docs/                     # Architecture docs and ADRs
└── README.md
```

## Architecture

<!-- TODO: Add project-specific content -->
<!-- Document key architectural patterns, abstractions, and design decisions -->

## Key Modules

<!-- TODO: Add project-specific content -->

| Module | Purpose |
|--------|---------|
| `src/module` | Description |

## Configuration

<!-- TODO: Add project-specific content -->
<!-- Document configuration files and environment variables -->

## Code Style

- **Language:** <!-- TODO: e.g. TypeScript strict mode / Python 3.11+ / Go 1.22+ -->
- **Principles:** SOLID, DRY, YAGNI, KISS — no gold-plating
- **Testing:** Unit → Integration → E2E pyramid; regression test for every bug fix
- **Naming:** Follow project conventions consistently

<!-- TODO: Add project-specific code style rules if needed -->
