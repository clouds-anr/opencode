# C1 Migration Process — Detailed Reference

Detailed step-by-step guide for migrating a DoD program to Cloud One (C1). Each phase includes decision points, requirements, and practical notes from direct experience.

---

## Phase 0: Pre-Engagement — Know Before You Start

Before any formal C1 engagement begins, the program should establish:

- An understanding of what applications are being migrated
- Whether any applications involve COBOL/Mainframe, Oracle, or heavy Microsoft stack
- A preliminary list of external interface partners (who the system talks to, and on what ports/protocols)
- Whether SSO/authentication changes will be needed (GCDS/SAML)
- A rough sense of compute and storage scale per environment

**Why this matters:** The single hardest part of the C1 process is gathering accurate information from the migrating program. Documentation is frequently outdated or entirely missing. Starting this information-gathering early prevents downstream delays.

---

## Phase 1: Submit C1 Onboarding Form

**Who:** The migrating program office submits the form directly to C1.

**What it captures:**
- Program name, mission, sponsor
- Estimated number of applications
- Rough scale (compute, storage)
- Target CSP preference (if any)
- Point of contact

**Key Notes:**
- This is the formal entry point into the C1 process
- C1 may reach out for clarification before moving forward
- Do not assume approval at this stage — the form initiates the process, not the migration

---

## Phase 2: App Analysis

**Who:** The migrating program (often with contractor support) conducts the App Analysis.

**What it must include:**

| Section | Details |
|---------|---------|
| Application inventory | All apps being migrated, with descriptions |
| Architecture diagrams | Current-state, must be up-to-date |
| Interface map | All external interfaces, ports, protocols, and partner programs |
| Authentication model | Current auth method, SSO readiness |
| Compute estimates | Per environment (Dev, Integration, Test, Prod) — CPU, RAM |
| Storage estimates | Per environment — block, object, database sizes |
| CSP recommendation | Which CSP and rationale |
| Dependency map | Third-party libraries, SaaS, government services |
| C1 Compliance Plan | How known C1 restrictions will be addressed (port 443, GCDS, etc.) |
| Risk assessment | Migration risks and proposed mitigations |

**Inputs that help most:**
- Up-to-date architecture diagrams (most valuable single artifact)
- Current infrastructure inventory
- Interview outputs from program SMEs and system owners

**Validation before submission:**
1. Conduct internal review with technical leads
2. Verify port/protocol inventory (catch non-443 interfaces early)
3. Confirm compute/storage estimates have backing data
4. Consider scheduling a TIM (Technical Exchange Meeting) with the program for gaps

---

## Phase 3: Present App Analysis to C1

**Who:** Program (+ contractor support) presents to the C1 team.

**Format:** Formal presentation — typically slides + supporting documentation.

**What C1 evaluates:**
- Is the App Analysis complete and credible?
- Are the compute/storage estimates realistic?
- Has the program accounted for C1 restrictions?
- Is the migration complexity manageable within C1's support capacity?
- Are there any showstoppers (e.g., Mainframe, NIPRNet-only services)?

**Possible outcomes:**

| Outcome | Next Step |
|---------|-----------|
| **Approved** | Program sends funding to C1 |
| **Conditionally Approved** | Revisions required; re-present |
| **Denied — complexity too high** | C1 not willing to support; program must revise scope or escalate |
| **Denied — missing information** | Return to Phase 2 with corrected App Analysis |

**Practical note:** C1 wants confidence that the migration will succeed. They are protecting their own operational capacity. If the App Analysis is weak, expect denial or requests for significant revision.

---

## Phase 4: Program Sends Funding to C1

**Who:** Program's financial officer / contracting office.

**What is funded:**
- **One full year** of compute and storage costs based on App Analysis estimates
- This is the budget commitment — estimates from the App Analysis directly drive this number

**Risk:** Inaccurate estimates in the App Analysis lead to under- or over-funding. Both are problematic:
- Underfunding → accounts may be constrained mid-migration
- Overfunding → unnecessary obligation of program funds

---

## Phase 5: C1 Provisions CSP Accounts

**Who:** C1 team handles this.

**What gets created:**
- CSP accounts for each environment (typically Dev, Integration, Test, Prod)
- Accounts are linked to C1's management plane for billing, monitoring, and policy enforcement

**Program has no action** until accounts are confirmed provisioned.

---

## Phase 6: C1 Deploys Guardrails

**Who:** C1 team handles this automatically as part of account provisioning.

**What guardrails include:**
- Pre-configured VPC/subnet settings (program cannot customize these)
- Network security groups / security policies
- IAM baseline roles and permission boundaries
- Logging and monitoring hooks (for C1 visibility)
- Service Control Policies (SCPs) limiting which services are available

**Critical note:** The program inherits these guardrails as-is. There is no negotiation on the VPC/subnet layout. This affects network architecture planning significantly.

---

## Phase 7: Program Submits C1 FAMs Access Requests

**Who:** Program team members who need access.

**What FAMs is:** C1's account access management system (Federated Access Management System or similar).

**What to request:**
- Access to each provisioned CSP account (Dev, Int, Test, Prod)
- Appropriate permission levels for each team member's role

**Note:** This step can take time. Begin FAMs requests as soon as accounts are provisioned — waiting delays the start of actual migration work.

---

## Phase 8: Official Migration Begins

**Activities:**
- Deploy infrastructure-as-code into provisioned accounts
- Configure application stacks within C1 guardrails
- Refactor interfaces to use port 443/HTTPS (using C1 Data Transport tools — Apache NiFi based)
- Integrate with GCDS for SSO/SAML authentication
- Stand up environments in sequence (Dev → Integration → Test → Prod)
- Execute data migration (if applicable)

---

## Phase 9: Weekly Calls with C1 Manager

**Frequency:** Weekly throughout the migration

**Agenda typically covers:**
- Migration progress and status against schedule
- Blockers and how C1 can help resolve them
- Upcoming tasks and any anticipated C1 coordination needs
- Issues discovered in guardrail constraints

**Value:** The C1 manager is a direct channel to unblock issues within C1's control. Use these calls proactively, not just reactively.

---

## Common Timeline Notes

- App Analysis preparation: weeks to months, depending on program documentation quality
- C1 review and approval: variable (days to weeks)
- Funding transfer: depends on contracting vehicle (can take weeks)
- Account provisioning: typically a few business days once funding clears
- FAMs access: can take several days per request
- Full migration: highly variable by program complexity (months to over a year)

---

## Information Gathering Tips

The most difficult part of the entire process is getting accurate information from the migrating program.

| Challenge | Mitigation |
|-----------|-----------|
| Outdated documentation | Schedule TIMs with program SMEs to gather ground truth |
| No architecture diagrams | Request whiteboard sessions; document outputs immediately |
| Unknown interface partners | Ask program to enumerate all systems they communicate with and on what ports |
| Missing compute/storage data | Use CSP pricing calculators with conservative estimates; document assumptions |
| Conflicting information | Identify the authoritative system owner and resolve discrepancies before submission |
