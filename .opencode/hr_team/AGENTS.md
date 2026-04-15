# AGENTS.md - HR Team Multi-Agent Template

> **This is a template AGENTS.md - customize for your project**

## Project Overview

<!-- TODO: Add project-specific content -->
<!-- Describe your project's AI governance scope, compliance framework, and localization targets -->

## The Agent System

This project uses the HR multi-agent system for AI governance, safety controls, compliance review, issue triage, and content localization.

### Agents

#### Core Agents

| Agent | Role | Mode |
|-------|------|------|
| **@hr_orchestrator** | HR Orchestrator - coordinates, delegates, synthesizes | primary |
| **@researcher** | Researcher + Planner - governance audits, deep analysis, actionable plans | subagent |
| **@implementor_hr** | Implementor HR - governance policies, audit logging, safety controls | subagent |
| **@reviewer_hr** | Reviewer HR - validates governance completeness and AI safety controls | subagent |
| **@governance_reviewer** | Governance Reviewer - reviews code for missing safety and governance controls | subagent |
| **@translator** | Translator - translates content while preserving technical terms | subagent |
| **@triage** | Triage Agent - GitHub issue triage, labels and owner assignment | primary/hidden |
| **@duplicate_pr** | Duplicate PR Detector - searches for duplicate open PRs | primary/hidden |
| **@documentation** | Documentation - ADRs, governance docs, and policy docs | subagent |
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
  HR Orchestrator ────────────────────────────────────────────┐
    │                                                         │
    ├──→ Researcher (audit + plan)                           │
    │         │                                               │
    │         ├──→ Truth-Teller (challenge)                  │ ← optional, for policy changes
    │         ▼                                               │
    ├──→ Governance Reviewer (safety analysis)                │
    ├──→ Implementor HR (implement policies + controls)       │
    ├──→ Reviewer HR (completeness validation)                │
    ├──→ Translator / Triage / Duplicate PR (as needed)       │
    └──→ Documentation (ADRs + policy docs) ──→ Done ◄───────┘
```

### Truth-Teller Consensus Pattern

For high-stakes decisions, run all three Truth-Teller variants in parallel:

```
HR Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use:**
- Security policy changes or relaxations
- Multi-agent trust boundary redesigns
- Compliance scope expansions (new regulatory requirements)
- When the team disagrees on governance approach

### Key Principles

- **Orchestrator delegates everything** - preserves context
- **Researcher audits before planning** - understand governance gaps before proposing fixes
- **Implementor HR never weakens existing controls** - fail-closed by default; explicit allowlists only
- **Reviewer HR validates completeness** - every governance implementation must pass the safety checklist
- **Documentation keeps policy docs current** - ADRs and governance docs updated with every policy change
- **Truth-Teller challenges** - called for any policy change that is hard to reverse or affects security

## Quick Start

<!-- TODO: Add project-specific content -->
<!-- Add setup instructions, issue triage commands, and translation targets -->

```bash
# GitHub issue triage
gh issue list --state open

# Check for duplicate PRs
gh pr list --state open

# Translation target locales (customize as needed)
# fr-FR, de-DE, ja-JP, zh-CN, es-ES, pt-BR, ko-KR
```

## Governance Framework

<!-- TODO: Add project-specific content -->

```
Compliance Standards:   SOC 2 / ISO 27001 / GDPR / HIPAA (select applicable)
AI Safety Framework:    <framework>
Audit Log Storage:      <location>
Policy Config Format:   YAML / JSON
```

## Issue Triage Rules

<!-- TODO: Add project-specific content -->
<!-- Document your project's label taxonomy and owner assignment rules -->

| Label | Criteria | Owner |
|-------|----------|-------|
| `bug` | Unexpected behavior | Auto-assigned |
| `security` | Security vulnerability | Security team |
| `docs` | Documentation needed | Docs team |

## Translation Targets

<!-- TODO: Add project-specific content -->
<!-- Document supported locales and glossary locations -->

| Locale | Language | Glossary |
|--------|----------|---------|
| `fr-FR` | French | `.opencode/glossary/fr-FR.md` |
| `de-DE` | German | `.opencode/glossary/de-DE.md` |

## Workflow Rules

<workflow>
### After Governance Implementation
When `@implementor_hr` completes a governance change:
1. **Delegate review** to `@reviewer_hr` — confirm all safety controls present
2. **Delegate documentation updates** to `@documentation` for policy/ADR changes
3. **Commit** with message format: `fix #<issue_number>: <short description>`
4. **Push** to remote immediately
5. **Close issue** with `gh issue close <number> --reason completed --comment "<summary>"`

### Governance Safety Rules
- Never remove or weaken existing security controls
- All governance policies must include audit logging (append-only)
- Default behavior must be deny (fail-closed)
- Trust scores must decay; never assume permanent trust
- Use config-driven policies (YAML/JSON) over hardcoded logic

### Translation Rules
- Always preserve: Markdown/MDX structure, code blocks, URLs, technical terms
- Apply locale glossary if present at `.opencode/glossary/<locale>.md`
- Output only the translation — no commentary

### Commit Message Format
```
<type> #<issue>: <description>

Types: fix, feat, refactor, docs, test, chore, governance
```

Examples:
- `governance #12: add @govern decorator to agent action paths`
- `fix #34: resolve missing audit log in trust scoring`
- `docs #56: translate README to fr-FR`
</workflow>

## Project Structure

<!-- TODO: Add project-specific content -->

```
your-project/
├── AGENTS.md                    # This file
├── governance/
│   ├── policies/                # Governance policy definitions (YAML/JSON)
│   ├── audit/                   # Audit log infrastructure
│   └── trust/                   # Trust scoring and decay models
├── .github/
│   └── oracle-to-postgres-migration/  # Migration artifacts (if applicable)
└── docs/                        # ADRs and governance documentation
```

## Architecture

<!-- TODO: Add project-specific content -->
<!-- Document AI agent topology, trust boundaries, and governance scope -->

## Key Governance Components

<!-- TODO: Add project-specific content -->

| Component | Purpose |
|-----------|---------|
| `GovernancePolicy` | Policy definition dataclass |
| `@govern(policy)` | Agent action governance decorator |
| `AuditTrail` | Append-only audit log |

## Configuration

<!-- TODO: Add project-specific content -->
<!-- Document governance configuration files and environment variables -->

## Code Style

- **Governance:** Prefer explicit allowlists; fail-closed by default
- **Audit Logs:** Append-only; never mutate; include timestamp, agent_id, action, decision
- **Trust:** Decay functions required; no permanent trust grants
- **Naming:** Follow project conventions consistently

<!-- TODO: Add project-specific governance style rules if needed -->
