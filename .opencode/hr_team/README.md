# opencode-agents: HR Team

Multi-agent AI governance, compliance, triage, and localization workflows for [opencode](https://github.com/sst/opencode).

## What Is This?

A ready-to-use agent team for **AI governance, safety controls, GitHub issue triage, process compliance, and content localization**. Work is delegated to specialized agents—each optimized for their role in the HR/governance domain.

## The Agents

### Core Agents

| Agent | Role | Key Trait |
|-------|------|-----------|
| **HR Orchestrator** | Orchestrator | Coordinates, delegates, synthesizes—does not do the work directly |
| **Researcher** | Researcher + Planner | Audits governance gaps, creates actionable remediation plans |
| **Implementor HR** | Governance Implementation Specialist | Implements policies, audit logging, safety controls, fail-closed patterns |
| **Reviewer HR** | Governance Validation Specialist | Validates governance completeness, AI safety, and audit trail correctness |
| **Governance Reviewer** | AI Safety Analyst | Reviews code for missing safety issues, hardcoded credentials, weak trust boundaries |
| **Translator** | Localization Specialist | Translates content while preserving Markdown structure and technical terms |
| **Triage** | Issue Triage Agent | Applies GitHub labels and assigns issue owners per deterministic rules |
| **Duplicate PR** | PR Hygiene Agent | Detects duplicate open pull requests |
| **Documentation** | Documentation Specialist | Maintains ADRs, governance docs, and policy docs |
| **Truth-Teller** | Truth-Teller (default) | Challenges assumptions, finds blind spots (called for risky policy changes) |

### Truth-Teller Variants

| Agent | Model | Use Case |
|-------|-------|----------|
| **truth_teller** | Claude Opus | Default truth-teller |
| **truth_teller_opus** | Claude Opus | Explicit Opus variant |
| **truth_teller_qwen** | Qwen3 Coder | Code-focused analysis |
| **truth_teller_grok** | Grok | Alternative perspective |

### The Orchestrator Pattern

```
User Request
    │
    ▼
  HR Orchestrator ────────────────────────────────────────────┐
    │                                                         │
    ├──→ Researcher (audit + plan)                           │
    │         │                                               │
    │         ├──→ Truth-Teller (challenge)                  │ ← optional
    │         ▼                                               │
    ├──→ Governance Reviewer (safety analysis)                │
    ├──→ Implementor HR (policies + audit logging)            │
    ├──→ Reviewer HR (completeness validation)                │
    ├──→ Translator / Triage / Duplicate PR (as needed)       │
    └──→ Documentation (ADRs + policy docs) ──→ Done ◄───────┘
```

**Why this pattern?**

- **Context efficiency** — Orchestrator stays lean, delegating heavy lifting to specialists
- **Separation of concerns** — Governance analysis, implementation, and validation are distinct phases
- **Safety gates** — Reviewer HR validates that no controls are missing before completion
- **Never weakens existing controls** — Implementation rules enforce fail-closed discipline

## Truth-Teller Consensus Pattern

For high-stakes policy decisions, run all three Truth-Teller variants in parallel:

```
HR Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use Truth-Teller Consensus:**

- **Security policy changes** — Anything touching authentication, authorization, or audit infrastructure
- **Agent trust boundary redesigns** — Changing how agents communicate or what they trust
- **Compliance scope expansions** — New regulatory requirements being applied
- **Breaking ties** — When the team disagrees on governance approach

## Installation

### 1. Install opencode

```bash
curl -fsSL https://opencode.ai/install | bash
```

### 2. Run the installer

```bash
bash .opencode/hr_team/install.sh
```

The installer copies shared + hr_team agent definitions to `~/.config/opencode/agent/`.

### 3. Configure opencode

```bash
# For HR-only use
cp .opencode/hr_team/opencode.json.example ~/.config/opencode/opencode.json

# For all teams simultaneously (recommended)
bash .opencode/install_all.sh
```

### 4. Copy AGENTS.md to your project

```bash
cp .opencode/hr_team/AGENTS.md /path/to/your/project/
```

Edit `AGENTS.md` to add project-specific context (governance framework, triage rules, target locales).

### 5. Start using agents

```bash
opencode
```

Then talk to the HR Orchestrator:

```
@hr_orchestrator: Audit this agent codebase for missing governance controls
@hr_orchestrator: Triage the open issues and apply labels
@hr_orchestrator: Translate the README to French (fr-FR)
```

## Configuration

The `opencode.json.example` file contains the full HR team agent configuration. Key agents:

```json
{
  "default_agent": "hr_orchestrator",
  "agent": {
    "hr_orchestrator": { ... },
    "researcher": { ... },
    "implementor_hr": { ... },
    "reviewer_hr": { ... },
    "governance_reviewer": { ... },
    "translator": { ... },
    "triage": { ... },
    "duplicate_pr": { ... },
    "documentation": { ... },
    "truth_teller": { "model": "zen/claude-opus-4-5", ... },
    "truth_teller_opus": { "model": "zen/claude-opus-4-5", ... },
    "truth_teller_qwen": { "model": "zen/qwen3-coder-480b", ... },
    "truth_teller_grok": { "model": "zen/grok-3", ... }
  }
}
```

## File Structure

```
hr_team/
├── agent/
│   ├── hr_orchestrator.md        # HR Team Orchestrator
│   ├── implementor_hr.md         # Governance + Policy Implementor
│   ├── reviewer_hr.md            # Governance Completeness Validator
│   ├── governance-reviewer.md    # AI Safety Analyst
│   ├── translator.md             # Localization Specialist
│   ├── triage.md                 # Issue Triage Agent
│   └── duplicate-pr.md           # Duplicate PR Detector
├── skills/
│   ├── governance/               # AI governance policy patterns and safety controls
│   └── judgment-evaluation/      # Evaluating AI agent decision quality
├── AGENTS.md             # Template for project-specific context
├── README.md             # This file
├── install.sh            # Installer script
└── opencode.json.example # Example configuration
```

## Skills

### HR Core Skills

| Skill | Description |
|-------|-------------|
| **governance** | AI governance policy patterns, `@govern` decorator, audit trails, trust scoring |
| **judgment-evaluation** | Evaluating AI agent decision quality and behavioral consistency |

### How Skills Work

Agents with `skill: true` in their frontmatter can load skills dynamically:

```
Agent: I need to implement governance controls for this agent.
[Loads skill: governance]
Agent: Now applying the governance checklist...
```

## Key Principles

1. **Orchestrator delegates everything** — Coordinates but never writes policy code directly
2. **Researcher audits before planning** — Understand the governance gaps before proposing fixes
3. **Implementor HR never weakens existing controls** — Fail-closed by default; explicit allowlists only
4. **Reviewer HR validates completeness** — Every governance implementation must pass the safety checklist
5. **Documentation keeps policy docs current** — ADRs and governance docs updated with every policy change
6. **Truth-Teller challenges** — Called for any policy change that is hard to reverse or affects security

## When to Call Truth-Teller

Truth-Teller runs at high temperature (0.8) intentionally. Call him when:

- A governance policy is being relaxed or removed
- Multi-agent trust boundaries are being changed
- Audit logging infrastructure is being redesigned
- The team debates fail-closed vs fail-open too long
- A compliance framework is being applied for the first time

Most of what Truth-Teller says is noise, but buried in there is golden insight. Pan for gold.

## License

MIT
