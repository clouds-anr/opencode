# Cross-Platform Agent Configuration Guide

## Executive Summary

Your agents currently run on a **single platform per session** — the OS where the agent is executed is detected via `process.platform`. However, your **bash command configurations are hardcoded for Unix-like systems**, making them fail on Windows. This guide explains the issue, how the framework handles it, and how to fix agent configurations for cross-platform support.

---

## 1. How Agents Know Which Environment They're In

### 1.1 Automatic Platform Detection

The opencode framework automatically detects the runtime platform:

```typescript
// packages/core/src/tool/bash.ts (line 48)
const defaultShell = () => (process.platform === "win32" ? (process.env.COMSPEC ?? "cmd.exe") : "/bin/sh")
```

**Platform Identifiers:**
- `"win32"` → Windows (cmd.exe or PowerShell)
- `"darwin"` → macOS (bash/zsh)
- `"linux"` → Linux (bash/sh)

### 1.2 Where Detection Happens

Platform detection occurs in multiple places throughout the codebase:

```typescript
// packages/core/src/shell.ts (line 35)
if (process.platform === "win32") {
  // Windows-specific logic
} else {
  // Unix-like logic
}

// packages/core/src/database/path.ts (line 6)
if (process.platform !== "win32") return input

// packages/core/src/filesystem/protected.ts (line 36)
if (process.platform === "darwin") return new Set(DARWIN_HOME)

// packages/core/src/pty.ts (line 206)
if (process.platform === "win32") {
  // Windows pseudo-terminal handling
}
```

### 1.3 What Agents Can't Access Directly

**Important:** Agent markdown files (`*.md`) cannot directly access `process.platform`. The agent runtime executes independently and doesn't expose environment detection directly. Instead, you must:

1. **Write platform-agnostic commands** — use tools that work everywhere
2. **Use cross-platform alternatives** — e.g., `git` instead of `ls`
3. **Provide fallback instructions** — guide agents on multi-platform execution
4. **Leverage tool abstractions** — read/write/grep tools are platform-agnostic

---

## 2. The Cross-Platform Problem

### 2.1 Current Issue: Unix-Only Bash Configuration

Your agent bash permissions look like this:

```yaml
permission:
  bash:
    "ls *": allow              # ❌ Windows: use 'dir' instead
    "cat *": allow             # ✅ Works everywhere (if cross-platform shell)
    "find *": allow            # ❌ Windows: no native 'find'
    "mkdir -p *": allow        # ❌ Windows: 'mkdir' without -p flag
    "grep *": allow            # ❌ Windows: no native 'grep'
    "rg *": allow              # ⚠️ Requires ripgrep binary on all platforms
    "*": deny
```

### 2.2 Platform-Specific Command Differences

| Task | macOS/Linux | Windows (cmd.exe) | Windows (PowerShell) | Git Bash | Recommendation |
|------|-------------|-------------------|----------------------|----------|---|
| List files | `ls -la` | `dir /s /b` | `Get-ChildItem` | `ls -la` | Use tool.glob or tool.read |
| List files (one per line) | `find . -type f` | `forfiles /s` | `Get-ChildItem -Recurse` | `find . -type f` | Use tool.glob |
| Create directory | `mkdir -p a/b/c` | `mkdir a\b\c` | `New-Item -Type Directory` | `mkdir -p a/b/c` | Use tool.write (creates dirs automatically) |
| Search in files | `grep -r "text" .` | `findstr /s "text" .` | `Select-String -Path` | `grep -r "text" .` | Use tool.grep |
| Environment variable | `$VAR` or `${VAR}` | `%VAR%` (cmd) or `$env:VAR` (PS) | `$env:VAR` | `$VAR` | Use `process.env.VAR` via script |
| Pipe output | `cmd1 \| cmd2` | `cmd1 \| cmd2` | `cmd1 \| cmd2` | `cmd1 \| cmd2` | ✅ Universally supported |
| Redirect output | `cmd > file` | `cmd > file` | `cmd > file` | `cmd > file` | ✅ Universally supported |
| Run executable | `./script.sh` | `script.bat` or `script.exe` | `./script.ps1` | `./script.sh` | Specify file extension |

### 2.3 Platform Detection Strategy

When an agent receives a bash command, the framework:

1. **Receives** the command string from the agent (e.g., `"ls -la"`)
2. **Detects** the runtime platform via `process.platform`
3. **Selects** the appropriate shell:
   - Windows: `cmd.exe` or `powershell.exe` (based on config)
   - macOS/Linux: `/bin/sh` or `/bin/bash`
4. **Executes** the command in that shell
5. **Returns** output to the agent

**The problem:** If you send `"ls -la"` to a Windows cmd.exe shell, it fails because `ls` doesn't exist.

---

## 3. Solutions for Cross-Platform Agents

### 3.1 RECOMMENDED: Use Platform-Agnostic Tools

The best approach is to **avoid bash entirely for filesystem operations** and use the built-in tools that are platform-independent:

```yaml
# ❌ NOT RECOMMENDED (Unix-only)
permission:
  bash:
    "find * -type f": allow
    "grep * -r": allow
    "ls -la": allow

# ✅ RECOMMENDED (Platform-independent)
tools:
  read: true        # Replaces 'cat' — works on all platforms
  glob: true        # Replaces 'find' — works on all platforms  
  grep: true        # Replaces 'grep'/'rg' — works on all platforms
  list: true        # Replaces 'ls'/'dir' — works on all platforms
  write: true       # Replaces 'mkdir' + write — creates dirs automatically
  edit: true        # Modifies files safely across all platforms
```

**Mapping Agent Needs:**

| Agent Need | Unix Command | Tool to Use |
|------------|---|---|
| List directory contents | `ls`, `find` | `tool.glob` or `tool.list` |
| Read file contents | `cat`, `head`, `tail` | `tool.read` |
| Search in files | `grep`, `rg` | `tool.grep` |
| Create files | `echo > file`, `touch` | `tool.write` |
| Create directories | `mkdir -p` | `tool.write` (auto-creates dirs) |
| View git status | `git status` | `tool.grep` to parse, or bash only on CI |
| Copy files | `cp` | `tool.read` + `tool.write` |

### 3.2 Bash Commands That Work Everywhere

If you absolutely need bash for specific tasks, use **commands that work across all platforms**:

```yaml
# ✅ These work on macOS, Linux, AND Windows (with any modern shell)
permission:
  bash:
    # Git commands — universally supported
    "git status": allow
    "git log *": allow
    "git diff *": allow
    "git add *": allow
    "git show *": allow
    
    # Package managers (when available)
    "npm *": allow           # Works on all platforms
    "bun *": allow           # Works on all platforms
    "python *": allow        # Works on all platforms
    
    # Pipes and redirects — universal
    "cat * | grep *": allow
    "find . | xargs *": allow
    
    # Dangerous: deny on all platforms
    "rm -rf *": deny
    "git push": deny
    "git commit": deny
    "*": deny
```

### 3.3 Platform-Specific Fallback Instructions

If agents need to execute platform-specific commands, provide explicit instructions:

```markdown
# Documentation Agent — Cross-Platform Instructions

## Directory Operations

**Goal:** List all markdown files in documentation/

**Implementation:**
- ✅ Use `tool.glob` with pattern `documentation/**/*.md` (recommended)
- ⚠️ Use bash only if absolutely necessary:
  ```bash
  # On macOS/Linux:
  find documentation -name "*.md" -type f
  
  # On Windows:
  forfiles /s /m "*.md" /c "cmd /c echo @file"
  ```

## Search Operations

**Goal:** Find all references to "deprecated" in code

**Implementation:**
- ✅ Use `tool.grep` with query "deprecated" (recommended — works everywhere)
- ⚠️ Use bash with 'git grep' (works if git is available):
  ```bash
  git grep "deprecated"
  ```

## Path Construction

**Goal:** Create nested directory structure

**Implementation:**
- ✅ Use `tool.write` to create files; directories are auto-created
- ⚠️ Use bash only if necessary:
  ```bash
  mkdir -p docs/api/v2/schemas
  ```

## Environment Detection in Agent

To make an agent aware of its platform in instructions:

```markdown
## Platform Awareness

When executing shell commands, remember:

- If you see an error like "command not found" (on Windows for Unix commands),
  switch to the Windows equivalent
- Prefer `tool.glob` over `find` commands
- Prefer `tool.grep` over grep/rg commands
- Prefer `tool.read` over `cat` commands
- Use `git` commands — they work on all platforms

**Example: List TypeScript files**
- ❌ `find src -name "*.ts"` (fails on Windows)
- ✅ Use `tool.glob` with pattern `src/**/*.ts`
- ⚠️ Use `git ls-files "*.ts"` if in a git repo
```

---

## 4. Recommended Agent Configuration Template

### 4.1 For Cross-Platform Documentation Agent

```yaml
---
description: >-
  Documentation specialist that works across Windows, macOS, and Linux.
  Owns technical documentation, architecture diagrams, and API docs.
mode: subagent
temperature: 0.2
tools:
  read: true        # ✅ Cross-platform file reading
  glob: true        # ✅ Cross-platform file discovery (replaces find/ls)
  grep: true        # ✅ Cross-platform text search (replaces grep/rg)
  list: true        # ✅ Cross-platform directory listing
  write: true       # ✅ Cross-platform file writing + mkdir -p
  edit: true        # ✅ Cross-platform file editing
  bash: true        # ⚠️ Use sparingly, only for git operations
  webfetch: true
  todoread: true
  todowrite: true
  skill: true
permission:
  bash:
    # Git operations — universally available
    "git status": allow
    "git log *": allow
    "git diff *": allow
    "git show *": allow
    "git add *": allow
    
    # Build tools that exist on all platforms (when installed)
    "cmake *": allow
    "java -jar *plantuml*.jar *": allow
    
    # Deny dangerous operations
    "git push": deny
    "git commit": deny
    "rm -rf *": deny
    "*": deny
---

# Documentation Agent — Cross-Platform

## Core Mission

Keep documentation synchronized with implementation across Windows, macOS, and Linux.

## Platform-Aware Tool Selection

| Task | Tool | Why |
|------|------|-----|
| Find files matching pattern | `tool.glob` | Works everywhere |
| Read file contents | `tool.read` | Works everywhere |
| Search in files | `tool.grep` | Works everywhere |
| Create/write files | `tool.write` | Auto-creates directories |
| Modify existing file | `tool.edit` | Works everywhere |
| Review git changes | `bash: git diff` | Git works on all platforms |

## Cross-Platform Examples

### Example 1: Find all markdown documentation files

```
# ❌ WRONG: Unix-specific
bash: find docs -name "*.md" -type f

# ✅ CORRECT: Works on all platforms
Use tool.glob with pattern: docs/**/*.md
```

### Example 2: Search for outdated API documentation

```
# ❌ WRONG: Unix-specific
bash: grep -r "deprecated" docs/

# ✅ CORRECT: Works on all platforms
Use tool.grep with query: "deprecated" in docs/
```

### Example 3: Review changes before documenting

```
# ✅ WORKS on all platforms (git is available everywhere)
bash: git diff src/api.ts

# Alternative if git is unavailable:
Use tool.read to compare before/after content
```

## Definition of Done

- All documentation changes verified with `git diff`
- PlantUML diagrams updated (if applicable)
- No Unix-specific commands in agent execution (except git)
- Changes work on Windows, macOS, and Linux
```

### 4.2 For Cross-Platform Test Agent

```yaml
---
description: >-
  Testing specialist across Windows, macOS, and Linux.
  Runs tests, validates coverage, prevents regressions.
mode: subagent
temperature: 0.2
tools:
  read: true
  glob: true
  grep: true
  list: true
  write: true
  edit: true
  bash: true
  webfetch: true
  todoread: true
  todowrite: true
  skill: true
permission:
  bash:
    # Test runners — language-specific, not OS-specific
    "npm test": allow
    "npm test *": allow
    "bun test": allow
    "bun test *": allow
    "pytest *": allow
    "cargo test *": allow
    "go test *": allow
    "cmake --build * --target test": allow
    "ctest *": allow
    
    # Git — for context and verification
    "git log *": allow
    "git diff *": allow
    "git show *": allow
    "git status": allow
    
    # Deny dangerous operations
    "git push": deny
    "git commit": deny
    "rm -rf *": deny
    "*": deny
---

# Tester Agent — Cross-Platform

## Platform Support

This agent works on Windows, macOS, and Linux by using language-specific test runners
that handle platform differences internally.

## Test Execution Strategy

- **TypeScript/JavaScript:** `npm test` or `bun test` (handles platform internally)
- **Python:** `pytest` (cross-platform)
- **Rust:** `cargo test` (cross-platform)
- **Go:** `go test` (cross-platform)
- **C++:** `cmake --build ... --target test` (cross-platform build system)

## Cross-Platform Constraints

✅ **These commands work everywhere:**
- Package manager commands: `npm`, `bun`, `python`, `cargo`, `go`
- Build systems: `cmake`, `ninja` (when configured properly)
- Git operations: `git log`, `git diff`

❌ **Avoid these (platform-specific):**
- `ls`, `find`, `cat` → Use `tool.glob`, `tool.read` instead
- `grep`, `rg` → Use `tool.grep` instead
- Direct filesystem operations → Use tools instead
```

---

## 5. How to Update Your Current Agents

### Step 1: Audit Current Configuration

For each agent file in `.opencode/agent/`:

```bash
# Look for Unix-specific commands:
grep -E "find|ls |grep|cat |rg " .opencode/agent/*.md
```

### Step 2: Replace with Tool-Based Equivalents

**Before:**
```yaml
permission:
  bash:
    "ls *": allow
    "find *": allow
    "grep *": allow
```

**After:**
```yaml
tools:
  list: true       # Replaces 'ls'
  glob: true       # Replaces 'find'
  grep: true       # Replaces 'grep'

permission:
  bash:
    # Only platform-agnostic commands
    "git *": allow
    "npm *": allow
    "*": deny
```

### Step 3: Update Agent Instructions

Add a section to each agent's markdown:

```markdown
## Platform Compatibility

This agent works on Windows, macOS, and Linux by using platform-independent tools:

- **File discovery:** `tool.glob` instead of `find` or `ls`
- **File reading:** `tool.read` instead of `cat`
- **Text search:** `tool.grep` instead of `grep`
- **Git operations:** Direct bash commands (git is cross-platform)

All file operations automatically work across platforms.
```

---

## 6. Environment Variables and Paths

### 6.1 Handling Paths

The framework normalizes paths automatically:

```typescript
// packages/core/src/fs-util.ts (line 212)
if (process.platform !== "win32") return p
// On Windows, converts paths automatically
```

**You don't need to worry about** `\` vs `/` — the tools handle it.

### 6.2 Handling Environment Variables

**In bash:**
```bash
# ❌ NOT cross-platform
echo $PATH        # Unix
echo %PATH%       # Windows cmd
echo $env:PATH    # Windows PowerShell

# ✅ Get environment via bash (shell-specific)
# The framework will pass it to the correct shell
```

**Better approach:** Have agents use relative paths and let tools resolve them.

---

## 7. Testing Your Cross-Platform Configuration

### 7.1 Test Checklist

For each agent, test these scenarios:

```bash
# On macOS/Linux:
npm run test -- -t "agent-name"

# On Windows (in CI or local):
npm run test -- -t "agent-name" --platform win32

# On Linux (in CI):
npm run test -- -t "agent-name" --platform linux
```

### 7.2 Command Validation

When an agent is about to run a bash command, verify:

```yaml
✓ Command works with /bin/sh (POSIX shell)
✓ Command works with cmd.exe (Windows)
✓ Command works with PowerShell (if applicable)
✓ No hardcoded paths (use relative paths)
✓ No platform-specific utilities (use language-specific tools)
```

### 7.3 Validation Script

Add to your test suite:

```typescript
// Verify agent configuration is cross-platform
function validateAgentConfig(config: AgentConfig) {
  const bashRules = config.permission.bash || {}
  
  const unixOnly = [
    "ls", "find", "cat", "grep", "rg", "mkdir -p",
    "sed", "awk", "cut", "tr", "sort", "uniq"
  ]
  
  for (const rule of Object.keys(bashRules)) {
    for (const cmd of unixOnly) {
      if (rule.includes(cmd) && cmd !== "git") {
        throw new Error(
          `Agent config includes Unix-specific command: ${rule}\n` +
          `Use tool.glob, tool.grep, tool.read instead`
        )
      }
    }
  }
}
```

---

## 8. Summary: Cross-Platform Best Practices

| Scenario | Solution | Why |
|----------|----------|-----|
| List files | Use `tool.glob` or `tool.list` | Works everywhere, no bash needed |
| Find files matching pattern | Use `tool.glob("pattern")` | Works everywhere, no bash needed |
| Read file contents | Use `tool.read` | Works everywhere, no bash needed |
| Search in files | Use `tool.grep` | Works everywhere, no bash needed |
| Create/modify files | Use `tool.write`/`tool.edit` | Auto-creates directories, works everywhere |
| Git operations | Use bash (git is universal) | Git works on all platforms where available |
| Package manager | Use bash (npm, bun, python, etc.) | Language tools handle platform differences |
| Build system | Use bash if configured cross-platform | cmake, ninja, cargo all cross-platform |
| Platform-specific logic | Document as alternative, suggest tools | Avoid if possible |

---

## 9. Common Cross-Platform Mistakes to Avoid

### ❌ Mistake 1: Using `find` for file discovery

```bash
# Fails on Windows
find src -name "*.ts" -type f
```

**✅ Fix:** Use `tool.glob`

### ❌ Mistake 2: Using `grep` for text search

```bash
# Fails on Windows
grep -r "TODO" src/
```

**✅ Fix:** Use `tool.grep`

### ❌ Mistake 3: Using `ls` for directory listing

```bash
# Fails on Windows
ls -la docs/
```

**✅ Fix:** Use `tool.list` or `tool.glob`

### ❌ Mistake 4: Using `cat` to read files

```bash
# May work but not guaranteed on all shells
cat packages.json
```

**✅ Fix:** Use `tool.read`

### ❌ Mistake 5: Using `mkdir -p` for directory creation

```bash
# Windows cmd.exe doesn't support -p flag
mkdir -p docs/api/v2
```

**✅ Fix:** Use `tool.write` which auto-creates directories

### ❌ Mistake 6: Hardcoding Unix paths

```bash
# Fails on Windows with backslashes
/home/user/project/file.ts
```

**✅ Fix:** Use relative paths, let framework resolve

---

## 10. Reference: Tool Capabilities

| Tool | Replaces | Works On | Use Case |
|------|----------|----------|----------|
| `tool.glob` | `find`, `ls` | All platforms | Find files matching pattern |
| `tool.list` | `ls`, `dir` | All platforms | List directory contents |
| `tool.read` | `cat`, `head`, `tail` | All platforms | Read file contents |
| `tool.grep` | `grep`, `rg` | All platforms | Search text in files |
| `tool.write` | `echo > file`, `touch` | All platforms | Create/write files (auto-creates dirs) |
| `tool.edit` | `sed`, `nano` | All platforms | Edit existing files |
| `bash` | Shell commands | All platforms | Use for git, build tools, test runners |

---

## Next Steps

1. **Audit all agent configurations** in `.opencode/agent/` for Unix-specific commands
2. **Replace with tool-based equivalents** for file operations
3. **Add cross-platform documentation** to agent instructions
4. **Test on Windows, macOS, and Linux** (or in CI)
5. **Update bash permissions** to only allow platform-agnostic commands
6. **Document platform constraints** for any remaining bash-based operations

For your specific case, update [documentation.md](.opencode/agent/documentation.md) following the template in Section 4.1.
