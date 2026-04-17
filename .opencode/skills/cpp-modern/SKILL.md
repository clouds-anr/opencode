---
name: cpp-modern
description: Modern C++ implementation guidance (C++20/23), ownership, RAII, and API design.
---

## Use This Skill When
- Writing or refactoring core C++ logic
- Reviewing object lifetime, ownership, and exception safety
- Designing public interfaces or value types

## Rules
- Prefer RAII and value semantics by default
- Use `std::unique_ptr` for exclusive ownership, `std::shared_ptr` only with clear shared lifetime need
- Avoid raw `new` and `delete` in application code
- Keep interfaces const-correct and narrow
- Avoid hidden work in constructors
- Prefer `std::span`, `std::string_view`, and strong types at boundaries

## Checklist
- Ownership and lifetime are explicit
- Move/copy behavior is intentional
- Error handling strategy is consistent
- No unnecessary heap allocations in hot paths
- Header dependencies are minimized
