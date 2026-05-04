---
description: "Analyze a file or module and produce a prioritized refactor plan"
---

> **If this codebase is deployed on or being migrated to Cloud One (C1)**, load the `anr-csp-knowledge` skill before proceeding. C1-specific issues are automatic **P1** findings regardless of general code quality: non-443/HTTPS socket connections, non-SAML authentication mechanisms, hardcoded NIPRNet endpoints, and missing GCDS integration. The skill provides the full catalog of C1 blockers and their resolution paths.

Analyze the file or module at: $ARGUMENTS

If no path is provided, analyze the current working directory.

## Your Task

Perform a deep analysis of the target code and produce a prioritized refactor plan as a markdown file named `refactor-plan.md` in the analyzed directory. Do not make any code changes — only analyze and plan. The output should be committable, linkable from tickets, and copy-pasteable into PR descriptions.

---

## Phase 1: Scope

Determine what was passed:
- **Single file** — analyze that file in depth, then read its direct imports/dependencies for context
- **Directory/module** — analyze all files in the directory, understanding how they relate to each other
- **No argument** — analyze the full codebase, identify the top 3–5 modules most in need of refactoring, and produce a plan for each

For each file analyzed, also read:
- Files that import it (understand its callers)
- Files it imports (understand its dependencies)
- Associated test files

---

## Phase 2: Analysis Dimensions

Evaluate the code across these dimensions:

### 1. Complexity
- **Cyclomatic complexity** — functions with many branches, nested conditionals, deeply nested loops
- **Cognitive complexity** — code that is hard to read even if not technically complex (clever one-liners, implicit logic, deep nesting)
- **Function length** — functions over ~50 lines are candidates for extraction
- **File length** — files over ~300 lines often have mixed concerns

### 2. Coupling & Cohesion
- **High coupling** — modules that import from many other modules or are imported by many others; changes here ripple everywhere
- **Low cohesion** — files or classes that do multiple unrelated things (violates Single Responsibility)
- **Circular dependencies** — module A imports B which imports A
- **Inappropriate intimacy** — code that reaches into the internals of another module rather than using its public API

### 3. Duplication
- **Copy-paste code** — similar logic repeated in multiple places
- **Near-duplicate functions** — functions that differ only in one or two parameters
- **Magic numbers/strings** — repeated literal values that should be named constants

### 4. Code Smells
- **God objects/files** — one thing doing everything
- **Long parameter lists** — functions with 4+ parameters (especially booleans) are hard to call correctly
- **Shotgun surgery** — making one change requires touching many files
- **Feature envy** — code that operates more on another module's data than its own
- **Dead code** — functions, variables, exports that are defined but never used
- **TODO/FIXME/HACK comments** — inventory all of them; they are debt markers

### 5. Testability
- **Untestable code** — functions with side effects, global state, direct I/O, or `new` calls to concrete dependencies inside business logic
- **Missing abstractions** — code that would be easy to test if an interface/abstraction was introduced
- **Test coverage gaps** — identify which functions/branches have no test coverage based on the presence (or absence) of test files and test cases

### 6. Naming & Readability
- **Misleading names** — variable/function names that don't match what they do
- **Abbreviations** — overly abbreviated names that require context to decode
- **Inconsistent conventions** — mixing naming styles in the same module

### 7. C1 / GovCloud Compliance Findings *(apply when target is C1)*
Treat the following as automatic **P1** findings regardless of other scoring:
- Any TCP/HTTP connection not on port 443 — flag the file, line, and interface partner
- Any authentication mechanism that is not SAML-compatible (custom auth, LDAP direct, OAuth-only, JWT without SAML wrapper)
- Hardcoded IP addresses or hostnames that appear to be NIPRNet or government-internal
- Missing GCDS integration in auth flow
- Any `FTP`, `SFTP`, `SSH`, or raw socket usage crossing a service boundary
- Services or libraries from the CSP that may not be in the C1 approved catalog

---

## Phase 3: Refactor Plan

Organize all findings into a prioritized plan:

### Priority Tiers

| Tier | Criteria | When to Do |
|------|----------|------------|
| **P1 — Do Now** | Active bugs risk, security issue, or blocks other work | This sprint |
| **P2 — Do Soon** | High complexity causing ongoing development friction | Next 1–2 sprints |
| **P3 — Scheduled** | Duplication, naming, testability improvements | Maintenance window |
| **P4 — Nice to Have** | Style, minor readability, optional extractions | When touching the file anyway |

### For each finding, document:

| Field | Content |
|-------|---------|
| **ID** | REF-001, REF-002, etc. |
| **Priority** | P1 / P2 / P3 / P4 |
| **File(s)** | Affected file path(s) and line range(s) |
| **Issue** | What the problem is |
| **Impact** | Why it matters (maintenance cost, bug risk, test coverage gap) |
| **Recommendation** | Specific, actionable change (extract function, introduce interface, rename, delete, etc.) |
| **Effort** | Small (< 1 hour) / Medium (half day) / Large (full day+) |
| **Risk** | Low (no behavior change) / Medium (refactor with tests) / High (requires careful testing) |

### Dependency Order
Note which refactors should be done before others (e.g., "extract the interface in REF-003 before splitting the class in REF-007").

---

## Phase 4: Write the Refactor Plan

**Filename:** Before writing, check whether `refactor-plan.md` already exists in the analyzed directory. If it does, use `refactor-plan-2.md`; if that exists too, use `refactor-plan-3.md`, and so on — never overwrite an existing file.

Write the refactor plan (using the resolved filename above) in the analyzed directory with:

- **Summary section** — total findings by priority tier, total estimated effort, top 3 highest-value items
- **Priority-ordered findings** — P1 first, then P2, P3, P4; each finding as a `###` subsection with the full field table
- **Effort matrix** — markdown table mapping findings into four quadrants: High Value / Low Effort (do first), High Value / High Effort (plan), Low Value / Low Effort (quick wins), Low Value / High Effort (skip)
- **TODO/FIXME inventory** — table of all debt markers found with file and line number
- **Dependency order** — ordered list of which refactors must precede others

- **File paths**: use forward slashes in all tool call `filePath` arguments, even on Windows. Use relative paths from the project root, not absolute Windows paths.

After writing the file, confirm:
- The file path where the refactor plan was written (include the resolved filename)
- Total findings by priority tier
- Estimated total effort (sum of all items)
- The single highest-value / lowest-effort item (the best place to start)
