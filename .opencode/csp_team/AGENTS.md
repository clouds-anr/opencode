# AGENTS.md - CSP Team Multi-Agent Template

> **This is a template AGENTS.md - customize for your project**

## Project Overview

<!-- TODO: Add project-specific content -->
<!-- Describe what your project does, its cloud platform, data platform, and migration scope -->

## The Agent System

This project uses the CSP multi-agent system for cloud architecture, database platform work, and Oracle-to-PostgreSQL migrations.

### Agents

#### Core Agents

| Agent | Role | Mode |
|-------|------|------|
| **@csp_orchestrator** | CSP Orchestrator - coordinates, delegates, synthesizes | primary |
| **@researcher** | Researcher + Planner - deep analysis, actionable plans | subagent |
| **@implementor_csp** | Implementor CSP - cloud configs, DB scripts, Azure Bicep/ARM, PostgreSQL | subagent |
| **@tester_csp** | Tester CSP - migration validation, schema testing, dry-runs | subagent |
| **@senior_cloud_architect** | Senior Cloud Architect - architecture design, Mermaid diagrams, NFR analysis | subagent |
| **@ms_sql_dba** | MS SQL DBA - SQL Server administration, T-SQL, performance tuning | subagent |
| **@oracle_to_postgres** | Oracle→PostgreSQL Expert - application migration phases | subagent |
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
  CSP Orchestrator ──────────────────────────────────────────┐
    │                                                        │
    ├──→ Researcher (research + plan)                       │
    │         │                                              │
    │         ├──→ Truth-Teller (challenge)                 │ ← optional, for risky migrations
    │         ▼                                              │
    ├──→ Senior Cloud Architect (design diagrams)            │
    ├──→ MS SQL DBA / Oracle→Postgres (DB work)              │
    ├──→ Implementor CSP (implement)                         │
    ├──→ Tester CSP (validation + dry-runs)                  │
    └──→ Documentation (diagrams + ADRs) ──→ Done ◄─────────┘
```

### Truth-Teller Consensus Pattern

For high-stakes decisions, run all three Truth-Teller variants in parallel:

```
CSP Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use:**
- Irreversible schema changes (drops, type narrowing)
- Major cloud architecture topology changes
- Oracle→Postgres migration phases before execution
- When the team is stuck on a migration approach

### Key Principles

- **Orchestrator delegates everything** - preserves context
- **Researcher digs deep, plans lean** - research flows into actionable migration plans
- **Implementor CSP is idempotent by default** - every script must be safe to re-run
- **Tester CSP validates before apply** - dry-runs and syntax checks before irreversible changes
- **Documentation keeps architecture current** - diagrams and ADRs updated with every change
- **Truth-Teller challenges** - called for irreversible migrations or >5 table/service changes

## Quick Start

<!-- TODO: Add project-specific content -->
<!-- Add setup instructions, connection strings, and daily workflow -->

```bash
# PostgreSQL connection check
psql -h <host> -U <user> -d <database> -c "\conninfo"

# SQL Server connection check (via sqlcmd)
sqlcmd -S <server> -U <user> -Q "SELECT @@VERSION"

# Azure CLI login
az login
az account show
```

## Cloud Platform

<!-- TODO: Add project-specific content -->

```
Cloud Provider: Azure / AWS / GCP
Region(s):
Resource Group(s):
State Backend:
```

## Database Platform

<!-- TODO: Add project-specific content -->

```
Source DB:      Oracle <version> / SQL Server <version>
Target DB:      PostgreSQL <version>
Migration Tool: <tool>
Schema(s):      <list key schemas>
```

## Workflow Rules

<workflow>
### After DB Script or Config Changes
When `@implementor_csp` completes a change:
1. **Delegate validation** to `@tester_csp` and confirm syntax + dry-run pass
2. **Delegate documentation updates** to `@documentation` for architecture/schema changes
3. **Commit** with message format: `fix #<issue_number>: <short description>`
4. **Push** to remote immediately
5. **Close issue** with `gh issue close <number> --reason completed --comment "<summary>"`

### Migration Safety Rules
- Never execute a migration without a dry-run or syntax-check first
- Always document rollback strategy before applying irreversible changes
- Use `CREATE OR REPLACE` for PostgreSQL procedures/functions; never `DROP` without instruction
- For Azure: parameterize everything; never hardcode credentials

### Commit Message Format
```
<type> #<issue>: <description>

Types: fix, feat, refactor, docs, test, chore, migrate
```

Examples:
- `migrate #12: convert billing stored procedures to PostgreSQL`
- `fix #34: resolve type mismatch in customer_id column`
- `feat #56: add Azure Bicep template for API gateway`
</workflow>

## Project Structure

<!-- TODO: Add project-specific content -->

```
your-project/
├── AGENTS.md                       # This file
├── migrations/                     # DB migration scripts
│   ├── oracle/                     # Source Oracle procedures
│   └── postgres/                   # Target PostgreSQL procedures
├── infra/                          # Infrastructure as Code
│   ├── bicep/                      # Azure Bicep templates
│   └── scripts/                    # Deployment scripts
└── docs/                           # Architecture diagrams and ADRs
```

## Architecture

<!-- TODO: Add project-specific content -->
<!-- Document key architectural patterns, service topology, and design decisions -->

## Key Schemas / Services

<!-- TODO: Add project-specific content -->

| Schema / Service | Purpose |
|-----------------|---------|
| `schema_name` | Description |

## Configuration

<!-- TODO: Add project-specific content -->
<!-- Document environment variables, connection parameters, and secrets management -->

## Code Style

- **SQL:** Follow project naming conventions; use snake_case for column/table names
- **Azure Bicep:** Parameterize all environment-specific values
- **PostgreSQL:** Use `CREATE OR REPLACE` for procedures; schema-qualify all objects
- **Naming:** Follow project conventions consistently

<!-- TODO: Add project-specific code style rules if needed -->
