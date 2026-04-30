# Cloud One Test Script — CDRL A037/A038

**Document type:** Template — replace `{Mission Application}` with the actual program name.

**Purpose:** Defines the test procedures required for a mission application's Cloud One release. Covers all test types required before migration can be considered complete. Results feed into the A037 Test Report CDRL.

**Testing environment:** AWS GovCloud or Azure Government Test Integration Zone (within C1 accounts).

---

## Required Test Types

Every C1 migration must address all of the following test categories:

| Test Type | Description | Required? |
|-----------|-------------|-----------|
| Functional Testing | Verify application features work correctly in C1 environment | Yes |
| Regression Testing | Confirm existing functionality not broken by migration changes | Yes |
| Performance Testing | Load/stress testing; server elasticity validation | Yes |
| User Acceptance Testing (UAT) | Government representative validates expected behavior | Yes — 2-week minimum |
| Smoke Testing | Basic sanity check post-deployment | Yes |
| Security Testing | ACAS STIG scans pre- and post-install | Yes |
| Environment Testing | SAML authentication, role-based access, browser compatibility | Yes |
| High Availability (HA) & Failover | Load balancer failover, RDS failover (if applicable) | When applicable |

---

## Cloud One Dependent Services

The following C1 platform services are available to mission applications and may be declared as dependencies:

| Service | Description |
|---------|-------------|
| **GCDS (Global Content Delivery Services)** | Front-end system using commercial internet technology to accelerate and secure DoD web content. Required for SAML/SSO integration. |
| **Enterprise Service Bus (ESB)** | Used to transfer files to/from Cloud One. Requires coordination with ESB team before use. |
| SMTP | Email relay |
| Artifactory | Artifact repository for deployments |
| Jenkins | CI/CD pipeline |
| Guacamole | Remote desktop gateway |
| Active Directory | Directory services |
| DNS | Domain Name Service |
| Ansible | Configuration management automation |
| Elastic Beanstalk | PaaS deployment (AWS) |
| Xacta 360 | Security/ATO compliance tracking |

---

## STIG Scan Requirements

ACAS Security Technical Implementation Guide (STIG) scans must be performed **before and after installation**. Results go into the Test Report (A037).

| Software Component | STIG Version | Scan Date | Method |
|--------------------|-------------|-----------|--------|
| Tomcat | | | Automated |
| Apache | | | Automated |
| Amazon Linux | | | Automated |
| Oracle | | | Automated |
| *(add others)* | | | |

---

## Test Case Template

Each test case follows this structure (use ID format `CCE-FTEST-CASE-###` for functional, `CCE-RTEST-CASE-###` for regression):

| Field | Value |
|-------|-------|
| Test Case ID | CCE-[F/R]TEST-CASE-001 |
| Test Title | {Description} |
| Environment | AWS / Azure Test Integration Zone |
| Users/Roles | {List roles being tested} |
| Requirement ID | {Linked requirement} |

**Procedure format:**

| Step | Action | Expected Result | Notes |
|------|--------|----------------|-------|
| 1 | Step description | Expected outcome | |
| 2 | Step description | Expected outcome | |

---

## Performance Testing Approach

Using JMeter or LoadRunner, simulate the following scenarios (customize per application):
- `XX` concurrent users
- Start 1 user every `X` seconds
- Test duration: 60 minutes
- Measure: transactions per hour, response time, error rate

---

## Environment Testing — C1-Specific Scenarios

Environment testing must explicitly cover C1 integration points:
- SAML authentication via GCDS
- Login and access verification using multiple user roles
- Browser compatibility (current supported browsers)
- C1 guardrail compliance (VPC/subnet constraints, port 443 interfaces)

---

## Acronym Reference

| Acronym | Definition |
|---------|------------|
| AF-CCE | Air Force - Common Computing Environment |
| CCE | Common Computing Environment |
| CDRL | Contract Deliverables Requirement List |
| CI | Configuration Item |
| CM | Configuration Management |
| DISA | Defense Information Systems Agency |
| GCDS | Global Content Delivery Services |
| IF | Infrastructure Framework |
| PMO | Program Management Office |
| RHEL | Red Hat Enterprise Linux |
| SAML | Security Assertion Markup Language |
| SI | System Integrator |
| STIG | Security Technical Implementation Guide |
| TR | Test Report |
| UAT | User Acceptance Testing |

