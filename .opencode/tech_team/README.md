# opencode-agents: Tech Team

Multi-agent AI software engineering workflows for [opencode](https://github.com/sst/opencode).

## What Is This?

A ready-to-use agent team for **general software engineering across any language or framework**. Work is delegated to specialized agents—each optimized for their role in technical implementation, architecture guidance, and quality validation.

## The Agents

### Core Agents

| Agent | Role | Key Trait |
|-------|------|-----------|
| **Tech Orchestrator** | Orchestrator | Coordinates, delegates, synthesizes—does not do the work directly |
| **Researcher** | Researcher + Planner | Digs deep into codebases, creates actionable implementation plans |
| **Implementor Tech** | Implementation Specialist | Ships clean, correct software across any language following a plan precisely |
| **Tester Tech** | Testing Specialist | Validates behavior with tests across any stack; language-adaptive tooling |
| **Principal Engineer** | Architecture & Design Specialist | GoF patterns, SOLID, technical debt review, engineering excellence |
| **Software Engineer** | Autonomous Executor | Zero-confirmation policy; fully autonomous for clearly scoped tasks |
| **Documentation** | Documentation Specialist | Maintains architecture docs, ADRs, and API docs |
| **Truth-Teller** | Truth-Teller (default) | Challenges assumptions, finds blind spots (called for risky changes) |

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
  Tech Orchestrator ──────────────────────────────────────────┐
    │                                                         │
    ├──→ Researcher (research + plan)                        │
    │         │                                               │
    │         ├──→ Truth-Teller (challenge)                  │ ← optional
    │         ▼                                               │
    ├──→ Principal Engineer (architecture review)             │
    ├──→ Implementor Tech (code changes)                      │
    ├──→ Tester Tech (tests + coverage)                       │
    └──→ Documentation (ADRs + API docs) ──→ Done ◄──────────┘
```

### When to Use Implementor Tech vs Software Engineer

| Agent | When to Use |
|-------|-------------|
| **@implementor_tech** | Has a Researcher plan; follows spec precisely; reports completion |
| **@software_engineer** | Fully scoped, self-contained tasks; autonomous with zero-confirmation |

**Why this pattern?**

- **Context efficiency** — Orchestrator stays lean, delegating heavy lifting to specialists
- **Architecture gates** — Principal Engineer reviews design decisions before implementation
- **Quality gates** — Tester Tech validates behavior before completion
- **Documentation gates** — Documentation keeps ADRs and API docs synchronized with implementation

## Truth-Teller Consensus Pattern

For high-stakes decisions, run all three Truth-Teller variants in parallel:

```
Tech Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use Truth-Teller Consensus:**

- **Core abstraction changes** — Modifying foundational interfaces or patterns
- **Risky refactors** — Changes touching >5 files or critical paths
- **New architectural patterns being introduced** — Framework migrations, design pattern adoption
- **Breaking ties** — When the team is stuck on a technical approach

## Installation

### 1. Install opencode

```bash
curl -fsSL https://opencode.ai/install | bash
```

### 2. Run the installer

```bash
bash .opencode/tech_team/install.sh
```

The installer copies shared + tech_team agent definitions to `~/.config/opencode/agent/`.

### 3. Configure opencode

```bash
# For Tech-only use
cp .opencode/tech_team/opencode.json.example ~/.config/opencode/opencode.json

# For all teams simultaneously (recommended)
bash .opencode/install_all.sh
```

### 4. Copy AGENTS.md to your project

```bash
cp .opencode/tech_team/AGENTS.md /path/to/your/project/
```

Edit `AGENTS.md` to add project-specific context (language, framework, build commands, code style).

### 5. Start using agents

```bash
opencode
```

Then talk to the Tech Orchestrator:

```
@tech_orchestrator: Refactor the authentication module to follow SOLID principles
@tech_orchestrator: Add comprehensive test coverage to the payment service
@tech_orchestrator: Review the current API design and suggest improvements
```

## Configuration

The `opencode.json.example` file contains the full Tech team agent configuration. Key agents:

```json
{
  "default_agent": "tech_orchestrator",
  "agent": {
    "tech_orchestrator": { ... },
    "researcher": { ... },
    "implementor_tech": { ... },
    "tester_tech": { ... },
    "principal_engineer": { ... },
    "software_engineer": { ... },
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
tech_team/
├── agent/
│   ├── tech_orchestrator.md           # Tech Team Orchestrator
│   ├── implementor_tech.md            # Language-Agnostic Implementor
│   ├── tester_tech.md                 # Language-Adaptive Tester
│   ├── principal-software-engineer.md # Architecture + Technical Leadership
│   └── software-engineer-agent.md     # Autonomous Executor
├── skills/
│   └── markdown-to-html/              # Markdown→HTML conversion patterns and tooling
├── AGENTS.md             # Template for project-specific context
├── README.md             # This file
├── install.sh            # Installer script
└── opencode.json.example # Example configuration
```

## Skills

### Tech Core Skills

| Skill | Description |
|-------|-------------|
| **markdown-to-html** | Markdown-to-HTML conversion patterns across gomarkdown, Hugo, Jekyll, marked, pandoc |

### Shared Skills (from cpp_team)

The tech team also has access to transferable skills installed from `shared/`:

| Skill | Description |
|-------|-------------|
| **test-driven-development** | TDD workflow for new features |
| **systematic-debugging** | Root-cause analysis for complex bugs |
| **verification-before-completion** | Pre-completion checklist |
| **pr-review** | Pull request review guidelines |
| **git-commit** | Conventional commit message format |

### How Skills Work

Agents with `skill: true` in their frontmatter can load skills dynamically:

```
Agent: I need to write tests for this feature using TDD.
[Loads skill: test-driven-development]
Agent: Now applying the TDD workflow...
```

## Key Principles

1. **Orchestrator delegates everything** — Coordinates but never reads files or writes code directly
2. **Researcher digs deep, plans lean** — Research flows naturally into actionable implementation tasks
3. **Implementor Tech follows SOLID** — SRP, OCP, LSP, ISP, DIP enforced; no gold-plating
4. **Principal Engineer reviews architecture** — Consulted for any decision touching >3 modules
5. **Tester Tech validates behavior** — Tests required before completion on non-trivial changes
6. **Documentation synchronizes understanding** — ADRs and API docs updated with every interface change
7. **Truth-Teller challenges** — Called for complex refactors (>5 files) or core abstraction changes

## When to Call Truth-Teller

Truth-Teller runs at high temperature (0.8) intentionally. Call him when:

- A "clean" refactor is touching more files than expected
- The Principal Engineer and Researcher disagree on the design
- A new pattern is being introduced project-wide
- The team agrees too quickly on an approach (dangerous!)
- A design feels elegant but something is nagging

Most of what Truth-Teller says is noise, but buried in there is golden insight. Pan for gold.

## License

MIT
