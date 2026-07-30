<!-- ANRCODE_CHANGE {"issue":383,"branch":"anr/383/move-ammo-to-aitemplates-doco","date":"2026-07-30"} -->
# Cross-Platform Agent Configuration Updates

This document provides step-by-step instructions to update your agents for cross-platform compatibility based on the Session Report from 2026-07-01.

## Executive Summary

**Current State:** Agents are configured with Unix-specific bash commands that fail on Windows.  
**Target State:** Agents use platform-independent tools with bash reserved for universal operations (git, build tools).  
**Timeline:** 1-2 hours to implement across all agents.

---

## Problem Statement (From Session Report)

The documentarian agent has overly restrictive bash permissions:

```yaml
# Current (UNIX-ONLY)
permission:
  bash:
    allow:
      - "ls *"           # ❌ Windows: no ls
      - "cat *"          # ⚠️  Might fail depending on shell
      - "find *"         # ❌ Windows: no find
    deny:
      - "*"
```

**Issue:** These commands fail on Windows, preventing cross-platform execution.

---

## Solution: Three-Tier Approach

### Tier 1: Use Built-In Tools (BEST)
Replace bash commands with framework tools that work on all platforms:
- `tool.glob` → replaces `find` and `ls`
- `tool.read` → replaces `cat`
- `tool.grep` → replaces `grep` and `rg`
- `tool.list` → replaces `ls` and `dir`

### Tier 2: Use Universal Bash Commands
If bash is necessary, use commands that work on all platforms:
- `git status`, `git diff`, `git add` ✅ Universal
- `npm run test`, `bun test` ✅ Universal
- `python script.py` ✅ Universal

### Tier 3: Document Platform-Specific Fallbacks
For rare cases requiring platform-specific logic, document alternatives in agent instructions.

---

## Implementation: Step-by-Step

### Step 1: Update documentarian.md

**File:** `.opencode/agent/documentarian.md`

**Current Configuration (UNIX-ONLY):**
```yaml
---
description: >-
  Documentation specialist for technical writing and architecture artifacts.
  Owns PlantUML diagrams, ADR updates, API docs, and release notes.
mode: subagent
temperature: 0.2
tools:
  read: true
  glob: true
  grep: true
  list: true
  task: false
  webfetch: true
  todoread: true
  todowrite: true
  write: true
  edit: true
  bash: true
  skill: true
permission:
  bash:
    "ls *": allow
    "cat *": allow
    "head *": allow
    "tail *": allow
    "find *": allow
    "tree *": allow
    "rg *": allow
    "grep *": allow
    "git status": allow
    "git log *": allow
    "git diff *": allow
    "git show *": allow
    "plantuml *": allow
    "java -jar *plantuml*.jar *": allow
    "*": deny
---
```

**RECOMMENDED Update (CROSS-PLATFORM):**
```yaml
---
description: >-
  Documentation specialist for technical writing and architecture artifacts.
  Works on Windows, macOS, and Linux. Owns PlantUML diagrams, ADR updates, 
  API docs, and release notes.
mode: subagent
temperature: 0.2
tools:
  read: true        # ✅ Replaces 'cat', 'head', 'tail'
  glob: true        # ✅ Replaces 'find', 'ls'
  grep: true        # ✅ Replaces 'grep', 'rg'
  list: true        # ✅ Replaces 'ls', 'dir'
  task: false
  webfetch: true
  todoread: true
  todowrite: true
  write: true       # ✅ Creates files and directories
  edit: true        # ✅ Modifies files safely
  bash: true        # ⚠️  Reserved for git and build tools
  skill: true
permission:
  bash:
    # Git operations — universally available on all platforms
    "git status": allow
    "git log *": allow
    "git diff *": allow
    "git show *": allow
    "git add *": allow
    
    # Build/documentation tools — cross-platform when installed
    "plantuml *": allow
    "java -jar *plantuml*.jar *": allow
    "cmake *": allow
    
    # Deny dangerous operations
    "git push": deny
    "git commit": deny
    "rm -rf *": deny
    "*": deny
---
```

**Key Changes:**
- ✅ Removed `ls *` (use `tool.list` or `tool.glob`)
- ✅ Removed `cat *` (use `tool.read`)
- ✅ Removed `head *`, `tail *` (use `tool.read` with line ranges)
- ✅ Removed `find *` (use `tool.glob`)
- ✅ Removed `tree *` (use `tool.glob` with recursive patterns)
- ✅ Removed `rg *`, `grep *` (use `tool.grep`)
- ✅ Added `git add *` (needed for staging changes)
- ✅ Kept git operations (universally available)
- ✅ Added explicit deny rules for dangerous operations
- ✅ Updated description to mention cross-platform support

### Step 2: Update Agent Instructions

**Add this section to the agent markdown (after "---"):**

```markdown
## Platform Compatibility

This agent works on Windows, macOS, and Linux. It uses platform-independent tools for file operations:

### Tool Selection Guidelines

| Task | Tool | Example |
|------|------|---------|
| Find files matching pattern | `tool.glob` | `glob("docs/**/*.md")` |
| List directory contents | `tool.list` | `list("docs/")` |
| Read file contents | `tool.read` | `read("docs/api.md")` |
| Search in files | `tool.grep` | `grep("TODO", "src/")` |
| Create/write files | `tool.write` | Automatically creates directories |
| Edit existing files | `tool.edit` | Safe line-by-line modifications |

### Avoiding Platform-Specific Commands

❌ **DO NOT use these (Unix-only):**
- `ls`, `find`, `cat` — Use tools instead
- `grep`, `rg` — Use `tool.grep` instead
- `mkdir -p` — Use `tool.write` instead (auto-creates dirs)

✅ **Safe to use these (platform-universal):**
- `git status`, `git diff`, `git log` — Git is available everywhere
- `java -jar *.jar` — If Java is installed on all platforms
- `plantuml` — If installed as a platform-independent tool

### Cross-Platform Examples

**Example 1: Find all markdown files in documentation/**
```
DON'T: bash: find documentation -name "*.md" -type f
DO:    Use tool.glob with pattern: documentation/**/*.md
```

**Example 2: Search for "deprecated" in API docs**
```
DON'T: bash: grep -r "deprecated" docs/
DO:    Use tool.grep with query: "deprecated" in docs/
```

**Example 3: Review changes before documenting**
```
OK:    bash: git diff docs/api.md
       (Git is available on all platforms)
```
```

### Step 3: Update tester.md

**File:** `.opencode/agent/anr_tester.md`

**Current bash permission section:**
```yaml
permission:
  bash:
    "ls *": allow
    "cat *": allow
    "head *": allow
    "tail *": allow
    "find *": allow
    "tree *": allow
    "rg *": allow
    "grep *": allow
    # ... test commands
```

**RECOMMENDED Update:**
```yaml
permission:
  bash:
    # Test runners — language tools handle platform differences
    "npm *": allow
    "bun *": allow
    "npx *": allow
    "python *": allow
    "pytest *": allow
    "cargo test *": allow
    "go test *": allow
    "cmake --build *": allow
    "ctest *": allow
    "ninja *": allow
    "make *": allow
    "jest *": allow
    "vitest *": allow
    "clang-tidy *": allow
    
    # Git — for context and verification
    "git status": allow
    "git log *": allow
    "git diff *": allow
    "git show *": allow
    
    # Deny dangerous operations
    "git push": deny
    "git commit": deny
    "rm -rf *": deny
    "*": deny
```

**Key Changes:**
- ✅ Removed `ls`, `find`, `cat`, `grep`, `rg`, `tree` (use tools instead)
- ✅ Kept language-specific test runners (they handle platform differences)
- ✅ Kept git commands (universally available)

### Step 4: Update other agent files (if they exist)

Similar pattern for any other agents — remove Unix-specific commands, keep universal ones.

---

## Verification Checklist

After updating each agent, verify:

- [ ] No `ls *` or `find *` in bash permissions (use tool.glob instead)
- [ ] No `cat *` in bash permissions (use tool.read instead)
- [ ] No `grep *` or `rg *` in bash permissions (use tool.grep instead)
- [ ] All bash commands work on macOS, Linux, AND Windows
- [ ] Agent instructions mention cross-platform tool usage
- [ ] Git commands are allowed (git is universal)
- [ ] Dangerous operations are denied (git push, rm -rf, git commit)
- [ ] Agent description mentions Windows/macOS/Linux support

---

## Testing the Changes

### Test 1: Verify Configuration Syntax

```bash
# Check for parsing errors
npm run build
```

### Test 2: Run Agent on Different Platforms

```bash
# On macOS
npm run test -- -t "documentation_agent"

# On Linux
npm run test -- -t "documentation_agent"

# On Windows (Git Bash)
npm run test -- -t "documentation_agent"
```

### Test 3: Verify Tool Usage

Ask the agent to perform a cross-platform task:

```
Task: Find all Python files in the packages/ directory and 
document their module structure.

Expected: Agent uses tool.glob with pattern "packages/**/*.py"
Expected: Agent never uses bash find/grep commands for this
```

### Test 4: Verify Bash Restrictions

Ask the agent to perform a task requiring git:

```
Task: Review the changes I just made and stage them for commit.

Expected: Agent uses "bash: git diff" to review
Expected: Agent uses "bash: git add" to stage files
Expected: Agent does NOT use "git commit" or "git push"
```

---

## Commands for Implementation

### Quick Update: Documentation Agent Only

```bash
# Edit the file
cd /Users/dontadalpoas/Development/Repos/opencode
nano .opencode/agent/documentarian.md

# Replace the permission section with the cross-platform version above
# Save and exit (Ctrl+O, Enter, Ctrl+X)

# Verify syntax
npm run build
```

### Full Update: All Agents

```bash
# List all agents
ls -1 .opencode/agent/

# Edit each one following the pattern above
nano .opencode/agent/anr_documentarian.md
nano .opencode/agent/anr_tester.md
nano .opencode/agent/anr_implementor.md
nano .opencode/agent/anr_researcher.md
nano .opencode/agent/anr_team_lead.md
nano .opencode/agent/anr_truth_teller.md
nano .opencode/agent/truth_teller.md

# Verify all changes
npm run build
npm run lint
```

---

## Expected Outcomes

### Before Update
```
❌ Windows users:
  - Agent runs "find docs -name '*.md'"
  - Windows shell: "find: command not found"
  - Task fails
  
❌ Agent caution:
  - Agent sees bash restrictions: "ls", "find", "cat" denied
  - Agent lacks confidence to execute cross-platform work
  - Agent provides suggestions instead of implementation
```

### After Update
```
✅ All platforms:
  - Agent uses tool.glob("docs/**/*.md")
  - Works on Windows, macOS, Linux
  - Task succeeds
  
✅ Agent confidence:
  - Agent sees clear tool-based permissions
  - Agent knows which bash commands are allowed
  - Agent executes tasks directly (not suggestions only)
```

---

## Impact Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Platform Support** | Unix/Linux only | Windows, macOS, Linux |
| **File Operations** | Bash-dependent | Tool-based (universal) |
| **Git Operations** | Limited (denied) | Full (status, diff, add allowed) |
| **Agent Confidence** | Low (restrictions unclear) | High (clear permissions) |
| **Cross-Platform Users** | Blocked | Supported |
| **Future Maintenance** | Unix-specific logic | Platform-agnostic by default |

---

## FAQ

### Q: Will this slow down agents?

**A:** No. Using `tool.glob` is actually faster than bash `find` because it's optimized by the framework and doesn't spawn a subprocess.

### Q: What if I need platform-specific logic?

**A:** Document it in the agent instructions with examples. For most tasks, platform-independent tools are sufficient. Git provides portability across platforms when you need it.

### Q: Do I need to update Python/TypeScript language configurations?

**A:** No. Package managers like `npm`, `bun`, `python`, `cargo`, and `go` are already cross-platform. The framework will select the correct shell automatically.

### Q: What about Windows users who don't have Git Bash?

**A:** Git installs on Windows natively. Windows users can use PowerShell or cmd.exe directly. The framework detects `process.platform === "win32"` and provides the appropriate shell without requiring Git Bash.

### Q: Can agents detect their platform?

**A:** No, agents cannot directly access `process.platform`. Instead, they should:
1. Use platform-independent tools (preferred)
2. Use universal bash commands (git, language tools)
3. Accept that platform-specific commands will fail and let operators adjust

---

## Related Documents

- [CROSS_PLATFORM_AGENTS.md](CROSS_PLATFORM_AGENTS.md) — Comprehensive guide on cross-platform principles
- [AGENTS.md](AGENTS.md) — Project standards for agent configuration
- [Session Report 2026-07-01](./session-reports/2026-07-01-hardware-analysis.md) — Original analysis that triggered this update

---

## Next Steps

1. ✅ Review this document with the team
2. ⏳ Update agent configurations (1-2 hours)
3. ⏳ Test on Windows, macOS, Linux
4. ⏳ Update CONTRIBUTING.md with cross-platform standards
5. ⏳ Add automated validation to CI/CD pipeline
6. ⏳ Document in internal wiki/docs

---

**Document Version:** 1.0  
**Created:** 2026-07-02  
**Based on:** Session Report 2026-07-01 (Hardware Analysis)  
**Status:** Ready for Implementation
