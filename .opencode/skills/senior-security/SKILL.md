---
name: senior-security
description: C++ security engineering skill for threat modeling, secure coding, and hardening in native systems.
---

# Senior Security (C++)

## Mission

Reduce exploitability and operational security risk in C++ systems.

## When To Use

- Reviewing security posture of C++ modules and interfaces
- Threat modeling for network/file/parsing boundaries
- Hardening memory and concurrency-sensitive code
- Defining secure defaults and defensive checks

## C++ Security Priorities

- Eliminate unsafe lifetime and ownership patterns
- Validate untrusted input early and centrally
- Avoid undefined behavior and integer pitfalls
- Keep crypto/auth logic isolated and reviewable
- Prefer fail-closed behavior on security-sensitive paths

## Security Review Checklist

- Attack surface map by module
- Trust boundaries and assumptions documented
- Potential memory/UB risks identified and tested
- Logging avoids sensitive data leakage
- Dependency and toolchain risks reviewed

## Verification

- Sanitizer coverage for risky areas
- Static-analysis findings triaged with owners
- Regression tests for identified vulnerabilities

## Related Skills

- `cpp-sanitizers`
- `static-analysis`
- `premortem`
- `redteam`
