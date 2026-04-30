# App Analysis Guide — Cloud One Migration

The App Analysis is the central artifact of the C1 migration onboarding process. C1 uses it to decide whether to approve or deny a migration. This guide covers what must be in it, how to gather the information, and how to validate it before submission.

---

## Purpose of the App Analysis

The App Analysis serves two audiences:

1. **C1** — Evaluates whether the program is ready to migrate and whether C1 can support it
2. **The program** — Forces a thorough understanding of the current system before migration begins

C1 uses the App Analysis to:
- Verify the program understands its own architecture
- Confirm compute/storage estimates are credible (these drive the funding request)
- Identify migration complexity and risks
- Decide whether to approve, conditionally approve, or deny the migration

---

## Required Sections

### 1. Executive Summary

| Field | Description |
|-------|-------------|
| Program name | Official program name and acronym |
| Mission | What the program does and who it serves |
| Migration rationale | Why the program is migrating to C1 |
| Scope | Which applications and systems are in scope |
| Target CSP | Recommended CSP and high-level rationale |
| Overall readiness | Self-assessment of migration readiness |

---

### 2. Application Inventory

For each application in scope:

| Field | Description |
|-------|-------------|
| App name | Canonical name and version |
| Description | What it does, 1-3 sentences |
| Technology stack | Languages, frameworks, databases, middleware |
| Deployment model | VM, container, bare metal, serverless |
| Current hosting | On-prem, existing cloud, legacy data center |
| Migration approach | Lift-and-shift, replatform, refactor, replace |
| Dependencies | Key libraries, services, or systems it depends on |
| Migration complexity | Low / Medium / High with justification |

---

### 3. Architecture Diagrams

**Most valuable artifact. Must be current-state (not aspirational).**

Required diagrams:
- **System context diagram** — the system and all external systems it interacts with
- **Application architecture diagram** — internal components, services, databases
- **Network diagram** — current network topology, ports, protocols, firewall rules
- **Data flow diagram** — how data moves through the system (optional but valuable)

Quality standards:
- Diagrams must reflect the actual deployed system, not documentation from 2 years ago
- Verify against running infrastructure before including
- Label all interfaces with port and protocol

---

### 4. Interface Inventory

**This is the most critical section for C1 compliance.**

For each interface (inbound and outbound):

| Field | Description |
|-------|-------------|
| Interface name | Descriptive name |
| Direction | Inbound / Outbound / Bidirectional |
| Partner system | Name of the other system or service |
| Partner location | NIPRNet / C1 / Internet / SaaS / Other |
| Port | Current port number |
| Protocol | TCP/UDP/HTTP/HTTPS/etc. |
| Data exchanged | Brief description |
| Port 443 compliant? | Yes / No / Needs refactor |
| Refactor plan | If not compliant, how will it be addressed |

**Red flags that require explicit resolution plan:**
- Any interface not on port 443/HTTPS
- Interfaces to NIPRNet services
- Database connections (Oracle: 1521, SQL Server: 1433, PostgreSQL: 5432, etc.)
- Message queue connections (RabbitMQ: 5672, Kafka: 9092, ActiveMQ: 61616)
- FTP (21), SFTP (22), SSH (22)

---

### 5. Authentication & SSO Analysis

| Field | Description |
|-------|-------------|
| Current auth mechanism | What the app uses today (LDAP, custom, OAuth, SAML, etc.) |
| User population | Who accesses the system and how |
| SAML/GCDS ready? | Yes / No / Needs changes |
| Required changes | What needs to be modified for GCDS integration |
| Estimated effort | Small / Medium / Large |

---

### 6. Compute Estimates

Must be broken out **per environment**: Development, Integration, Test, Production.

For each environment:

| Resource | Specification |
|----------|--------------|
| Number of compute instances | Count by type |
| Instance types/sizes | vCPU count, RAM per instance |
| Auto-scaling requirements | Min/max instances, scaling triggers |
| Container requirements | If containerized: number of pods/tasks, resource limits |
| Total estimated vCPU | Sum across all workloads |
| Total estimated RAM (GB) | Sum across all workloads |

**Estimation methodology:**
- Use current monitoring data where available (CPU/RAM utilization over 30-90 days)
- Apply right-sizing: do not over-provision just to be safe — back estimates with data
- Use the target CSP's pricing calculator to validate instance selections
- Add 20-30% buffer for unknowns, but document the buffer explicitly

---

### 7. Storage Estimates

Must be broken out per environment.

| Storage Type | Estimate | Notes |
|-------------|---------|-------|
| Block storage (OS disks) | GB per instance | |
| Application data storage | GB | Database files, app data |
| Object/blob storage | GB | File storage, backups, artifacts |
| Database storage | GB per database | Include transaction logs |
| Backup retention | GB | Based on retention policy |
| Data transfer (monthly) | GB egress | Affects cost estimates significantly |

---

### 8. CSP Recommendation

| Section | Content |
|---------|---------|
| Recommended CSP | AWS / Azure / OCI / GCP and rationale |
| Account structure | Dev / Integration / Test / Prod accounts |
| Region | Target GovCloud region |
| Alternative considered | Other CSP evaluated and why rejected |
| Service list | All CSP services the architecture will use |
| C1 catalog verification | Confirmation each service is in C1's approved catalog |

---

### 9. C1 Compliance Plan

Document how each known C1 constraint will be addressed:

| Constraint | Impact on This Program | Resolution Plan |
|-----------|----------------------|----------------|
| Port 443/HTTPS only | [list affected interfaces] | [refactor plan using C1 Data Transport] |
| GCDS/SAML SSO | [current auth method] | [integration approach] |
| Pre-configured VPC/subnet | [network assumptions] | [what will change] |
| Service catalog limits | [services needed] | [verified in catalog / alternatives] |
| Permission restrictions | [IAM assumptions in IaC] | [permission review plan] |

---

### 10. Risk Assessment

List the top migration risks:

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Interface refactoring scope underestimated | Medium | High | Complete interface inventory; use C1 Data Transport tools |
| Auth changes more complex than estimated | Low | Medium | TIM with auth system owners early |
| CSP service not in C1 catalog | Low | High | Verify catalog before architecture decision |
| Program documentation inaccurate | High | Medium | TIMs, infrastructure discovery, verify against running systems |
| Mainframe/legacy component discovered | Low | Critical | Early discovery; engage C1 for simulator options |

---

### 11. Migration Schedule (High Level)

Provide a phased schedule showing major bodies of work. Do not over-specify — flexibility is important.

| Phase | Description | Duration (Estimate) | Dependencies |
|-------|-------------|---------------------|-------------|
| Phase 0: Pre-Migration Prep | App Analysis, funding, account provisioning | Weeks–Months | C1 approval |
| Phase 1: Foundation | IaC setup, networking, CI/CD pipeline, auth integration | Weeks | Accounts provisioned |
| Phase 2: Dev Environment | Deploy to Dev; validate functionality | Weeks | Phase 1 complete |
| Phase 3: Test Environments | Deploy to Integration and Test | Weeks | Phase 2 stable |
| Phase 4: Production Migration | Production cutover; data migration | Weeks | Phase 3 validated |
| Phase 5: Post-Migration | Monitoring, optimization, handoff | Ongoing | Production live |

---

## Information Gathering Process

### Recommended Sequence

1. **Kick-off with program POC** — Establish scope, collect initial documentation
2. **Architecture diagram review** — Verify diagrams match reality
3. **Interface audit** — Enumerate every integration with port/protocol
4. **Technical Exchange Meeting (TIM)** — Deep dive on gaps with program SMEs
5. **Infrastructure inventory** — Collect actual running resource sizes
6. **Compute/storage sizing** — Use monitoring data; run through CSP pricing calculator
7. **C1 service catalog check** — Verify every planned service is approved
8. **Internal review** — Review draft App Analysis internally before C1 presentation
9. **Address review feedback** — Revise and finalize
10. **C1 Presentation** — Present the completed App Analysis

### Key Questions to Ask the Program

| Category | Questions |
|----------|----------|
| Applications | What applications are being migrated? What are their tech stacks? |
| Interfaces | What external systems does each app communicate with? What port/protocol? |
| Authentication | How do users authenticate? Is SAML/SSO already in use? |
| Data | What databases are in use? What are approximate sizes? How much data changes daily? |
| Infrastructure | What are the current server sizes (CPU, RAM)? How many instances per environment? |
| Dependencies | What services or APIs does the application depend on? Are any NIPRNet-only? |
| Legacy | Are there any Mainframe, COBOL, or very old components? |
| Compliance | Are there any compliance requirements beyond standard C1 (e.g., IL5, IL6)? |
| Contacts | Who owns each system? Who is the authoritative source for each component? |

---

## Validation Before Submission

### Internal Review Checklist

- [ ] All applications in scope are inventoried
- [ ] Architecture diagrams are current (verified against actual deployed state)
- [ ] Interface inventory is complete (all ports/protocols documented)
- [ ] All non-443 interfaces have a documented resolution plan
- [ ] NIPRNet dependencies are identified and addressed
- [ ] GCDS/SAML integration plan is included
- [ ] Compute and storage estimates exist for each environment (Dev, Int, Test, Prod)
- [ ] CSP selection is justified with technology rationale
- [ ] All planned CSP services verified in C1 service catalog
- [ ] Funding estimate is based on full-year costs with documented assumptions
- [ ] Risk register is populated with realistic risks and mitigations
- [ ] High-level migration schedule is included
- [ ] Internal SME review completed

### Common Reasons C1 Rejects or Returns App Analyses

| Reason | Prevention |
|--------|-----------|
| Incomplete interface inventory | Complete the interface audit; every system, every port |
| Unrealistic compute estimates | Back estimates with monitoring data or justified assumptions |
| No plan for non-443 interfaces | Explicitly address each non-compliant interface |
| Missing GCDS integration plan | Include auth section with SAML integration approach |
| Services not verified in C1 catalog | Verify the catalog before assuming availability |
| Migration complexity too high to support | Engage C1 early if complexity is high; don't surprise them at presentation |
| No architecture diagrams | Non-negotiable — current-state diagrams must be included |
