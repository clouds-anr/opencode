---
name: cpp-sanitizers
description: Practical sanitizer workflow for C++ (ASan, UBSan, TSan) and triage.
---

## Use This Skill When
- Validating memory safety or UB-sensitive changes
- Touching threading or lock-heavy logic
- Hardening release readiness

## Rules
- Run ASan + UBSan for most changes touching pointers, containers, or arithmetic assumptions
- Run TSan for concurrency-sensitive paths
- Fix root causes, not only symptoms
- Keep suppressions minimal and documented

## Checklist
- Sanitizer config documented in build presets
- Failing stack traces mapped to owning module
- Reproduction steps captured
- Regression test added where feasible
