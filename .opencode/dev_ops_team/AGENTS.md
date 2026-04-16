# AGENTS.md - DevOps Team Multi-Agent Template

> **This is a template AGENTS.md - customize for your project**

## Project Overview

<!-- TODO: Add project-specific content -->
<!-- Describe your infrastructure, cloud provider, CI/CD platform, and deployment targets -->

## The Agent System

This project uses the DevOps multi-agent system for infrastructure as code, CI/CD pipelines, and cloud deployments.

### Agents

#### Core Agents

| Agent | Role | Mode |
|-------|------|------|
| **@devops_orchestrator** | DevOps Orchestrator - coordinates, delegates, synthesizes | primary |
| **@researcher** | Researcher + Planner - infra audit, deep analysis, actionable plans | subagent |
| **@implementor_devops** | Implementor DevOps - Terraform HCL, Dockerfiles, GitHub Actions YAML | subagent |
| **@tester_devops** | Tester DevOps - terraform plan, tfsec, checkov, YAML lint | subagent |
| **@devops_expert** | DevOps Expert - infinity loop strategy, CI/CD, observability, SLOs | subagent |
| **@terraform** | Terraform Specialist - HCP Terraform automation via MCP server | subagent |
| **@terraform_reviewer** | Terraform IaC Reviewer - state safety, blast radius, least-privilege IAM | subagent |
| **@documentation** | Documentation - runbooks, architecture diagrams, ADRs | subagent |
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
  DevOps Orchestrator ────────────────────────────────────────┐
    │                                                         │
    ├──→ Researcher (audit + plan)                           │
    │         │                                               │
    │         ├──→ Truth-Teller (challenge)                  │ ← optional, for prod changes
    │         ▼                                               │
    ├──→ DevOps Expert (strategy + process guidance)          │
    ├──→ Terraform Reviewer (IaC safety review)               │
    ├──→ Implementor DevOps (implement)                       │
    ├──→ Tester DevOps (plan + tfsec + checkov + lint)        │
    └──→ Documentation (runbooks + ADRs) ──→ Done ◄──────────┘
```

### Truth-Teller Consensus Pattern

For high-stakes decisions, run all three Truth-Teller variants in parallel:

```
DevOps Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use:**
- Production infrastructure changes with real blast radius
- Terraform state migration or restructuring
- Major CI/CD pipeline redesigns
- New deployment strategy being introduced (blue-green, canary, etc.)

### Key Principles

- **Orchestrator delegates everything** - preserves context
- **Researcher audits before planning** - know current state before proposing changes
- **Implementor DevOps never hardcodes secrets** - environment variables, secret stores, or parameter files only
- **Terraform Reviewer assesses blast radius** - every plan reviewed for state safety and IAM scope
- **Tester DevOps validates before apply** - `terraform plan` + compliance scan required before completion
- **Documentation keeps runbooks current** - updated with every infrastructure change

## Quick Start

<!-- TODO: Add project-specific content -->
<!-- Add environment setup, CLI authentication, and daily workflow commands -->

```bash
# Terraform init + validate
terraform init
terraform validate

# Plan changes
terraform plan -out=tfplan

# Security scan
tfsec .
checkov -d .

# GitHub Actions lint
yamllint .github/workflows/
```

## Infrastructure Baseline

**CRITICAL:** Always clarify state backend, environment scope, and blast radius before changes.

```bash
# State backend
terraform init -backend-config=backend.hcl

# Target environment
terraform workspace list
terraform workspace select <env>

# Plan with explicit target (when scoping blast radius)
terraform plan -target=module.<name>
```

## Cloud Platform

<!-- TODO: Add project-specific content -->

```
Cloud Provider:    AWS / Azure / GCP
Regions:
State Backend:     S3 / Azure Blob / GCS
State Locking:     DynamoDB / Azure Blob Lease / GCS
Environments:      dev / staging / prod
```

## Workflow Rules

<workflow>
### Before Any Terraform Apply
1. **Run `terraform plan`** and review resource additions/changes/destructions
2. **Run tfsec + checkov** and triage HIGH/FAILED findings
3. **Delegate IaC review** to `@terraform_reviewer` for prod changes
4. **Document rollback strategy** before applying
5. **Never apply** without explicit confirmation for resource destructions

### After Infrastructure Changes
When `@implementor_devops` completes a change:
1. **Delegate validation** to `@tester_devops` (plan + scans)
2. **Update runbooks** via `@documentation` for operational changes
3. **Commit** with message format: `fix #<issue_number>: <short description>`
4. **Push** to remote immediately
5. **Close issue** with `gh issue close <number> --reason completed --comment "<summary>"`

### Commit Message Format
```
<type> #<issue>: <description>

Types: fix, feat, refactor, docs, test, chore, infra
```

Examples:
- `infra #23: add WAF rules for API gateway`
- `fix #45: resolve state lock on prod backend`
- `feat #67: add canary deployment stage to pipeline`
</workflow>

## Project Structure

<!-- TODO: Add project-specific content -->

```
your-project/
├── AGENTS.md                    # This file
├── terraform/
│   ├── modules/                 # Reusable Terraform modules
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── prod/
│   └── README.md
├── .github/
│   └── workflows/               # GitHub Actions CI/CD pipelines
├── docker/                      # Dockerfiles and compose files
└── docs/                        # Runbooks, architecture diagrams, ADRs
```

## Architecture

<!-- TODO: Add project-specific content -->
<!-- Document key infrastructure components, service topology, and network design -->

## Key Infrastructure Components

<!-- TODO: Add project-specific content -->

| Component | Purpose |
|-----------|---------|
| `module/network` | Description |
| `module/compute` | Description |

## Configuration

<!-- TODO: Add project-specific content -->
<!-- Document required environment variables, secrets, and credentials management -->

## IaC Style

- **Terraform:** Pin all provider and module versions; use remote backend with locking
- **File organization:** Split by concern: `network.tf`, `compute.tf`, `storage.tf`, `security.tf`
- **IAM:** Least-privilege; never wildcard permissions without explicit justification
- **Secrets:** Never hardcode; use AWS Secrets Manager / Azure Key Vault / GCP Secret Manager
- **Naming:** Follow project conventions consistently across all resources

<!-- TODO: Add project-specific IaC style rules if needed -->
