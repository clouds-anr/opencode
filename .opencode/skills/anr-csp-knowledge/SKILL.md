---
name: anr-csp-knowledge
description: >-
  Domain expertise for migrating DoD/Government programs to Cloud One (C1) and
  GovCloud CSPs (AWS GovCloud, Azure Government, OCI GovCloud, GCP). Use when
  performing any Cloud One migration assessment, App Analysis, CSP selection,
  onboarding planning, or when asked about C1 guardrails, restrictions, costs,
  or migration gotchas. Covers the full C1 onboarding lifecycle from program
  office form submission through live migration.
---

# ANR Cloud One (C1) & CSP Migration Knowledge

Domain expertise for assessing and executing migrations to **Cloud One (C1)** and DoD/Government GovCloud environments. This skill captures real-world process knowledge, gotchas, restrictions, and decision frameworks refined from direct C1 migration experience.

## When to Use This Skill

- Any codebase migration assessment targeting Cloud One or a restricted government platform
- Performing or reviewing an App Analysis for C1 onboarding
- Choosing between AWS GovCloud, Azure Government, OCI GovCloud, or GCP for a C1 program
- Assessing interface/networking requirements under C1 constraints
- Understanding cost estimation across multi-account CSP environments
- Identifying migration blockers specific to C1 (SSO/GCDS, port 443-only, COBOL/Mainframe, legacy tech)

---

## Platform Overview

| Platform | Description |
|----------|-------------|
| **Cloud One (C1)** | DoD-managed cloud broker platform providing vetted GovCloud accounts with pre-configured guardrails. Programs migrate through C1 rather than procuring CSP accounts directly. |
| **AWS GovCloud** | Default and most-supported CSP within C1. Broadest service catalog. |
| **Azure Government** | Preferred when the program is Microsoft-stack heavy (Windows Server, SQL Server, .NET). C1/Microsoft support is weaker than AWS. |
| **OCI GovCloud** | Preferred when the program is Oracle-heavy (Oracle DB, Oracle Linux, Oracle E-Business Suite, Oracle ERP). C1/Oracle support is relatively good but behind AWS. |
| **GCP** | Consider for big-data-intensive workloads. C1 support is the least mature of the four. |

---

## Standard C1 Migration Process

For the full detailed process with decision points, see [c1-migration-process.md](references/c1-migration-process.md).

### High-Level Sequence

```
1. Program Office → Submit C1 Onboarding Form
2. Conduct App Analysis (internal + SME review)
3. Present App Analysis to C1
4. C1 Approves or Denies
   ├─ Denied → revise or escalate
   └─ Approved → Program sends funding to C1
5. C1 provisions CSP accounts
6. C1 deploys guardrails (VPC/subnet, policies, etc.)
7. Program submits C1 FAMs access requests
8. Official migration begins
9. Weekly status calls with C1 manager (ongoing)
```

### Key Rules Governing the Process

- C1 must approve the migration before any accounts are provisioned
- Funding sent to C1 = **one full year** of compute + storage costs based on App Analysis estimates
- App Analysis estimates directly determine the budget — accuracy matters enormously
- If complexity is too high, C1 may reject the migration entirely

---

## CSP Selection

For a full decision matrix with tradeoffs, see [csp-selection-guide.md](references/csp-selection-guide.md).

### Quick Decision Guide

| Scenario | Target CSP |
|----------|-----------|
| Default / no strong preference | **AWS GovCloud** |
| Microsoft stack (Windows Server, SQL Server, .NET, Azure AD) | **Azure Government** |
| Oracle stack (Oracle DB, OL, E-Business Suite, ERP) | **OCI GovCloud** |
| Big data / analytics heavy | **GCP** (limited C1 support) |
| COBOL / Mainframe | Needs full refactor or Mainframe simulator — consult C1 |

---

## C1 Restrictions & Gotchas

For the full catalog of restrictions, painful lessons, and never-forget details, see [c1-restrictions-and-gotchas.md](references/c1-restrictions-and-gotchas.md).

### Critical Constraints (Never Forget)

1. **Port 443/HTTPS only** — C1 only allows port/protocol 443/HTTPS in and out of VPCs/VNets. Any interface using another port is a hard blocker.
2. **C1 is NOT NIPRNet** — C1 is deployed in CSP GovClouds, not the Air Force Network. Services requiring NIPRNet connectivity over non-443 ports will not work.
3. **Not all CSP services are available** — C1 maintains a catalog of allowed services on their Confluence site. Verify availability before assuming a service can be used.
4. **Pre-configured VPC/subnet settings** — Programs cannot customize these; they inherit C1's guardrails as-is.
5. **SSO/GCDS required** — Applications must integrate with C1's SSO (GCDS), which uses SAML authentication. Apps managing their own auth will need changes.
6. **Interface partners are the biggest gotcha** — Program-to-program communication across C1 boundaries is heavily restricted.

---

## App Analysis

For detailed guidance on what the App Analysis must contain and how to validate it, see [app-analysis-guide.md](references/app-analysis-guide.md).

### What C1 Is Looking For

C1 uses the App Analysis to verify the program has:
- A realistic understanding of their own architecture
- Accurate compute and storage estimates per environment (Dev, Integration, Test, Prod)
- A plan to handle C1 restrictions (port 443, SSO/GCDS, VPC constraints)
- Evidence that the migration will succeed without requiring exceptional C1 support

### Validation Before Submission

- Conduct internal review before presenting to C1
- Consider Technical Exchange Meetings (TIMs) to gather details from the migrating program
- Up-to-date architecture diagrams are the single most valuable input
- Documentation backing up data points in the App Analysis is essential

---

## Migration Assessment Scoring Adjustments for C1

When assessing a codebase for C1 migration, apply these additional lenses on top of standard cloud readiness criteria:

| Dimension | What to Look For | C1-Specific Risk |
|-----------|-----------------|-----------------|
| **Interface Protocols** | Any non-443/HTTPS interfaces | HIGH — hard blocker |
| **Authentication** | Custom auth, non-SAML SSO | HIGH — GCDS integration required |
| **CSP Service Dependencies** | Services not in C1 catalog | HIGH — verify availability |
| **Mainframe/COBOL** | Legacy COBOL or Mainframe workloads | CRITICAL — likely full refactor |
| **NIPRNet Dependencies** | Services requiring NIPRNet over non-443 | HIGH — C1 cannot support |
| **Documentation Quality** | Missing/outdated arch diagrams | MEDIUM — blocks App Analysis accuracy |
| **Compute/Storage Estimates** | Lack of sizing data per environment | MEDIUM — affects funding accuracy |
| **Microsoft Stack** | Windows Server, SQL Server, .NET | LOW-MEDIUM — steer toward Azure |
| **Oracle Stack** | Oracle DB, OL, EBS, ERP | LOW-MEDIUM — steer toward OCI |

---

## AI Agent Role Breakdown for C1 Migrations

Based on domain experience, these specialist agent roles add the most value:

| Agent Role | Responsibility |
|-----------|---------------|
| **Requirements Gatherer** | Defines the exact questions needed for a complete App Analysis. Identifies gaps in program documentation. |
| **Compute/Storage Estimator** | Produces per-environment (Dev/Int/Test/Prod) cost estimates using CSP pricing calculators (e.g., AWS Pricing Calculator). |
| **Migration Scheduler** | Produces a high-level migration schedule with key bodies of work and timeline/dependency mapping. Not too granular — flexibility is needed. |
| **Researcher / App Analyst** | Investigates the current system, maps architecture, and assembles the App Analysis content. |
| **C1 Compliance Reviewer** | Validates the assessment against C1 restrictions (port 443, GCDS, service catalog, VPC constraints). |

---

## References

### Core Process & Decision Files
- [c1-migration-process.md](references/c1-migration-process.md) — Full step-by-step C1 onboarding and migration process
- [csp-selection-guide.md](references/csp-selection-guide.md) — CSP selection decision matrix with tradeoffs
- [c1-restrictions-and-gotchas.md](references/c1-restrictions-and-gotchas.md) — Full catalog of C1 restrictions, gotchas, and lessons learned
- [app-analysis-guide.md](references/app-analysis-guide.md) — App Analysis content requirements and validation process

### Official C1 Templates & Checklists
- [CCE App Analysis Checklist_v2.csv](references/CCE%20App%20Analysis%20Checklist_v2.csv) — Item-by-item App Analysis review checklist with slide references and go/no-go criteria (45 items). Use this to validate any App Analysis before C1 submission.
- [CloudOne_DetailedSchedule_Template_Master_v1.0.csv](references/CloudOne_DetailedSchedule_Template_Master_v1.0.csv) — Sprint-based migration schedule template with CDRL deliverable list, interface inventory schema, and role hour breakdowns across sprint phases.
- [A004_CloudOne_Configuration Management Plan_TEMPLATE_v1_4_1.md](references/A004_CloudOne_Configuration%20Management%20Plan_TEMPLATE_v1_4_1.md) — CDRL A004 Configuration Management Plan template. Required deliverable covering version storage, artifact delivery to Artifactory, baseline capture, and auditing.
- [A038_CloudOne_Test Script_TEMPLATE_v1_6_1.md](references/A038_CloudOne_Test%20Script_TEMPLATE_v1_6_1.md) — CDRL A037/A038 Test Script template. Defines all required test types (Functional, Regression, Performance, UAT, Smoke, Security, Environment, HA), STIG scan requirements, C1 dependent services (GCDS, ESB, Artifactory, Jenkins, etc.), and test case structure.

> **Note on Reference File Formats:** Only text-readable formats (`.md`, `.txt`, `.json`, `.yaml`, `.csv`) can serve as agent reference files. Binary formats like `.xlsx`, `.pptx`, and `.docx` cannot be read by agents and must be converted to markdown or CSV first.
