# How Agents Detect and Handle Different Operating Systems

## Architecture Overview

When an agent executes a command across Windows, macOS, and Linux, the opencode framework automatically handles platform detection and environment adaptation. This document explains the mechanism.

---

## 1. Platform Detection Mechanism

### 1.1 Automatic Detection Point

The platform is detected automatically when the agent runs, using Node.js's built-in `process.platform`:

```typescript
// From: packages/core/src/tool/bash.ts (line 48)
const defaultShell = () => (process.platform === "win32" ? (process.env.COMSPEC ?? "cmd.exe") : "/bin/sh")
```

**Platform Values:**
- `"win32"` → Windows (any version, 32/64-bit)
- `"darwin"` → macOS
- `"linux"` → Linux (any distribution)

### 1.2 When Detection Happens

Detection occurs **at runtime** in several layers:

#### Layer 1: Bash Tool Initialization (on first bash command)
```typescript
// packages/core/src/tool/bash.ts
yield* tools.register({
  [name]: Tool.make({
    execute: (input, context) =>
      Effect.gen(function* () {
        // ... when execute is called, platform is detected
        const shellPath = defaultShell()  // ← Platform detection happens here
        // Use appropriate shell for the platform
      })
  })
})
```

#### Layer 2: Shell Configuration (when shell.ts is loaded)
```typescript
// packages/core/src/shell.ts (line 35)
if (process.platform === "win32") {
  // Windows-specific shell configuration
  shell = "powershell.exe" or "cmd.exe"
} else {
  // Unix-like shell configuration
  shell = "/bin/bash" or "/bin/sh"
}
```

#### Layer 3: File System Operations (path handling)
```typescript
// packages/core/src/database/path.ts (line 6)
if (process.platform !== "win32") return input
// Windows: convert paths automatically
// Unix: return path as-is
```

---

## 2. Shell Selection Pipeline

### 2.1 Full Flow: Command Execution

```
┌─────────────────────────────────────────┐
│ Agent Issues Command                    │
│ bash: "git status"                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Framework Receives Command               │
│ Tool: bash                              │
│ Input: "git status"                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Detect Platform                          │
│ const platform = process.platform       │
│ → "win32" | "darwin" | "linux"          │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┬──────────┐
       │               │          │
       ▼               ▼          ▼
   Windows         macOS        Linux
   ├─ cmd.exe      ├─ bash      ├─ /bin/sh
   ├─ powershell   └─ zsh       └─ /bin/bash
   └─ git-bash
       │               │          │
       └───────┬───────┴──────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Execute in Selected Shell                │
│ /bin/sh -c "git status"  (Unix)         │
│ cmd.exe /c "git status"  (Windows)      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Return Output to Agent                  │
│ stdout: "On branch main..."             │
│ exitCode: 0                             │
└─────────────────────────────────────────┘
```

### 2.2 Code Execution Details

```typescript
// packages/core/src/tool/bash.ts
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    // ...
    yield* tools.register({
      [name]: Tool.make({
        execute: (input, context) =>
          Effect.gen(function* () {
            // 1. Detect platform
            const shell = defaultShell()  // ← Platform detection here
            // Returns: "cmd.exe" (Windows) or "/bin/sh" (Unix)
            
            // 2. Prepare command
            const command = input.command  // e.g., "git status"
            
            // 3. Get working directory
            const cwd = input.workdir ?? "."
            
            // 4. Execute with platform-specific shell
            const process = yield* ChildProcess.spawn(shell, [
              process.platform === "win32" ? "/c" : "-c",  // ← Flag for shell
              command
            ], {
              cwd: cwd,
              shell: false,  // We're providing the shell explicitly
            })
            
            // 5. Collect output
            const { stdout, stderr } = yield* ChildProcess.all(process)
            
            // 6. Return results to agent
            return {
              command,
              output: stdout || stderr,
              exitCode: process.exitCode
            }
          })
      })
    })
  })
)
```

---

## 3. Cross-Platform Command Handling

### 3.1 Commands That Work Everywhere

These commands work the same on all platforms because they're either:
- Part of the base operating system
- Installed by universal package managers
- Handled by wrapper scripts

```
✅ UNIVERSAL (work on Windows, macOS, Linux)

1. Git commands
   git status      → Works everywhere (git is installed)
   git log         → Git is universal
   git diff        → Platform-agnostic
   git add         → Universal

2. Language runtime commands
   npm test        → npm available on all platforms
   bun test        → bun available on all platforms
   python script.py → Python installed everywhere
   go test ./...   → Go compiler available everywhere
   cargo test      → Rust available everywhere

3. Build system commands (when configured cross-platform)
   cmake --build . → CMake is cross-platform by design
   ninja           → Ninja is cross-platform
   
4. Standard shell constructs
   cmd1 | cmd2     → Piping works on all platforms
   cmd > file      → Output redirection universal
   cmd 2>&1        → Error redirection universal
```

### 3.2 Commands That DON'T Work Everywhere

These commands are OS-specific and will fail on other platforms:

```
❌ UNIX-ONLY (fail on Windows)

ls -la          → Use: tool.list or tool.glob
find . -name    → Use: tool.glob
cat file        → Use: tool.read
grep -r text    → Use: tool.grep
sed 's/a/b/'    → Use: tool.edit
mkdir -p a/b/c  → Use: tool.write (auto-creates)
chmod +x file   → Use: tool.edit with permissions
rm -rf folder   → NEVER — dangerous

❌ WINDOWS-ONLY (fail on Unix)

dir /s          → Use: tool.list
findstr /s      → Use: tool.grep
type file.txt   → Use: tool.read
powershell -c   → Unix has no PowerShell native
net use         → Unix has no net command
```

---

## 4. How Agents Adapt to Platforms

### 4.1 Passive Adaptation (Framework Handles It)

The agent doesn't need to detect the platform — the framework does it automatically:

```markdown
# Agent Instruction Example

## Finding Files

The agent writes:
  "I'll use bash to find all TypeScript files."
  
But internally, the agent should use:
  tool.glob with pattern "src/**/*.ts"
  
This works because:
- macOS: glob uses /bin/sh to expand pattern
- Linux: glob uses /bin/sh to expand pattern  
- Windows: glob uses cmd.exe to expand pattern
- All return: ["src/a.ts", "src/b.ts", ...]

The agent doesn't need to know it's running on Windows!
```

### 4.2 Active Adaptation (Agent Awareness)

If an agent needs to be platform-aware, it can:

1. **Try universal command first**, fall back to platform-specific:
```
Agent strategy:
- Try: git status (works everywhere if git is installed)
- If that fails, fall back to tool.grep to search .git/HEAD
```

2. **Provide examples for different platforms** in output:
```markdown
To list files, you can:

Option 1 (Recommended): Use tool.glob pattern "docs/**/*.md"
  - Works on all platforms
  
Option 2 (If in bash): 
  - macOS/Linux: find docs -name "*.md" -type f
  - Windows: forfiles /s /m "*.md" /c "cmd /c echo @file"
  
Option 3 (If in git repo):
  - git ls-files "*.md"  (works everywhere)
```

---

## 5. Current Integration Points in Your Codebase

### 5.1 Where Platform Detection Happens

| File | Line | Purpose | Detection |
|------|------|---------|-----------|
| `packages/core/src/tool/bash.ts` | 48 | Shell selection | `process.platform === "win32"` |
| `packages/core/src/shell.ts` | 35 | Shell config | `process.platform === "win32"` |
| `packages/core/src/database/path.ts` | 6 | Path handling | `process.platform !== "win32"` |
| `packages/core/src/filesystem/protected.ts` | 36 | Protected paths | `process.platform === "darwin"` |
| `packages/core/src/pty.ts` | 206 | Pseudo-terminal | `process.platform === "win32"` |
| `packages/core/src/ripgrep/binary.ts` | 83 | Binary selection | `process.platform === "win32"` |
| `packages/core/src/npm.ts` | 42 | npm handling | `process.platform === "win32"` |
| `packages/core/src/util/wildcard.ts` | 13 | Path wildcard | `process.platform === "win32"` |
| `packages/cli/script/build.ts` | 46 | CLI build | `process.platform !== "win32"` |
| `packages/core/src/filesystem/watcher.ts` | 36 | File watcher | `process.platform` for binary selection |

### 5.2 User-Agent String Detection

For analytics, the framework also reports platform:

```typescript
// From various provider files
"User-Agent": `opencode/${InstallationVersion} (${os.platform()} ${os.release()}; ${os.arch()})`
```

This sends information like:
- `darwin` `22.5.0` (macOS 12.5)
- `win32` `10.0.19044` (Windows 10)
- `linux` `5.15.0` (Linux kernel)

---

## 6. Environment-Specific Behavior Matrix

### 6.1 Command Behavior Across Platforms

| Command | macOS | Linux | Windows | Notes |
|---------|-------|-------|---------|-------|
| `git status` | ✅ | ✅ | ✅ | Git is universal |
| `npm test` | ✅ | ✅ | ✅ | npm is cross-platform |
| `python script.py` | ✅ | ✅ | ✅ | Python is cross-platform |
| `ls -la` | ✅ | ✅ | ❌ | Unix-only, use tool.list |
| `find . -name "*.ts"` | ✅ | ✅ | ❌ | Unix-only, use tool.glob |
| `cat file` | ✅ | ✅ | ⚠️ | May work but not guaranteed |
| `grep -r "text"` | ✅ | ✅ | ❌ | Unix-only, use tool.grep |
| `mkdir -p a/b/c` | ✅ | ✅ | ❌ | Unix syntax, use tool.write |
| `rm -rf folder` | ✅ | ✅ | ❌ | NEVER — dangerous everywhere |
| `powershell -c` | ✅ | ❌ | ✅ | PowerShell on macOS now available |
| `cmd.exe /c` | ❌ | ❌ | ✅ | Windows cmd shell only |

### 6.2 Shell Selection Matrix

| Platform | env:COMSPEC | env:SHELL | Default | Used |
|----------|-------------|-----------|---------|------|
| macOS | ❌ | `/bin/bash` or `/bin/zsh` | `/bin/sh` | env:SHELL if set |
| Linux | ❌ | `/bin/bash` | `/bin/sh` | env:SHELL if set |
| Windows | `cmd.exe` or `powershell.exe` | ❌ | `cmd.exe` | env:COMSPEC |

**Code:**
```typescript
const defaultShell = () => 
  process.platform === "win32" 
    ? (process.env.COMSPEC ?? "cmd.exe") 
    : "/bin/sh"
```

---

## 7. How Agents Execute Commands

### 7.1 Example: Documentation Agent Finding Files

**What the agent requests:**
```markdown
Agent: "I need to find all markdown files to check for outdated documentation."
```

**How the framework handles it across platforms:**

**Option 1: Agent uses tool.glob (RECOMMENDED)**
```typescript
// Framework: Works on all platforms automatically
const files = yield* glob("docs/**/*.md")  // ← Platform abstraction
// macOS: /bin/sh handles glob expansion
// Linux: /bin/sh handles glob expansion
// Windows: cmd.exe handles glob expansion
// Returns: ["docs/api.md", "docs/guide.md", ...]
```

**Option 2: Agent uses bash find (UNIX-ONLY)**
```typescript
// Framework: Works only on macOS/Linux
bash: find docs -name "*.md" -type f
// ✅ macOS: /bin/sh -c "find docs -name '*.md' -type f"
// ✅ Linux: /bin/sh -c "find docs -name '*.md' -type f"
// ❌ Windows: cmd.exe /c "find docs -name "*.md" -type f"
//            → 'find' is not recognized as an internal or external command
```

**Option 3: Agent uses git (WORKS EVERYWHERE)**
```typescript
// Framework: Works on all platforms
bash: git ls-files "*.md"
// ✅ macOS: /bin/sh -c "git ls-files \"*.md\""
// ✅ Linux: /bin/sh -c "git ls-files \"*.md\""
// ✅ Windows: cmd.exe /c "git ls-files "*.md""
```

### 7.2 Shell Invocation Format

The framework invokes each shell with platform-specific flags:

```typescript
// macOS/Linux invocation
/bin/sh -c "git status"
        ↑    ↑
        sh   command option

// Windows invocation  
cmd.exe /c "git status"
        ↑    ↑
        cmd  command option
```

---

## 8. Debugging Cross-Platform Issues

### 8.1 How to Diagnose Platform-Specific Failures

When an agent command fails on one platform but works on another:

**Step 1: Identify the platform**
```
Error message patterns:
- "command not found" → Unix shell trying Unix command on Windows
- "is not recognized" → Windows shell trying Windows command
- "No such file or directory" → Path separator issue (\\ vs /)
```

**Step 2: Check command availability**
```
Failing command: bash: find docs -name "*.md"

Platform breakdown:
- macOS: ✅ find is in /usr/bin/find
- Linux: ✅ find is in /bin/find or /usr/bin/find
- Windows: ❌ find.exe is for older Windows utilities, not Unix find
```

**Step 3: Substitute with tool-based equivalent**
```
Instead of: bash: find docs -name "*.md" -type f
Use: tool.glob with pattern "docs/**/*.md"
```

**Step 4: Test on all platforms**
```
- Run on macOS
- Run on Linux (ideally different distribution)
- Run on Windows (cmd.exe and PowerShell)
```

### 8.2 Common Platform-Specific Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `find: command not found` | Running `find` on Windows | Use `tool.glob` |
| `'grep' is not recognized` | Running `grep` on Windows | Use `tool.grep` |
| `'ls' is not recognized` | Running `ls` on Windows | Use `tool.list` or `tool.glob` |
| `mkdir: cannot create 'a/b/c'` | Windows doesn't support `-p` flag | Use `tool.write` |
| `Path with backslash not found` | Path not normalized | Let framework handle paths |

---

## 9. Future Enhancements

### 9.1 Proposed: Platform-Aware Agent Instructions

```markdown
# Future Agent Feature: Platform Detection

When we implement direct platform detection for agents:

## Example: Future Agent Capability

```
Agent instruction in future:
  "If running on Windows (detected platform), use dir instead of ls"

Code:
  platform = DETECT_PLATFORM()
  if platform == "win32":
    bash: dir /s /b
  else:
    bash: ls -R
```

Currently, this is NOT available. Instead, agents must:
- Use tool-based equivalents (recommended)
- Use universal commands like git
```

### 9.2 Proposed: Platform-Specific Tool Aliases

```yaml
# Potential future configuration
permission:
  bash:
    list_files:
      darwin: "ls -la"
      linux: "ls -la"
      win32: "dir /s /b"
      
# This would allow: bash: list_files "docs/"
# Framework would select the right command based on platform
```

---

## 10. Summary: Platform Abstraction Model

Your agents don't need to know which OS they're running on if they follow this hierarchy:

```
┌─────────────────────────────────────────┐
│ TIER 1: Framework Tools (BEST)          │
│ tool.glob, tool.read, tool.grep, etc.   │
│ ✅ Works everywhere automatically       │
│ ✅ No agent configuration needed        │
│ ✅ No platform detection required       │
└─────────────────────────────────────────┘
                  ↑
        Use this tier 99% of the time


┌─────────────────────────────────────────┐
│ TIER 2: Universal Commands (GOOD)       │
│ git, npm, python, cargo, go, cmake      │
│ ✅ Works on all platforms               │
│ ⚠️ Only if tool available               │
│ ✅ No platform detection in agent       │
└─────────────────────────────────────────┘
                  ↑
        Use this tier for build/test


┌─────────────────────────────────────────┐
│ TIER 3: Platform-Specific (AVOID)       │
│ ls, find, grep, mkdir -p, sed, awk      │
│ ❌ Fails on other platforms             │
│ ⚠️ Requires agent platform awareness    │
│ ❌ Not recommended for shared agents    │
└─────────────────────────────────────────┘
                  ↑
        Use only for platform-locked work
```

---

**Document Version:** 1.0  
**Audience:** Agent Configuration Maintainers, Framework Developers  
**Related:** CROSS_PLATFORM_AGENTS.md, CROSS_PLATFORM_IMPLEMENTATION.md
