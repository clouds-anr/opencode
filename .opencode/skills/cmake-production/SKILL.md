---
name: cmake-production
description: Production-grade CMake patterns for targets, presets, toolchains, and dependencies.
---

## Use This Skill When
- Adding new libraries/executables
- Restructuring build layout
- Improving CI reproducibility

## Rules
- Use target-based CMake (`target_link_libraries`, `target_include_directories`)
- Prefer `PRIVATE`, `PUBLIC`, `INTERFACE` semantics explicitly
- Keep compiler flags target-scoped
- Prefer `CMakePresets.json` for shared workflows
- Pin third-party dependency versions where possible

## Checklist
- No global include/link pollution
- Build types are reproducible
- Warnings and sanitizer options are configurable by preset
- Test targets are wired into CTest
