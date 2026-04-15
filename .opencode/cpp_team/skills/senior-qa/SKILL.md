---
name: senior-qa
description: C++ QA skill for test strategy, regression prevention, and risk-based validation with CTest and sanitizer-informed coverage.
---

# Senior QA (C++)

## Mission

Raise confidence in C++ changes with focused, reproducible, and risk-aware validation.

## When To Use

- Defining test strategy for new features or refactors
- Building regression test plans for bug fixes
- Evaluating risk coverage for concurrency/memory-heavy changes
- Improving test architecture and diagnostics

## Test Strategy Principles

- Test behavior, not implementation details
- Add regression tests for every fixed defect
- Keep tests deterministic and isolated
- Prioritize high-risk boundaries and failure paths

## Validation Layers

- Unit tests for business logic and edge cases
- Integration tests for module contracts and data flow
- Sanitizer runs for memory/UB/threading risks
- Focused smoke runs for critical user paths

## QA Report Template

- Scope validated
- Results by layer
- New regression coverage added
- Residual risks and recommended follow-ups

## Related Skills

- `cpp-testing`
- `cpp-sanitizers`
- `static-analysis`
- `pr-review`
