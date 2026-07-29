# Quick Reference: Cross-Platform Agent Configuration

**For:** Users with Windows, macOS, and Linux  
**Problem:** Agents using Unix-specific bash commands fail on Windows  
**Solution:** Use platform-independent tools + universal bash commands  
**Time to Fix:** 1-2 hours for all agents  

---

## The One-Line Answer

**Agents know which OS they're running on via automatic `process.platform` detection, but the configuration restricts them to Unix-only bash commands. Fix it by using framework tools instead.**

---

## Quick Configuration Fix

### Current (BROKEN on Windows)
```yaml
permission:
  bash:
    "ls *": allow           # ❌ Windows
    "find *": allow         # ❌ Windows
    "grep *": allow         # ❌ Windows
    "cat *": allow          # ⚠️  Unreliable
    "*": deny
```

### Fixed (Works Everywhere)
```yaml
tools:
  glob: true              # Replaces find/ls
  read: true              # Replaces cat
  grep: true              # Replaces grep/rg
  list: true              # Replaces ls/dir

permission:
  bash:
    "git *": allow        # Universal
    "npm *": allow        # Universal
    "*": deny
```

---

## Platform Detection in the Framework

| When? | Where? | How? | What's Detected? |
|-------|--------|------|------------------|
| Runtime | `packages/core/src/tool/bash.ts:48` | `process.platform` | win32, darwin, linux |
| On bash execution | shell selection | Checks `process.platform` | Picks cmd.exe or /bin/sh |
| On file ops | path handling | Converts paths for Windows | \ vs / |

---

## Tool Mapping: Replace Bash with Tools

| Old Bash Command | New Tool | Example |
|---|---|---|
| `ls -la docs/` | `tool.list` | `list("docs/")` |
| `find . -name "*.ts"` | `tool.glob` | `glob("**/*.ts")` |
| `cat file.md` | `tool.read` | `read("file.md")` |
| `grep "TODO" *` | `tool.grep` | `grep("TODO", ".")` |
| `mkdir -p a/b/c` | `tool.write` | Auto-creates via write |
| `sed 's/a/b/' file` | `tool.edit` | Edit line by line |

---

## Commands That Work Everywhere ✅

Keep these in bash permissions (they work on all platforms):

```yaml
permission:
  bash:
    # Git (universal, installed everywhere)
    "git status": allow
    "git log *": allow
    "git diff *": allow
    "git add *": allow
    "git show *": allow
    
    # Language tools (universal when installed)
    "npm *": allow
    "bun *": allow
    "python *": allow
    "cargo test *": allow
    "go test *": allow
    
    # Build systems (cross-platform by design)
    "cmake *": allow
    "ninja *": allow
    
    # Dangerous (deny everywhere)
    "git push": deny
    "git commit": deny
    "rm -rf *": deny
    "*": deny
```

---

## Commands That FAIL on Windows ❌

Remove these from agent bash permissions:

```yaml
# NEVER allow these - Unix-only:
"ls *"              → Use tool.list or tool.glob
"find *"            → Use tool.glob
"grep *"            → Use tool.grep
"rg *"              → Use tool.grep
"cat *"             → Use tool.read
"head *"            → Use tool.read
"tail *"            → Use tool.read
"mkdir -p *"        → Use tool.write
"sed *"             → Use tool.edit
"chmod *"           → Use tool.edit
"tree *"            → Use tool.glob
```

---

## Agent Instructions Template

Add this to each agent's markdown file:

```markdown
## Platform Compatibility

This agent works on **Windows, macOS, and Linux**.

### For File Operations: Use Tools (Not Bash)

| Need | Tool | Command |
|------|------|---------|
| List files | `tool.list` | `list("docs/")` |
| Find files | `tool.glob` | `glob("**/*.md")` |
| Read file | `tool.read` | `read("docs/api.md")` |
| Search files | `tool.grep` | `grep("TODO", "src/")` |
| Create/write | `tool.write` | Writes and creates dirs |
| Edit file | `tool.edit` | Edit lines safely |

### For Build/Test: Use Language Tools (Works Everywhere)

- `npm test` ✅ Cross-platform
- `bun test` ✅ Cross-platform
- `python script.py` ✅ Cross-platform
- `cargo test` ✅ Cross-platform
- `cmake --build .` ✅ Cross-platform
- `git status` ✅ Cross-platform

### Examples

❌ Wrong (Unix-only):
```
bash: find docs -name "*.md" -type f
bash: grep -r "deprecated" src/
bash: ls -la
```

✅ Right (Cross-platform):
```
tool.glob("docs/**/*.md")
tool.grep("deprecated", "src/")
tool.list(".")
```
```

---

## 3-Step Implementation

### Step 1: Edit Agent Config (5 min each)

```bash
nano .opencode/agent/documentation.md
```

Remove:
- `"ls *": allow`
- `"find *": allow`
- `"grep *": allow`
- `"cat *": allow`
- `"rg *": allow`

Keep:
- `"git status": allow`
- `"git diff *": allow`
- `"git log *": allow`
- `"git add *": allow`

Add: (if not present)
```yaml
tools:
  glob: true
  read: true
  grep: true
  list: true
  write: true
  edit: true
```

### Step 2: Update Agent Instructions (5 min each)

Add the Platform Compatibility section from the template above.

### Step 3: Test (10 min)

```bash
npm run build          # Check for syntax errors
npm run test           # Run tests
```

---

## Files to Update

1. `.opencode/agent/documentation.md` — ✅ PRIMARY (from session report)
2. `.opencode/agent/tester.md` — Has `ls`, `find`, `grep`, `rg`
3. `.opencode/agent/implementor.md` — Check for Unix-specific commands
4. `.opencode/agent/researcher.md` — Check for Unix-specific commands
5. `.opencode/agent/triage.md` — Check for Unix-specific commands
6. `.opencode/agent/truth_teller.md` — Check for Unix-specific commands
7. `.opencode/agent/ammo_team_lead.md` — Check for Unix-specific commands

---

## Before/After Examples

### Example 1: Documentation Agent Finding Files

**Before (Broken on Windows):**
```yaml
permission:
  bash:
    "find . -name '*.md'": allow
    "ls -la": allow
    "grep -r": allow
```

**After (Works Everywhere):**
```yaml
tools:
  glob: true  # Replaces find
  list: true  # Replaces ls
  grep: true  # Replaces grep

permission:
  bash:
    "git status": allow
    "git diff *": allow
    "*": deny
```

### Example 2: Test Agent Running Tests

**Before:**
```yaml
permission:
  bash:
    "find . -name '*.test.ts'": allow
    "grep -r 'describe'": allow
    "npm test": allow
```

**After:**
```yaml
tools:
  glob: true  # Find test files
  grep: true  # Search test patterns

permission:
  bash:
    "npm test": allow
    "npm test *": allow
    "bun test": allow
    "pytest": allow
    "git log": allow
    "*": deny
```

---

## Verification Checklist

For each agent, verify:

- [ ] No `ls *` in bash permissions
- [ ] No `find *` in bash permissions
- [ ] No `grep *` or `rg *` in bash permissions
- [ ] No `cat *` in bash permissions
- [ ] No `mkdir -p *` in bash permissions
- [ ] No `sed *` in bash permissions
- [ ] All bash commands work on macOS, Linux, AND Windows
- [ ] Description mentions cross-platform support
- [ ] Instructions include tool-based examples
- [ ] Git commands are allowed (for verification)
- [ ] Dangerous ops are denied (git push, rm -rf)

---

## FAQ

**Q: Does this slow down agents?**  
A: No. Tools like `glob` are faster than spawning bash subprocess.

**Q: Can agents detect their platform directly?**  
A: No. Use tool-based approach or document alternatives.

**Q: What if I need Windows-only logic?**  
A: Document it in instructions with examples for each platform.

**Q: Will existing agents break?**  
A: Only on Windows. Test on all three platforms.

**Q: How do I test this?**  
A: Run same test command on Windows, macOS, Linux.

---

## Key Principle

```
┌──────────────────────────────────────┐
│ TIER 1: Tools (BEST - Use This)      │
│ glob, read, grep, list, write, edit  │
│ ✅ Works everywhere automatically    │
└──────────────────────────────────────┘
          ↓ FALLBACK TO ↓
┌──────────────────────────────────────┐
│ TIER 2: Universal Commands (GOOD)    │
│ git, npm, python, cargo, cmake       │
│ ✅ Works everywhere if installed    │
└──────────────────────────────────────┘
          ↓ FALLBACK TO ↓
┌──────────────────────────────────────┐
│ TIER 3: Platform-Specific (AVOID)    │
│ ls, find, grep, mkdir -p, sed        │
│ ❌ Only works on Unix/Linux          │
└──────────────────────────────────────┘
```

**Use Tier 1 for 99% of agent tasks.**

---

## Related Documents

| Document | Purpose | Read When |
|----------|---------|-----------|
| [CROSS_PLATFORM_AGENTS.md](CROSS_PLATFORM_AGENTS.md) | Comprehensive guide | Need detailed explanation |
| [CROSS_PLATFORM_IMPLEMENTATION.md](CROSS_PLATFORM_IMPLEMENTATION.md) | Step-by-step instructions | Ready to implement |
| [HOW_AGENTS_DETECT_OS.md](HOW_AGENTS_DETECT_OS.md) | Technical deep-dive | Need to understand mechanics |
| [AGENTS.md](AGENTS.md) | Project standards | General reference |

---

## TL;DR Command Summary

```bash
# What agents currently use (BROKEN on Windows)
find src -name "*.ts"    # ❌
ls -la                   # ❌
grep -r "TODO"           # ❌
cat file.md              # ⚠️

# What agents should use (WORKS EVERYWHERE)
glob("src/**/*.ts")      # ✅
list(".")                # ✅
grep("TODO", "src/")     # ✅
read("file.md")          # ✅

# What bash can do (WORKS EVERYWHERE)
git status               # ✅
npm test                 # ✅
python script.py         # ✅
cargo test               # ✅
```

---

**Version:** 1.0  
**Last Updated:** 2026-07-02  
**Status:** Ready to Use  
**Implementation Effort:** 1-2 hours
