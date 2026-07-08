# Windows Diagnostics

Use this folder for Windows startup crash diagnostics.

## Built-in Diagnostic Mode

Use the built-in CLI flag first:

```powershell
opencode --diagnostic
```

OpenCode prints a startup banner that shows the local diagnostics directory and app log file path.

Use the script in this folder as a fallback when a crash is too early or too unstable for in-process diagnostics.

If the crash happens after several minutes of normal use (not immediately at startup), use interactive mode.

## One-click collector

Run from repo root in PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\packages\anr-core\script\windows-diagnostics\collect-opencode-diagnostics.ps1
```

The script creates an `opencode-diagnostics-<timestamp>` folder in the current directory with:

- OpenCode version and binary resolution
- `opencode debug paths` output
- Verbose startup stderr capture over multiple attempts
- Environment snapshot with sensitive keys redacted
- Optional clean-environment probe
- Recent log file discovery from common Windows/XDG paths

## Delayed Crash Capture

Run the collector in interactive mode, then use OpenCode normally until it crashes or you exit:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\packages\anr-core\script\windows-diagnostics\collect-opencode-diagnostics.ps1 -InteractiveSession
```

This preserves normal terminal interaction and writes session timing and exit code into the diagnostics folder.

## Options

```powershell
# More retries
.\packages\anr-core\script\windows-diagnostics\collect-opencode-diagnostics.ps1 -Attempts 5

# Pass args to OpenCode after global flags
.\packages\anr-core\script\windows-diagnostics\collect-opencode-diagnostics.ps1 -RunArgs run,hello

# Interactive delayed-crash capture
.\packages\anr-core\script\windows-diagnostics\collect-opencode-diagnostics.ps1 -InteractiveSession

# Skip clean-environment probe
.\packages\anr-core\script\windows-diagnostics\collect-opencode-diagnostics.ps1 -SkipCleanEnvProbe

# Use explicit binary path
.\packages\anr-core\script\windows-diagnostics\collect-opencode-diagnostics.ps1 -OpencodePath C:\path\to\opencode.exe
```
