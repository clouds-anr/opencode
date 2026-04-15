---
name: senior-architect
description: C++ architecture skill for scalable, maintainable systems using modern C++, CMake, and clear module boundaries. Use for architecture decisions, dependency direction, and design trade-offs in C++ projects.
---

# Senior Architect (C++)

## Mission

Design production-grade C++ systems that are understandable, testable, and evolvable.

## When To Use

- Defining module boundaries and ownership
- Evaluating refactor risk for multi-module changes
- Designing APIs, extension points, and package layout
- Creating architecture docs and decision records

## C++ Architecture Principles

- Prefer clear ownership and lifetimes over implicit conventions
- Keep dependency graph acyclic and layer boundaries explicit
- Isolate platform-specific code behind narrow interfaces
- Minimize public headers and transitive include load
- Use composition by default; inheritance only with clear polymorphic needs

## Decision Checklist

- What are the stable interfaces and why?
- Which module owns each responsibility?
- How will this be tested in isolation and integration?
- What is the migration path and rollback strategy?
- What are ABI/API compatibility implications?

## Recommended Outputs

- Architecture summary with trade-offs
- Impacted modules and dependency direction
- Incremental rollout plan
- Risks and mitigations
- ADR update recommendation when behavior or architecture changes

## Related Skills

- `cpp-modern`
- `cmake-production`
- `plantuml-docs`
- `api-doco`
