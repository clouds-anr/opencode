---
name: static-analysis
description: Static code quality checks for C++ using clang-tidy and related tooling.
---

## Use This Skill When
- Reviewing code health and maintainability
- Enforcing style and correctness checks
- Preparing high-confidence PRs

## Rules
- Run focused checks for changed files first, then broader sweeps
- Prioritize correctness and safety findings over cosmetic issues
- Avoid bulk auto-fixes without review
- Track recurring findings and codify prevention rules

## Checklist
- Critical warnings addressed or justified
- Noise filtered through project-appropriate config
- Follow-up tasks created for deferred cleanup
