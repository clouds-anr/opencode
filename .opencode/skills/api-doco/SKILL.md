---
name: api-doco
description: Public API documentation discipline, migration notes, and compatibility signaling.
---

## Use This Skill When
- Public interfaces change
- Behavior or defaults change
- Deprecated paths are introduced or removed

## Rules
- Document contract, constraints, and error behavior
- Provide before/after examples for breaking or subtle changes
- Add migration notes for renamed or removed APIs
- Mark compatibility level clearly

## Checklist
- API docs updated in same change window as code
- Deprecations include timeline and replacement
- Examples compile or are validated against tests
