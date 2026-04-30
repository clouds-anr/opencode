# CSP Selection Guide — Cloud One Context

Decision framework for selecting the right Cloud Service Provider (CSP) for a program migrating to Cloud One (C1). Based on direct experience with C1 migrations across AWS GovCloud, Azure Government, OCI GovCloud, and GCP.

---

## Quick Decision Matrix

| Condition | Recommended CSP | Confidence |
|-----------|----------------|-----------|
| No strong technology preference | **AWS GovCloud** | High |
| Primarily Microsoft stack | **Azure Government** | High |
| Primarily Oracle stack | **OCI GovCloud** | High |
| Big data / analytics heavy | **GCP** | Low (limited C1 experience) |
| COBOL / Mainframe | See Mainframe section below | — |

---

## AWS GovCloud — Default Choice

**Choose AWS when:** The program has no strong CSP preference, or uses a mix of technologies without a dominant vendor lock-in.

### Strengths
- Broadest service catalog within C1
- Best C1 support and operational maturity
- Largest community, most documentation, most tooling
- Most C1 programs already on AWS — shared lessons and patterns available
- Best pricing calculator coverage and cost modeling tools

### Weaknesses
- Higher learning curve for teams with no AWS experience
- Cost management requires discipline (sprawl risk)

### C1 Specifics
- Most C1 guardrail documentation is AWS-first
- Widest range of approved services in C1 catalog
- Most precedent for resolving C1 blockers

---

## Azure Government — Microsoft Stack Programs

**Choose Azure when:** The program is heavily invested in Microsoft technologies.

### Microsoft stack signals that point to Azure:
- Windows Server workloads
- SQL Server databases
- .NET / ASP.NET applications
- Azure Active Directory / LDAP federation
- Microsoft 365 integrations
- Hyper-V virtualization

### Strengths
- Natural fit for Windows/SQL/AD-heavy environments
- Lift-and-shift path is more direct for Microsoft workloads
- Azure Hybrid Benefit licensing savings for Windows/SQL

### Weaknesses
- C1 support for Azure is weaker than for AWS
- Microsoft's C1 team is smaller; issue resolution can be slower
- Fewer programs on Azure in C1 = less shared institutional knowledge
- Some C1 services have less mature Azure equivalents

### C1 Specifics
- Azure support within C1 is improving but still lags AWS
- GCDS/SSO integration with Azure AD requires additional configuration
- Validate all required Azure services are in the C1 approved service catalog before committing

---

## OCI GovCloud — Oracle-Heavy Programs

**Choose OCI when:** The program relies heavily on Oracle products.

### Oracle stack signals that point to OCI:
- Oracle Database (any edition)
- Oracle Linux
- Oracle E-Business Suite (EBS)
- Oracle ERP (Fusion, PeopleSoft, JD Edwards)
- Oracle WebLogic
- Oracle APEX

### Strengths
- Native Oracle performance and licensing advantages
- Oracle Autonomous Database and other managed Oracle services
- Best path for Oracle ERP / EBS lift-and-shift
- C1/Oracle support is reasonably good

### Weaknesses
- Not as broadly supported as AWS in C1
- Smaller ecosystem of tooling and community resources
- Less flexibility for non-Oracle workloads

### C1 Specifics
- C1/Oracle support is relatively good but not at AWS parity
- Confirm Oracle-specific managed services are in the C1 catalog
- OCI's IAM model differs from AWS/Azure — factor into guardrail compatibility review

---

## GCP — Big Data / Analytics

**Choose GCP when:** The program is primarily a big data or analytics workload with no strong AWS/Azure/Oracle dependencies.

### Big data signals that point to GCP:
- Large-scale data pipelines
- ML/AI workloads (TensorFlow, Vertex AI)
- BigQuery-style analytics requirements
- Pub/Sub or Dataflow patterns

### Caution
- GCP support within C1 is the least mature of the four CSPs
- Direct experience within C1 GCP is limited — validate heavily before committing
- Less tooling around C1 guardrails for GCP
- Recommend confirming C1 GCP support level before selecting this path

---

## Mainframe / COBOL — Special Case

Mainframe workloads are **not natively supported** in C1 CSPs.

### Options:

| Option | Description | Viability |
|--------|-------------|-----------|
| **Full refactor** | Rewrite COBOL to a modern language (Java, .NET, etc.) | High cost, long timeline |
| **Mainframe simulator** | Deploy a Mainframe simulator in C1 (e.g., IMDS precedent exists) | Possible — precedent set by at least one C1 program |
| **Hybrid** | Keep Mainframe on-prem/legacy; migrate surrounding systems | Depends on interface requirements |

**Key note:** At least one C1 program (IMDS) has successfully used a Mainframe simulator in C1 to support COBOL code. This is not mainstream but is a proven option.

---

## Multi-CSP Considerations

Some programs may need more than one CSP.

| Scenario | Approach |
|----------|---------|
| Oracle DB + modern .NET frontend | OCI for database tier, Azure or AWS for app tier |
| Primarily AWS but using Azure AD | AWS as primary; evaluate GCDS federation instead of Azure AD |
| Mixed vendor ERP + custom apps | Map each component to its natural CSP; minimize cross-CSP interfaces |

**Caution:** Multi-CSP deployments increase complexity and C1 coordination overhead. Only use if there is a clear justification.

---

## Validation Checklist Before CSP Selection

Before finalizing CSP selection in the App Analysis:

- [ ] All required services are listed in the C1 approved service catalog for the target CSP
- [ ] Compute/storage estimates have been run in the CSP's pricing calculator
- [ ] Authentication path to GCDS/SAML is understood for the target CSP
- [ ] Interface requirements reviewed against port 443/HTTPS constraint
- [ ] Any Oracle, Microsoft, or Mainframe dependencies have been identified and addressed
- [ ] A backup CSP option has been considered in case of C1 catalog gaps
