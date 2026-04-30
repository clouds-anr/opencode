# Cloud One Configuration Management Plan — CDRL A004

**Document type:** Template — replace `{Missions Application}` with the actual program name.

**Purpose:** Required CDRL deliverable for all programs migrating to Cloud One. The CMP establishes and maintains the integrity of work products through configuration identification, control, configuration status accounting, and audits. Every migrating program must produce and maintain this document.

**Key tools:** C1 uses **Artifactory** as the artifact repository for application software, infrastructure scripts, and documentation. **TELOS Xacta** is used for security baseline tracking.


---

## 1. Introduction
The purpose of Configuration Management (CM) is to establish and maintain the integrity of work products using configuration identification, configuration control, configuration status accounting, and configuration audits.

This document will cover configuration management for the Cloud One environment, including:

* How we maintain and store versions:
  - Application Software
  - Infrastructure
  - Documentation
* Delivery of artifacts of change:
  - Application Software
  - Infrastructure
  - Documentation
* Capture baseline:
  - COTS and GOTS Software
  - Application Software
  - Infrastructure
  - Security
* Auditing:
  - Application Software
  - Infrastructure
  - Security
* Change Control Review


---

## 2. Maintenance and Storage of Versions

### 2.1 Application Software
* Describe SCM source for maintenance / lab environment
* Describe tagging / branching strategy for application
* Describe process for submitting a release candidate to the Cloud One Integration environment (Artifactory)

### 2.2 Infrastructure
* Cloud One leverages cloud services (AWS and Azure) — infrastructure is treated as code (Ansible, CloudFormation, ARM templates)
* Describe tagging/branching/SCM strategy for infrastructure scripts/deployments
* Describe process for submitting a release candidate infrastructure change to the Cloud One Integration environment (Artifactory)

### 2.3 Documentation
* Describe the documentation repository for the mission application, including:
  - Location of repository and process for managing access
  - Documentation requirements for application releases (both major and minor)
  - Process for correlating documentation artifacts to deployment artifacts (in Artifactory)
* Describe documentation versioning and naming conventions for the Mission Application

---

## 3. Delivery of Artifacts of Change

### 3.1 Application Software
* Describe the process for delivering artifacts to Artifactory, including:
  - Bucket location for initial upload
  - Metadata associated with the artifact (links to test results, documentation, etc.)
  - User Roles approved to deliver artifacts

### 3.2 Infrastructure
* Describe the process for delivering Infrastructure artifacts to Artifactory, including:
  - Bucket location for initial upload
  - Metadata associated with the artifact (links to test results, documentation, etc.)
  - User Roles approved to deliver artifacts

### 3.3 Data Changes
* Describe the process for updating system data (both DDL and DML) as part of a release
  - Version management of data scripts/files

### 3.4 Documentation
* Describe the process for updating / modifying documentation associated with a release artifact, including:
  - Versioning
  - Process for associating metadata to release artifacts (test reports, scan results, approvals)

## 4. Capture Baseline

### 4.1 COTS, GOTS and FOSS Software
* Describe the process for maintaining an inventory of COTS/GOTS/FOSS Software components, including:
  - Versions of all components used within the system
  - Process for updating / validating inventory and version associated with application changes / releases

### 4.2 Application Software
* Describe the process for tracking approved baseline and version history for the application
  - Tagging of current baseline in Artifactory and in SCM
  - Tracking of approvals for each baseline

### 4.3 Infrastructure Baseline
* Describe the process for tracking approved infrastructure baseline and version history for the system
  - Tagging of current baseline in Artifactory and in SCM
  - Tracking of approvals for each baseline

### 4.4 Security
TELOS Xacta software is used to determine the security baseline.

---

## 5. Auditing Against Baseline

### 5.1 Application Software
* Describe the process for confirming that application code associated with the baseline matches the currently deployed software
  - Describe process for leveraging Artifactory XRay for analyzing incoming artifacts for unapproved libraries *(Note: XRay not currently available — this requirement is waived until service is delivered)*
  - Describe the process for auditing Artifactory to ensure that only approved releases are deployed to Test/Production

### 5.2 Infrastructure
* AWS and Azure default configurations for mission applications include pre-configured CloudWatch alarms for unauthorized attempts to modify system resources. Only approved changes (via Artifactory) are permitted.
* Describe the process for auditing Artifactory to ensure that only approved infrastructure changes are deployed to Test/Production

### 5.3 Security
TELOS Xacta software is used to determine the security baseline.
## 6. Appendix

### Acronym Reference

| Acronym | Definition |
|---------|------------|
| AF | Air Force |
| AWS | Amazon Web Services |
| CCE | Common Computing Environment |
| CM | Configuration Management |
| CMP | Configuration Management Plan |
| COTS | Commercial Off The Shelf |
| FOSS | Free and Open Source Software |
| GOTS | Government Off The Shelf |
| OMS | Operational Management Suite |	

