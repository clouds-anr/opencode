---
description: "Detect tech stack and generate a CI/CD pipeline scaffold"
---

Analyze the codebase at: $ARGUMENTS

If no path is provided, analyze the current working directory.

## Your Task

Detect the tech stack and generate a production-ready CI/CD pipeline scaffold. Write the pipeline file(s) directly into the repository at the correct path for the detected platform.

---

## Phase 1: Detection

Read the codebase to determine:

1. **Language & runtime** — Node.js, Python, Java, .NET, Go, Rust, etc. Note version constraints from `.nvmrc`, `.python-version`, `go.mod`, `Cargo.toml`, etc.
2. **Package manager** — npm, yarn, bun, pip, poetry, maven, gradle, cargo, etc.
3. **Test framework** — jest, vitest, pytest, JUnit, go test, etc. Find test scripts in manifests.
4. **Build output** — Docker image, static files, JAR, binary, Lambda zip, etc.
5. **Dockerfile presence** — if present, read it to understand the build process
6. **Existing CI config** — check for `.github/workflows/`, `azure-pipelines.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`
7. **Cloud target signals** — AWS (SAM, CDK, Serverless Framework), Azure (bicep, ARM, azd), GCP signals
8. **Security scan tooling** — any existing Snyk, Dependabot, Trivy, Checkov, or SonarQube config
9. **Deployment mechanism** — Terraform, kubectl, helm, serverless deploy, eb deploy, etc.

**Pipeline platform selection:**
- If `.github/` exists → generate GitHub Actions
- If `azure-pipelines.yml` exists or Azure signals are strong → generate Azure DevOps
- If no CI exists → default to GitHub Actions and note this assumption

---

## Phase 2: Pipeline Design

Design a pipeline with these stages (include only what's relevant to the detected stack):

### Stages

| Stage | Purpose | Triggers |
|-------|---------|---------|
| **lint** | Code style and static analysis | All pushes |
| **test** | Unit and integration tests with coverage | All pushes |
| **security-scan** | Dependency CVE scan + SAST | All pushes |
| **build** | Compile / bundle / Docker image build | All pushes |
| **publish** | Push image to registry or publish artifact | Main branch + tags |
| **deploy-staging** | Deploy to staging environment | Main branch |
| **deploy-prod** | Deploy to production | Tags / manual approval |

### Requirements per stage:
- **lint**: Use the project's existing lint command if found; otherwise default to the standard tool for the language
- **test**: Run with coverage reporting; fail if coverage drops below 80% (configurable via env var)
- **security-scan**: Use `trivy` for container scanning if Docker is present; use `npm audit` / `pip audit` / `cargo audit` for dependency scanning
- **build**: Cache dependencies between runs; tag Docker images with both `latest` and the git SHA
- **deploy**: Use environment protection rules for production; require manual approval

---

## Phase 3: Write the Pipeline File(s)

Write the pipeline file(s) to the correct location:
- GitHub Actions → `.github/workflows/ci.yml`
- Azure DevOps → `azure-pipelines.yml`

Requirements:
- **Fully functional** — no placeholder steps; every step must run with the detected stack
- **Cached dependencies** — use the appropriate caching action/task for the package manager
- **Environment variables** — use secrets for credentials; document which secrets must be configured in the repo settings as a comment at the top of the file
- **Branch strategy** — lint/test on all branches; build/publish/deploy only on `main` and version tags
- **Fail fast** — lint and test run in parallel; build only starts if both pass
- **Sensible defaults** — if something can't be determined, use the most common convention for the detected stack and leave a `# TODO:` comment explaining what to customize

After writing the file(s), confirm:
- The file path(s) written
- Detected stack summary (language, package manager, test framework, build output, cloud target)
- Stages included
- Secrets that must be configured in the repository before the pipeline will run
- Any assumptions made where the stack was ambiguous
