---
name: ci-cmake-sanitizers
description: Build a reliable C++ CI pipeline using CMake presets, CTest, and sanitizer matrix jobs.
---

## Use This Skill When
- Creating or updating GitHub Actions for C++ projects
- Standardizing CMake configure/build/test in CI
- Adding sanitizer matrix coverage (ASan, UBSan, TSan)

## CI Objectives

- Reproducible build setup via `CMakePresets.json` where possible
- Fast feedback on mainline build and targeted tests
- Safety coverage through sanitizer jobs
- Clear failure diagnostics for triage

## Baseline Workflow Structure

1. Checkout source
2. Configure with a named preset or explicit CMake flags
3. Build with parallel workers
4. Run CTest with failure output enabled
5. Run sanitizer matrix jobs for high-risk paths

## Example GitHub Actions Skeleton

```yaml
name: cpp-ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure
        run: cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo
      - name: Build
        run: cmake --build build -j
      - name: Test
        run: ctest --test-dir build --output-on-failure

  sanitizers:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        sanitizer: [asan, ubsan, tsan]
    steps:
      - uses: actions/checkout@v4
      - name: Configure (${{ matrix.sanitizer }})
        run: |
          case "${{ matrix.sanitizer }}" in
            asan)
              cmake -S . -B build -G Ninja -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer" ;;
            ubsan)
              cmake -S . -B build -G Ninja -DCMAKE_CXX_FLAGS="-fsanitize=undefined -fno-omit-frame-pointer" ;;
            tsan)
              cmake -S . -B build -G Ninja -DCMAKE_CXX_FLAGS="-fsanitize=thread -fno-omit-frame-pointer" ;;
          esac
      - name: Build
        run: cmake --build build -j
      - name: Test
        run: ctest --test-dir build --output-on-failure
```

## Preset Guidance

- Prefer named presets for local/CI parity (`ci`, `asan`, `ubsan`, `tsan`)
- Keep preset inheritance simple and explicit
- Avoid one-off CI-only flags when a preset can express them

## Failure Triage Checklist

- Is failure build-only, test-only, or sanitizer-only?
- Does sanitizer output identify a reproducible local scenario?
- Can a regression test lock the fix?
- Should the failure block merge or be quarantined with a follow-up issue?

## Best Practices

- Use `--output-on-failure` in CTest to keep logs actionable
- Keep sanitizer jobs independent and non-flaky
- Prefer fail-fast false for sanitizer matrices to see full risk profile
- Cache dependencies cautiously; avoid masking stale toolchain problems
