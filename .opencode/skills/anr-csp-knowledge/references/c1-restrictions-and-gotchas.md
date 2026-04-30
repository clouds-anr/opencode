# C1 Restrictions, Gotchas & Lessons Learned

A catalog of real-world restrictions, painful discoveries, and critical lessons from C1 migration experience. Read this before any assessment — these are the things that most often derail or complicate migrations.

---

## CRITICAL: Never-Forget Rules

These are the constraints that, if missed, will block or break a migration. Treat these as hard requirements.

### 1. Port 443 / HTTPS Only — In and Out

**Rule:** C1 only allows port/protocol **443/HTTPS** in and out of VPCs/VNets.

**Impact:**
- Any interface using a non-443 port is a **hard blocker**
- Internal-only services within the same VPC may have more flexibility, but anything crossing VPC/VNet boundaries must use 443/HTTPS
- This applies to **both inbound AND outbound** traffic

**Resolution path:**
- C1 provides **Data Transport tools** (based on Apache NiFi) to help adapt interfaces to 443/HTTPS
- Interfaces must be refactored to use these tools or natively support HTTPS on 443
- Budget significant effort for interface refactoring when many external interfaces exist

**Detection in assessment:**
- Scan for any socket/TCP connections not on port 443
- Look for database drivers using non-443 ports (most do by default)
- Look for message queue consumers/producers (RabbitMQ: 5672, Kafka: 9092, etc.) — these are red flags
- FTP, SFTP, SSH usage in code is a red flag
- Any custom TCP listeners or UDP usage

---

### 2. C1 Is NOT NIPRNet

**Rule:** C1 is deployed in CSP GovClouds, not the Air Force Network (NIPRNet). They are separate environments.

**Impact:**
- Services that live on NIPRNet and are accessed over non-443 ports **cannot be reached from C1**
- If a program has a hard dependency on a NIPRNet service that only exposes non-HTTPS protocols, this is a **migration blocker**
- This is a frequent source of surprise — teams assume government = NIPRNet

**Resolution path:**
- Identify all NIPRNet dependencies early
- Determine if the NIPRNet service can expose a 443/HTTPS endpoint (if yes, proceed)
- If NIPRNet service cannot be adapted, the dependency may block migration or require the service to also migrate to C1

---

### 3. SSO / GCDS (SAML) Integration Required

**Rule:** Applications must integrate with C1's Single Sign-On system (**GCDS**), which uses **SAML authentication**.

**Impact:**
- Any application managing its own authentication or using a non-SAML SSO system will need to be modified
- SAML integration changes affect the application's auth flow — not always trivial
- This is often underestimated in scope estimates

**Resolution path:**
- Identify all authentication mechanisms in the application
- Map each to SAML compatibility
- Plan auth refactoring as a dedicated task in the migration schedule

**Detection in assessment:**
- Look for custom auth middleware, login controllers, JWT/OAuth-only flows
- Check for LDAP/Active Directory direct integrations
- Look for hard-coded auth endpoints

---

### 4. Not All CSP Services Are Available

**Rule:** C1 curates an approved service catalog. Not every native CSP service is available by default.

**Impact:**
- Teams assuming standard CSP services are available may design architectures around services that are not approved in C1
- This forces redesign late in the process

**Resolution path:**
- Verify every planned CSP service against the **C1 Confluence service catalog** before including it in the App Analysis or architecture design
- When in doubt, ask the C1 team directly

---

### 5. Pre-Configured VPC/Subnet — No Customization

**Rule:** C1 deploys pre-configured VPC/subnet settings as part of their guardrails. Programs cannot customize these.

**Impact:**
- Network CIDR ranges, subnet topology, and routing rules are inherited as-is
- Applications with hardcoded IP ranges or unusual subnet assumptions will need adjustments
- Subnet sizing and zone availability may differ from what the program expects

**Resolution path:**
- Do not design IP allocation or subnet topology until C1 accounts are provisioned and guardrail settings are known
- Treat network topology as a C1-defined constraint, not a program-defined variable

---

## Major Gotchas — Interface Partners

**This is consistently the biggest gotcha teams miss.**

Interface partners = other programs or systems that communicate with the migrating application.

| Problem | Impact | Resolution |
|---------|--------|-----------|
| Partner system uses non-443 port | Cannot communicate through C1 VPC boundary | Refactor using C1 Data Transport (NiFi) |
| Partner system is NIPRNet-only | May be completely unreachable | Identify early; may require partner to also migrate or expose HTTPS endpoint |
| Partner system's C1 migration status unknown | Blocked until partner is also on C1 | Coordinate with partner program; may gate timeline |
| Partner uses UDP (e.g., DNS, NTP) | 443-only policy blocks UDP | Internal C1 DNS/NTP; check C1 provided services |

**Action:** Create a complete interface inventory as early as possible. For each interface:
- What system does it connect to?
- What port and protocol?
- Is that system on NIPRNet or C1?
- Can the port/protocol be changed to 443/HTTPS?

---

## Gotcha: Information Quality From Migrating Programs

**Pain level:** High — consistently the most time-consuming part of the process.

| Symptom | Reality |
|---------|---------|
| "We have architecture diagrams" | Often outdated by 2-5 years |
| "We know our dependencies" | Shadow IT and informal integrations are routinely missed |
| "Our compute needs are X" | Usually underestimated; not broken out by environment |
| "We have documentation" | Documentation exists but is incomplete or no longer matches deployed state |

**Mitigation strategies:**
- Always verify documentation against actual deployed systems
- Conduct Technical Exchange Meetings (TIMs) with program SMEs
- Ask to see actual running configs, not just documentation
- Use infrastructure discovery tools where possible (AWS Config, Azure Resource Graph)
- Treat all estimates as initial guesses until verified

---

## Legacy Technology Concerns

| Technology | Problem | Resolution Path |
|------------|---------|----------------|
| **COBOL / Mainframe** | Not natively supported in C1 CSPs | Full refactor to modern language, OR Mainframe simulator (IMDS precedent) |
| **Legacy Java EE / J2EE** | Old app servers (JBoss 4.x, WebSphere 6.x) may not run in containers | Replatform to modern app server or containerize |
| **On-prem hardware dependencies** | Dongle-based licensing, hardware security modules, etc. | Must find cloud equivalent or architectural workaround |
| **Legacy database versions** | Old Oracle 9i/10g, SQL Server 2000/2005 | Upgrade path required before or during migration |
| **Non-cloud-ready build processes** | Manual deployments, no CI/CD | Build CI/CD pipeline as part of migration |
| **Custom SSL/TLS implementations** | May not align with C1's TLS requirements | Review and align to current TLS standards |

---

## Permission Restrictions by CSP

Each CSP in C1 has restricted IAM permissions. Programs do not have full administrative access.

| CSP | Key Restrictions |
|-----|----------------|
| **AWS GovCloud** | No root account access; SCP policies limit some service creation; restricted IAM role creation |
| **Azure Government** | RBAC is managed through C1; limited subscription-level management |
| **OCI GovCloud** | Compartment structure is defined by C1; limited tenancy administration |

**Impact:** Automation scripts or IaC that assume administrative permissions will fail. Review all Terraform/CloudFormation/ARM templates for permission assumptions.

---

## Cost Estimate Gotchas

| Gotcha | Impact | Mitigation |
|--------|--------|-----------|
| Estimates not broken out per environment | Funding may be wrong | Always estimate Dev, Int, Test, and Prod separately |
| Forgetting data transfer costs | Can be significant at scale | Include egress costs in estimates |
| Underestimating storage growth | Budget shortfall mid-year | Add 20-30% buffer on storage estimates |
| Not accounting for snapshot/backup costs | Adds up quickly | Include backup retention policy costs |
| One-year commitment with no buffer | Underfunds if migration takes longer | Discuss contingency with program finance |

---

## Migration Validation Lessons

- **Internal review before C1 presentation is mandatory.** C1 will find gaps if you haven't reviewed internally first.
- **TIMs save time overall.** The upfront investment in Technical Exchange Meetings prevents rework.
- **Architecture diagrams are the most valuable single input.** If you get nothing else from the program, get current architecture diagrams.
- **Document your assumptions.** Every estimate in the App Analysis should have documented assumptions. C1 may ask.
- **Don't skip the interface audit.** Port 443 violations found late are expensive to fix.
