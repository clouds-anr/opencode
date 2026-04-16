# opencode-agents: CSP Team

Multi-agent AI cloud, SQL, and platform workflows for [opencode](https://github.com/sst/opencode).

## What Is This?

A ready-to-use agent team for **cloud architecture, database platform work, and Oracle-to-PostgreSQL migrations**. Work is delegated to specialized agents—each optimized for their role in the CSP domain.

## The Agents

### Core Agents

| Agent | Role | Key Trait |
|-------|------|-----------|
| **CSP Orchestrator** | Orchestrator | Coordinates, delegates, synthesizes—does not do the work directly |
| **Researcher** | Researcher + Planner | Digs deep into codebases and schemas, creates actionable plans |
| **Implementor CSP** | CSP Implementation Specialist | Ships cloud configs, DB scripts, Azure Bicep/ARM, PostgreSQL procedures |
| **Tester CSP** | Validation Specialist | Validates migrations, schemas, cloud configs, and dry-runs |
| **Senior Cloud Architect** | Architecture Specialist | Designs architecture with Mermaid diagrams and NFR analysis |
| **MS SQL DBA** | SQL Server Specialist | Administers SQL Server, T-SQL, backups, and performance tuning |
| **Oracle→PostgreSQL Expert** | Migration Specialist | Guides Oracle-to-PostgreSQL application migration phases |
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
  CSP Orchestrator ──────────────────────────────────────────┐
    │                                                        │
    ├──→ Researcher (research + plan)                       │
    │         │                                              │
    │         ├──→ Truth-Teller (challenge)                 │ ← optional
    │         ▼                                              │
    ├──→ Senior Cloud Architect (design)                     │
    ├──→ MS SQL DBA / Oracle→Postgres (DB work)              │
    ├──→ Implementor CSP (cloud configs + scripts)           │
    ├──→ Tester CSP (validation + dry-runs)                  │
    └──→ Documentation (diagrams + ADRs) ──→ Done ◄─────────┘
```

**Why this pattern?**

- **Context efficiency** — Orchestrator stays lean, delegating heavy lifting to specialists
- **Separation of concerns** — Architecture design, migration, and implementation are distinct phases
- **Quality gates** — Truth-Teller provides adversarial review for risky migrations
- **Validation gates** — Tester CSP validates before applying irreversible schema changes
- **Documentation gates** — Documentation keeps architecture diagrams and ADRs synchronized
- **Parallel execution** — Independent tasks can run simultaneously

## Truth-Teller Consensus Pattern

For high-stakes decisions (irreversible migrations, major architecture changes), run all three Truth-Teller variants in parallel:

```
CSP Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use Truth-Teller Consensus:**

- **Schema-breaking migrations** — Changes that cannot be rolled back easily
- **Major cloud architecture decisions** — Changing core patterns or service topology
- **Risky refactors** — Changes touching >5 files or critical data paths
- **Breaking ties** — When the team is stuck or going in circles

## Installation

### 1. Install opencode

```bash
curl -fsSL https://opencode.ai/install | bash
```

### 2. Run the installer

```bash
# From the .opencode directory
bash .opencode/csp_team/install.sh
```

The installer copies shared + csp_team agent definitions to `~/.config/opencode/agent/`.

### 3. Configure opencode

```bash
# For CSP-only use
cp .opencode/csp_team/opencode.json.example ~/.config/opencode/opencode.json

# For all teams simultaneously (recommended)
bash .opencode/install_all.sh
# (uses the project-level .opencode/opencode.jsonc — no copy needed)
```

### 4. Copy AGENTS.md to your project

```bash
cp .opencode/csp_team/AGENTS.md /path/to/your/project/
```

Edit `AGENTS.md` to add project-specific context (schemas, services, migration scope).

### 5. Start using agents

```bash
opencode
```

Then talk to the CSP Orchestrator:

```
@csp_orchestrator: Plan the Oracle stored procedure migration for the billing schema
@csp_orchestrator: Design a cloud architecture for the payment processing service
@csp_orchestrator: Review the SQL Server performance issues in the reporting database
```

## Configuration

The `opencode.json.example` file contains the full CSP team agent configuration. Key agents:

```json
{
  "default_agent": "csp_orchestrator",
  "agent": {
    "csp_orchestrator": { ... },
    "researcher": { ... },
    "implementor_csp": { ... },
    "tester_csp": { ... },
    "senior_cloud_architect": { ... },
    "ms_sql_dba": { ... },
    "oracle_to_postgres": { ... },
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
csp_team/
├── agent/
│   ├── csp_orchestrator.md                      # CSP Team Orchestrator
│   ├── implementor_csp.md                       # Cloud + DB Implementor
│   ├── tester_csp.md                            # Migration + Config Validator
│   ├── senior-cloud-architect.md                # Cloud Architecture Specialist
│   ├── ms-sql-dba-agent.md                      # MS SQL Server DBA
│   ├── oracle-to-postgres-migration-expert-agent.md  # Oracle→Postgres Expert
│   └── docs.md                                  # Technical Documentation
├── skills/
│   ├── architecture-blueprint-generator/        # Cloud architecture scaffolding
│   ├── cloud-design-patterns/                   # Azure patterns, reliability, security
│   ├── context-map/                             # Domain context mapping
│   ├── migrating-oracle-to-postgres-stored-procedures/  # Oracle→PG migration guide
│   └── technology-stack-blueprint-generator/    # Technology stack design
├── AGENTS.md             # Template for project-specific context
├── README.md             # This file
├── install.sh            # Installer script
└── opencode.json.example # Example configuration
```

## Skills

### CSP Core Skills

| Skill | Description |
|-------|-------------|
| **architecture-blueprint-generator** | Cloud architecture scaffolding and design |
| **cloud-design-patterns** | Azure patterns: reliability, performance, security, event-driven |
| **context-map** | Domain context mapping for complex systems |
| **migrating-oracle-to-postgres-stored-procedures** | Step-by-step Oracle→PostgreSQL migration guidance |
| **technology-stack-blueprint-generator** | Technology stack selection and design |

### How Skills Work

Agents with `skill: true` in their frontmatter can load skills dynamically. When an agent needs specialized knowledge, they call the Skill tool:

```
Agent: I need to migrate this Oracle stored procedure to PostgreSQL.
[Loads skill: migrating-oracle-to-postgres-stored-procedures]
Agent: Now applying the migration checklist...
```

## Key Principles

1. **Orchestrator delegates everything** — Coordinates but never reads schemas or writes scripts directly
2. **Researcher digs deep, plans lean** — Research flows naturally into actionable migration tasks
3. **Implementor CSP is idempotent by default** — Every script must be safe to re-run
4. **Tester CSP validates before apply** — No irreversible change ships without dry-run validation
5. **Documentation synchronizes understanding** — Architecture diagrams and ADRs must reflect current state
6. **Truth-Teller challenges** — Called for irreversible migrations or >5 table/service changes

## When to Call Truth-Teller

Truth-Teller runs at high temperature (0.8) intentionally. Call him when:

- Irreversible schema changes (column drops, type narrowing)
- Major cloud service topology changes
- Oracle→Postgres migration phases before execution
- The team is stuck on a migration approach
- A plan feels "complete" but something is nagging

Most of what Truth-Teller says is noise, but buried in there is golden insight. Pan for gold.

## License

MIT
