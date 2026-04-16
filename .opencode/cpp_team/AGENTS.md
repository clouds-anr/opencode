# AGENTS.md - Multi-Agent Development Template

> **This is a template AGENTS.md - customize for your project**

## Project Overview

<!-- TODO: Add project-specific content -->
<!-- Describe what your project does, its goals, and key features -->

## The Agent System

This project uses a multi-agent system for context-efficient development.

### Agents

#### Core Agents

| Agent | Role | Mode |
|-------|------|------|
| **@cpp_orchestrator** | C++ Orchestrator - coordinates, delegates, synthesizes | primary |
| **@researcher** | Researcher + Planner - deep analysis, actionable plans | subagent |
| **@implementor_cpp** | Implementor C++ - modern C++ implementation, performance, and safety | subagent |
| **@tester_cpp** | Tester C++ - validates behavior, sanitizers, and regressions | subagent |
| **@documentation** | Documentation - PlantUML, ADRs, and API docs | subagent |
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
  Orchestrator ──────────────────────────────────────────┐
    │                                                    │
    ├──→ Researcher (research + plan)                   │
    │         │                                          │
    │         ├──→ Truth-Teller (challenge)             │ ← optional, for complex/risky changes
    │         ▼                                          │
    ├──→ Implementor C++ (implement)                      │
    ├──→ Tester C++ (tests + sanitizers)                 │
    └──→ Documentation (PlantUML + docs) ──→ Done ◄─────┘
```

### Truth-Teller Consensus Pattern

For high-stakes decisions, run all three Truth-Teller variants in parallel:

```
Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use:**
- Major architectural decisions
- Risky refactors (>5 files)
- When you want diverse AI perspectives
- When the team is stuck

**How to interpret:**
- **All agree** = High confidence signal
- **Disagree** = Explore each angle
- **One unique insight** = Investigate further

### Key Principles

- **Orchestrator delegates everything** - preserves context
- **Researcher digs deep, plans lean** - research flows into actionable plans
- **Implementor C++ follows specs** - no improvisation
- **Tester C++ validates execution** - test and sanitizer gates before completion
- **Documentation keeps knowledge synced** - diagrams and ADR/API docs updated with behavior changes
- **Truth-Teller challenges** - called for complex refactors (>5 files), risky changes, or when stuck

### C++ CI Skill Recommendation

Use `ci-cmake-sanitizers` when creating or updating CI:
- CMake configure/build/test baseline jobs
- Sanitizer matrix jobs (ASan/UBSan/TSan)
- Preset-driven local/CI parity

## Quick Start

<!-- TODO: Add project-specific content -->
<!-- Add setup instructions, common commands, and daily workflow -->

```bash
# Configure
cmake -S . -B build -G Ninja

# Build
cmake --build build -j

# Run tests
ctest --test-dir build --output-on-failure
```

## C++ Tooling Baseline

**CRITICAL:** Keep C++ build and test commands reproducible across local and CI.

```bash
# Configure once (or after CMake changes)
cmake -S . -B build -G Ninja

# Build targets
cmake --build build -j

# Run full test suite
ctest --test-dir build --output-on-failure
```

Use presets (`CMakePresets.json`) and target-scoped options whenever possible.

## Workflow Rules

<workflow>
### After Code Fixes
When `@implementor_cpp` completes a fix for a GitHub issue:
1. **Delegate testing** to `@tester_cpp` and confirm pass status (+ sanitizer status when relevant)
2. **Delegate documentation updates** to `@documentation` for architecture/API behavior changes
3. **Commit** with message format: `fix #<issue_number>: <short description>`
4. **Push** to remote immediately
5. **Close issue** with `gh issue close <number> --reason completed --comment "<summary of fix>"`
6. **Move to next** issue in priority order

### Commit Frequency
- **In branches:** Commit after EVERY meaningful change (don't batch)
- **Small, atomic commits** are preferred over large ones
- **Always push** after committing - don't let commits pile up locally

### Branch Workflow
When working in a feature branch:
1. Commit and push frequently (after each fix/change)
2. When all issues for the branch are complete:
   - Check if other branches exist: `git branch -a`
   - If **no other branches**: prepare PR and merge to main
   - If **other branches exist**: prepare PR but **do NOT merge** - ask user first
3. Always use `gh pr create` with clear summary

### Issue Management
- Close issues **immediately** after fix is verified (tests pass)
- Always include in close comment:
  - What was changed
  - Problems encountered during the work on this issue, and how you solved them
  - Which file(s) were modified
  - Commit hash if relevant
- Link related issues in comments when applicable

### Commit Message Format
```
<type> #<issue>: <description>

Types: fix, feat, refactor, docs, test, chore
```

Examples:
- `fix #42: handle null response from API`
- `feat #15: add user authentication`
- `refactor #30: extract validation logic`
</workflow>

## Scripts

<!-- TODO: Add project-specific content -->
<!-- Document your project's scripts and their purposes -->

| Script | Purpose |
|--------|---------|
| `tools/example.cpp` | Description of what it does |

## Project Structure

<!-- TODO: Add project-specific content -->
<!-- Document your project's directory structure -->

```
your-project/
├── AGENTS.md                 # This file
├── CMakeLists.txt            # Build configuration
├── CMakePresets.json         # Reproducible build/test presets
├── src/                      # Source code
├── tests/                    # Unit tests
└── docs/                     # Diagrams and technical docs
```

## Architecture

<!-- TODO: Add project-specific content -->
<!-- Document key architectural patterns, abstractions, and design decisions -->

## Key Modules

<!-- TODO: Add project-specific content -->
<!-- Document the main modules and their responsibilities -->

| Module | Purpose |
|--------|---------|
| `src/module.cpp` | Description |

## Configuration

<!-- TODO: Add project-specific content -->
<!-- Document configuration files and environment variables -->

## Code Style

- **C++:** C++20+ preferred (or project baseline)
- **Build:** Target-based CMake with presets
- **Testing:** CTest + framework of choice (GoogleTest/Catch2)
- **Naming:** Follow project conventions consistently

<!-- TODO: Add project-specific code style rules if needed -->
