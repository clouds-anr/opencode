---
name: cpp-testing
description: C++ testing patterns using GoogleTest/Catch2 and CTest orchestration.
---

## Use This Skill When
- Creating or refactoring C++ tests
- Adding regression protection for bug fixes
- Improving confidence in critical paths

## Rules
- Write tests around behavior, not implementation details
- Add a regression test for each fixed defect
- Keep tests deterministic (no hidden clock/network randomness)
- Use fixtures only when setup reuse is meaningful
- Prefer clear failure messages

## Checklist
- Happy path and edge cases covered
- Error and boundary behavior validated
- Test names describe intent
- CTest labels support focused runs
