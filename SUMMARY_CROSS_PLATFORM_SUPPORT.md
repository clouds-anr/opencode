# Summary: Agent Cross-Platform Support

**Date:** 2026-07-02  
**In Response To:** Session Report 2026-07-01 (Hardware Analysis)  
**Status:** Documentation Complete — Ready for Implementation

---

## What You Asked

> "I have users that run Windows, Linux and Mac. How do the agents know which commands to use for which environments and how would we adjust the agents to allow these operations for all 3 environments?"

---

## What We Found

### Root Cause
Your agents are configured with **Unix-only bash commands** (`ls`, `find`, `grep`, `cat`) that fail on Windows. Agents cannot detect their platform directly; they rely on configuration.

### How Agents Know Their Environment
The framework automatically detects `process.platform` at runtime:
- **Windows:** `"win32"` → Uses `cmd.exe`
- **macOS:** `"darwin"` → Uses `/bin/sh` or `/bin/bash`
- **Linux:** `"linux"` → Uses `/bin/sh` or `/bin/bash`

The agent **doesn't** need to know this if you use:
1. **Framework tools** (glob, read, grep, list, write, edit) — work everywhere
2. **Universal commands** (git, npm, python, cargo, cmake) — work everywhere
3. Avoid Unix-specific commands (find, ls, grep in bash)

---

## How to Fix It

### TL;DR
Replace Unix-only bash commands with framework tools:

```yaml
# ❌ BEFORE (Unix-only, fails on Windows)
permission:
  bash:
    "ls *": allow
    "find *": allow
    "grep *": allow

# ✅ AFTER (Cross-platform, works everywhere)
tools:
  glob: true    # Replaces find
  list: true    # Replaces ls
  grep: true    # Replaces grep
```

### Detailed Steps
See **CROSS_PLATFORM_IMPLEMENTATION.md** for specific agent config changes.

---

## Key Principle

```
TIER 1: Framework Tools (Use This 99% of the time)
├─ tool.glob("pattern")           → finds files
├─ tool.list("dir")               → lists directory
├─ tool.read("file")              → reads file
├─ tool.grep("text", "dir")       → searches text
├─ tool.write("file", "content")  → writes file + creates dirs
└─ tool.edit("file", "changes")   → edits file

TIER 2: Universal Commands (Use for build/test)
├─ git status, git diff, git add  → Git is universal
├─ npm test, bun test             → Language tools
├─ python script.py               → Language tools
├─ cargo test                      → Language tools
└─ cmake --build .                → Build system

TIER 3: Platform-Specific (AVOID)
├─ ls, find, grep, rg             → Unix-only, fails on Windows
├─ mkdir -p, sed, awk             → Unix-only, fails on Windows
├─ rm -rf, chmod                  → Unix-only, fails on Windows
└─ cmd.exe, powershell.exe        → Windows-only, fails on Unix
```

---

## Documents Created

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[CROSS_PLATFORM_QUICK_REFERENCE.md](CROSS_PLATFORM_QUICK_REFERENCE.md)** | Quick reference, immediate use | Start here — 5 min read |
| **[CROSS_PLATFORM_AGENTS.md](CROSS_PLATFORM_AGENTS.md)** | Comprehensive guide with principles | Need detailed explanation — 30 min |
| **[CROSS_PLATFORM_IMPLEMENTATION.md](CROSS_PLATFORM_IMPLEMENTATION.md)** | Step-by-step implementation | Ready to implement — 20 min |
| **[HOW_AGENTS_DETECT_OS.md](HOW_AGENTS_DETECT_OS.md)** | Technical deep-dive | Need technical details — 45 min |

---

## What Changed in Your Agents

### Before (Session Report Issue)
```yaml
# documentation_maintainer.md (BROKEN on Windows)
permission:
  bash:
    allow:
      - "ls *"        # ❌ No ls on Windows
      - "cat *"       # ⚠️  Unreliable
      - "find *"      # ❌ No find on Windows
    deny:
      - "*"           # ❌ Very restrictive
```

**Result:** 
- ✅ Works on macOS/Linux
- ❌ Fails on Windows
- ❌ Agent lacks confidence (permissions too restrictive)

### After (Recommended)
```yaml
# documentation_maintainer.md (WORKS EVERYWHERE)
tools:
  glob: true          # ✅ Cross-platform file finding
  read: true          # ✅ Cross-platform file reading
  grep: true          # ✅ Cross-platform text search
  list: true          # ✅ Cross-platform directory listing
  write: true         # ✅ Creates files + auto mkdir
  edit: true          # ✅ Safe file editing

permission:
  bash:
    # Universal operations
    "git status": allow
    "git diff *": allow
    "git add *": allow
    "git log *": allow
    "plantuml *": allow
    "java -jar *": allow
    
    # Deny dangerous
    "git push": deny
    "git commit": deny
    "*": deny
```

**Result:**
- ✅ Works on Windows, macOS, Linux
- ✅ Agent has clear permissions
- ✅ File operations are tool-based (not bash)
- ✅ Git operations are universal

---

## What Needs to Be Done

### Immediate (1-2 hours total)
1. Update `.opencode/agent/documentation.md` 
2. Update `.opencode/agent/tester.md`
3. Review/update other agents (implementor, researcher, triage, truth_teller, ammo_team_lead)
4. Run `npm run build` to verify syntax
5. Test on all three platforms (Windows, macOS, Linux)

### Follow-Up (Optional)
- Add platform compatibility notes to CONTRIBUTING.md
- Create automated validation in CI/CD
- Document platform-specific constraints for future agents

---

## Real-World Example: Your Session Report

From your session report, the documentation agent needs to:

1. **Find hardware component files** 
   - ❌ Currently: `bash: find . -name "*.hpp"` (fails on Windows)
   - ✅ Instead: `tool.glob("**/*.hpp")` (works everywhere)

2. **Read file contents for documentation**
   - ❌ Currently: `bash: cat hardware_info.hpp` (unreliable)
   - ✅ Instead: `tool.read("hardware_info.hpp")` (works everywhere)

3. **Search for existing documentation patterns**
   - ❌ Currently: `bash: grep -r "///\*\*" .` (fails on Windows)
   - ✅ Instead: `tool.grep("///\\*\\*", ".")` (works everywhere)

4. **Review and stage changes**
   - ✅ Still works: `bash: git diff`, `bash: git add` (universal)
   - ✅ Permitted: Continue using git for verification

---

## Platform Detection Under the Hood

```typescript
// Framework detects at runtime (packages/core/src/tool/bash.ts:48)
const defaultShell = () => 
  process.platform === "win32" 
    ? (process.env.COMSPEC ?? "cmd.exe")  // Windows
    : "/bin/sh"                            // macOS/Linux

// When agent issues command:
1. Framework receives: bash: "git status"
2. Detects: process.platform → "win32" | "darwin" | "linux"
3. Selects: cmd.exe or /bin/sh
4. Executes: cmd.exe /c "git status" or /bin/sh -c "git status"
5. Returns: Output to agent
```

**Your agents don't need to detect this—the framework handles it automatically.**

---

## FAQ

**Q: Why do agents fail on Windows?**  
A: Unix commands like `find`, `ls`, `grep` don't exist in cmd.exe. Use tools instead.

**Q: Does the framework know it's running on Windows?**  
A: Yes, via `process.platform === "win32"`. It selects the correct shell automatically.

**Q: Why can't agents detect their platform?**  
A: Agent markdown files execute independently. They can't call `process.platform` directly. Instead, use platform-independent tools.

**Q: Will changing this break existing workflows?**  
A: No. Tools are faster and more reliable. Bash commands that fail will work via tools instead.

**Q: Do I need Git Bash on Windows?**  
A: No. Native Git for Windows works with cmd.exe. Framework handles it automatically.

**Q: What about CI/CD?**  
A: Test on all platforms (Windows, macOS, Linux) in CI. Use cross-platform tools/commands.

**Q: Can I still use bash for complex scripts?**  
A: Yes, for universal commands (git, npm, build tools). Avoid Unix-specific utilities.

---

## Impact Assessment

### Scope
- **Affected:** All 7 agent configurations
- **Effort:** 1-2 hours to update all
- **Risk:** Low (changes are additive; old restrictions removed)
- **Benefit:** Windows users now supported

### Testing Checklist
- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] Tests pass: `npm run test`
- [ ] Works on macOS
- [ ] Works on Linux
- [ ] Works on Windows (cmd.exe)
- [ ] Works on Windows (PowerShell)
- [ ] Git commands work on all platforms
- [ ] Tools are used for file operations

### Validation Commands
```bash
# Verify configuration
npm run build

# Run tests
npm run test

# Test specific agent
npm run test -- -t "documentation_agent"

# Check for platform issues
grep -r "ls \*\|find \*\|grep \*\|cat \*" .opencode/agent/
```

---

## Migration Path

### Phase 1: Documentation (COMPLETE ✅)
- Created 4 comprehensive guides
- Explained platform detection mechanism
- Provided implementation steps
- You are here

### Phase 2: Implementation (TODO)
- Update agent configurations (1 hour)
- Test on Windows, macOS, Linux (30 min)
- Commit changes (10 min)

### Phase 3: Adoption (TODO)
- Train team on cross-platform best practices
- Add to CONTRIBUTING.md
- Implement automated validation

---

## Recommended Next Steps

1. **Read** [CROSS_PLATFORM_QUICK_REFERENCE.md](CROSS_PLATFORM_QUICK_REFERENCE.md) (5 min)
2. **Implement** changes per [CROSS_PLATFORM_IMPLEMENTATION.md](CROSS_PLATFORM_IMPLEMENTATION.md) (1 hour)
3. **Test** on all three platforms (30 min)
4. **Commit** with message: `chore: Make agents cross-platform (Windows/macOS/Linux)`
5. **Document** in CONTRIBUTING.md (optional, 15 min)

---

## Key Takeaway

```
Agents don't see the OS.
The framework detects it and picks the right shell.
Your job: Use platform-independent tools (not bash) 
for file operations, and universal commands for build/test.

Rule of thumb:
- File operations → Use tools
- Build/test → Use language-specific commands
- Verification → Use git (it's universal)
- Avoid → Unix-specific utilities
```

---

## Success Criteria

When complete, your agents will:

✅ **Work on Windows**  
✅ **Work on macOS**  
✅ **Work on Linux**  
✅ **Automatically detect and use correct shell**  
✅ **Have clear, consistent permissions**  
✅ **Include platform-aware instructions**  
✅ **Support all user platforms equally**

---

## Questions?

Refer to the detailed documents:
- **General questions:** CROSS_PLATFORM_AGENTS.md
- **"How do I do X?":** CROSS_PLATFORM_QUICK_REFERENCE.md
- **"How do I implement?":** CROSS_PLATFORM_IMPLEMENTATION.md
- **"How does it work?":** HOW_AGENTS_DETECT_OS.md
- **Project standards:** AGENTS.md

---

**Document Version:** 1.0  
**Created:** 2026-07-02  
**Status:** Ready for Implementation  
**Estimated Time to Complete:** 1-2 hours
