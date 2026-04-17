---
name: senior-devops
description: C++ DevOps skill for reproducible builds, CI hardening, and release reliability using CMake, CTest, and sanitizer pipelines.
---

# Senior DevOps (C++)

## Mission

Make C++ delivery reliable, diagnosable, and repeatable across local and CI.

## When To Use

- Designing or updating CI/CD for C++ repositories
- Standardizing build/test flows via CMake presets
- Improving pipeline speed and failure diagnostics
- Introducing sanitizer and static-analysis gates

## Baseline Workflow

```bash
cmake -S . -B build -G Ninja
cmake --build build -j
ctest --test-dir build --output-on-failure
```

## CI Requirements

- One fast baseline job (configure/build/test)
- Sanitizer matrix jobs (ASan/UBSan/TSan as applicable)
- Artifact and log retention for triage
- Clear gate policy (block vs warn)

## Reliability Checklist

- Presets used for local/CI parity
- Deterministic toolchain versions
- Flaky tests tracked and quarantined with owners
- Failure output actionable without local guesswork

## Related Skills

- `ci-cmake-sanitizers`
- `cmake-production`
- `cpp-sanitizers`
- `static-analysis`
