# opencode-agents: DevOps Team

Multi-agent AI infrastructure, CI/CD, and deployment workflows for [opencode](https://github.com/sst/opencode).

## What Is This?

A ready-to-use agent team for **infrastructure as code, CI/CD pipelines, cloud deployments, and platform operations**. Work is delegated to specialized agents—each optimized for their role in the DevOps domain.

## The Agents

### Core Agents

| Agent | Role | Key Trait |
|-------|------|-----------|
| **DevOps Orchestrator** | Orchestrator | Coordinates, delegates, synthesizes—does not do the work directly |
| **Researcher** | Researcher + Planner | Audits existing infra, analyzes pipelines, creates actionable plans |
| **Implementor DevOps** | IaC Implementation Specialist | Ships Terraform HCL, Dockerfiles, GitHub Actions YAML, shell scripts |
| **Tester DevOps** | Validation Specialist | Runs terraform plan, tfsec, checkov, YAML lint before apply |
| **DevOps Expert** | Strategy Specialist | Guides the full DevOps infinity loop: Plan→Code→Build→Test→Release→Deploy→Operate→Monitor |
| **Terraform Specialist** | Terraform Automation | HCP Terraform automation via MCP server, provider/module resolution |
| **Terraform IaC Reviewer** | IaC Safety Reviewer | State safety, blast radius, least-privilege IAM, rollback strategy |
| **Documentation** | Documentation Specialist | Maintains runbooks, architecture diagrams, and ADRs |
| **Truth-Teller** | Truth-Teller (default) | Challenges assumptions, finds blind spots (called for risky deployments) |

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
  DevOps Orchestrator ────────────────────────────────────────┐
    │                                                         │
    ├──→ Researcher (audit + plan)                           │
    │         │                                               │
    │         ├──→ Truth-Teller (challenge)                  │ ← optional
    │         ▼                                               │
    ├──→ DevOps Expert (strategy + process)                   │
    ├──→ Terraform Reviewer (IaC safety review)               │
    ├──→ Implementor DevOps (HCL + pipelines + Dockerfiles)   │
    ├──→ Tester DevOps (plan + tfsec + checkov + lint)        │
    └──→ Documentation (runbooks + ADRs) ──→ Done ◄──────────┘
```

**Why this pattern?**

- **Context efficiency** — Orchestrator stays lean, delegating heavy lifting to specialists
- **Safety gates** — Terraform Reviewer assesses blast radius before any apply
- **Validation gates** — Tester DevOps runs plan + compliance scans before completion
- **Parallel execution** — Independent tasks (e.g. audit + strategy review) can run simultaneously

## Truth-Teller Consensus Pattern

For production infrastructure changes, run all three Truth-Teller variants in parallel:

```
DevOps Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use Truth-Teller Consensus:**

- **Production infrastructure changes** — Changes with real blast radius
- **State migration** — Moving or restructuring Terraform state
- **Major CI/CD redesigns** — Changing the pipeline structure or deployment strategy
- **Breaking ties** — When the team is stuck on an infrastructure approach

## Installation

### 1. Install opencode

```bash
curl -fsSL https://opencode.ai/install | bash
```

### 2. Run the installer

```bash
bash .opencode/dev_ops_team/install.sh
```

The installer copies shared + dev_ops_team agent definitions to `~/.config/opencode/agent/`.

### 3. Configure opencode

```bash
# For DevOps-only use
cp .opencode/dev_ops_team/opencode.json.example ~/.config/opencode/opencode.json

# For all teams simultaneously (recommended)
bash .opencode/install_all.sh
```

### 4. Copy AGENTS.md to your project

```bash
cp .opencode/dev_ops_team/AGENTS.md /path/to/your/project/
```

Edit `AGENTS.md` to add project-specific context (cloud provider, state backend, environments).

### 5. Start using agents

```bash
opencode
```

Then talk to the DevOps Orchestrator:

```
@devops_orchestrator: Review this Terraform module for security issues
@devops_orchestrator: Set up a blue-green deployment pipeline for the API service
@devops_orchestrator: Plan the migration of our infra state to a new backend
```

## Configuration

The `opencode.json.example` file contains the full DevOps team agent configuration. Key agents:

```json
{
  "default_agent": "devops_orchestrator",
  "agent": {
    "devops_orchestrator": { ... },
    "researcher": { ... },
    "implementor_devops": { ... },
    "tester_devops": { ... },
    "devops_expert": { ... },
    "terraform": { ... },
    "terraform_reviewer": { ... },
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
dev_ops_team/
├── agent/
│   ├── devops_orchestrator.md    # DevOps Team Orchestrator
│   ├── implementor_devops.md     # IaC + Pipeline Implementor
│   ├── tester_devops.md          # Plan + Compliance Validator
│   ├── devops-expert.md          # DevOps Infinity Loop Specialist
│   ├── terraform.md              # Terraform + HCP Automation
│   └── terraform-iac-reviewer.md # IaC Safety Reviewer
├── skills/
│   ├── devops-rollout-plan/      # Staged rollout planning for infra changes
│   └── import-infrastructure-as-code/  # Importing existing resources into Terraform
├── AGENTS.md             # Template for project-specific context
├── README.md             # This file
├── install.sh            # Installer script
└── opencode.json.example # Example configuration
```

## Skills

### DevOps Core Skills

| Skill | Description |
|-------|-------------|
| **devops-rollout-plan** | Staged rollout planning for infrastructure and application changes |
| **import-infrastructure-as-code** | Importing existing cloud resources into Terraform state |

### How Skills Work

Agents with `skill: true` in their frontmatter can load skills dynamically:

```
Agent: I need to plan a safe staged rollout for this change.
[Loads skill: devops-rollout-plan]
Agent: Now applying the rollout checklist...
```

## Key Principles

1. **Orchestrator delegates everything** — Coordinates but never writes HCL or pipeline YAML directly
2. **Researcher audits before planning** — Know the current state before proposing changes
3. **Implementor DevOps never hardcodes secrets** — Environment variables, secret stores, or parameter files only
4. **Terraform Reviewer assesses blast radius** — Every plan reviewed for state safety and IAM scope
5. **Tester DevOps validates before apply** — `terraform plan` + compliance scan required before completion
6. **Documentation keeps runbooks current** — Runbooks and ADRs updated with every infrastructure change

## When to Call Truth-Teller

Truth-Teller runs at high temperature (0.8) intentionally. Call him when:

- Production changes with non-trivial blast radius
- State migrations that can't be easily rolled back
- New deployment strategies being introduced
- The team debates blue-green vs canary vs rolling too long
- A "simple" change is touching more resources than expected

Most of what Truth-Teller says is noise, but buried in there is golden insight. Pan for gold.

## License

MIT
