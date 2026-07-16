<#
.SYNOPSIS
  Local test runner for packages/opencode that reproduces the CI test.yml
  environment on Windows, so a green local run tracks a green CI run.

.DESCRIPTION
  The GitHub `test` workflow does four things a naive `bun test` does not, all
  of which otherwise cause ~2-hour runs and dozens of 30s timeouts locally:

    1. Sets OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true on Windows. The
       native file watcher stalls the git/snapshot code paths, causing the
       whole test/snapshot suite to hang until the per-test timeout.
    2. Guarantees `rg` (ripgrep) is on PATH. Without it, the Ripgrep service
       tries to download + PowerShell-extract rg, hanging ripgrep tests ~30s.
    3. Splits the suite across parallel jobs instead of one giant process,
       avoiding resource exhaustion (hundreds of concurrent git subprocesses).
    4. Runs with GITHUB_ACTIONS=false.

  This script also scrubs OPENCODE_* / AGENT env vars so running it from inside
  an opencode session does not pollute test config (e.g. an injected
  default_agent), which produces spurious agent/config assertion failures.

  Groups mirror the windows-opencode-1..4 matrix entries in
  .github/workflows/test.yml. Keep them in sync if that file changes.

.PARAMETER Groups
  Which CI groups to run (1..4). Defaults to all.

.PARAMETER Parallel
  Run the selected groups concurrently (like CI's parallel jobs) instead of
  sequentially. Faster wall-clock; interleaved logs are written per-group.

.PARAMETER MaxWaitSeconds
  Per-group watchdog budget. bun test can keep the event loop alive after
  printing its summary (server tests); the watchdog kills it once the summary
  line appears or this budget elapses. Default 1500 (25 min, matches CI).

.PARAMETER ExtraArgs
  Extra args appended to every `bun test` invocation (e.g. -t "some filter").

.EXAMPLE
  pwsh packages/opencode/script/test-local.ps1
  pwsh packages/opencode/script/test-local.ps1 -Groups 4 -Parallel
  pwsh packages/opencode/script/test-local.ps1 -Groups 1 -ExtraArgs '-t','defaultAgent'
#>
[CmdletBinding()]
param(
  [ValidateRange(1, 4)]
  [int[]]$Groups = @(1, 2, 3, 4),
  [switch]$Parallel,
  [int]$MaxWaitSeconds = 1500,
  [string[]]$ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

# Package root is the parent of this script's directory (packages/opencode).
$PackageDir = Split-Path -Parent $PSScriptRoot

# CI matrix groups (windows-opencode-1..4 in .github/workflows/test.yml).
$GroupPaths = @{
  1 = @("test/cli", "test/acp", "test/account", "test/agent", "test/auth", "test/background")
  2 = @("test/session", "test/server", "test/v2", "test/tool", "test/mcp")
  3 = @("test/config", "test/plugin", "test/provider", "test/permission", "test/question",
        "test/project", "test/share", "test/skill", "test/event-manifest.test.ts",
        "test/permission-task.test.ts")
  4 = @("test/control-plane", "test/effect", "test/filesystem", "test/format", "test/git",
        "test/ide", "test/image", "test/installation", "test/lsp", "test/snapshot",
        "test/storage", "test/util", "test/patch")
}

function Write-Section($text) {
  Write-Host ""
  Write-Host "==== $text ====" -ForegroundColor Cyan
}

# --- Environment: match CI, remove local pollution -------------------------
Write-Section "Environment setup"

# Scrub opencode session pollution so config loading is deterministic.
$scrubbed = @()
Get-ChildItem env: | Where-Object { $_.Name -like "OPENCODE*" -or $_.Name -eq "AGENT" } | ForEach-Object {
  # Preserve the flags we intentionally set below.
  if ($_.Name -eq "OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER") { return }
  Remove-Item "env:$($_.Name)" -ErrorAction SilentlyContinue
  $scrubbed += $_.Name
}
if ($scrubbed.Count -gt 0) {
  Write-Host "Scrubbed $($scrubbed.Count) OPENCODE_*/AGENT env vars (avoids config pollution)."
}

$env:GITHUB_ACTIONS = "false"
$env:OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = "true"
Write-Host "GITHUB_ACTIONS=false"
Write-Host "OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true"

# ripgrep must be on PATH or ripgrep tests hang on the download path.
if (Get-Command rg -ErrorAction SilentlyContinue) {
  Write-Host "ripgrep: $((rg --version | Select-Object -First 1))"
} else {
  Write-Host "WARNING: 'rg' is NOT on PATH. Ripgrep tests will hang (~30s each)." -ForegroundColor Yellow
  Write-Host "         Install with:  choco install ripgrep -y" -ForegroundColor Yellow
}

# Git identity is required by snapshot/git tests.
if (-not (git config --global user.email)) {
  Write-Host "WARNING: git global user.email not set; git/snapshot tests may fail." -ForegroundColor Yellow
}

# --- Runner ----------------------------------------------------------------
# Runs one group under a watchdog. bun test may not exit after printing its
# summary (server tests keep the event loop alive), so we poll the log for the
# "Ran N tests" line and terminate once it appears. Returns a result hashtable.
function Invoke-Group {
  param([int]$Group, [string]$LogFile)

  $paths = $GroupPaths[$Group]
  $bunArgs = @("test", "--timeout", "30000") + $paths + $ExtraArgs

  if (Test-Path $LogFile) { Remove-Item $LogFile -Force }
  $errFile = "$LogFile.err"

  $proc = Start-Process -FilePath "bun" -ArgumentList $bunArgs -WorkingDirectory $PackageDir `
    -NoNewWindow -PassThru -RedirectStandardOutput $LogFile -RedirectStandardError $errFile

  $waited = 0
  $timedOut = $false
  $printedOut = 0
  $printedErr = 0
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 1
    $waited++

    # Live tail: stream any new lines from stdout then stderr to the console.
    $outLines = @(Get-Content $LogFile -ErrorAction SilentlyContinue)
    if ($outLines.Count -gt $printedOut) {
      $outLines[$printedOut..($outLines.Count - 1)] | ForEach-Object { Write-Host $_ }
      $printedOut = $outLines.Count
    }
    $errLines = @(Get-Content $errFile -ErrorAction SilentlyContinue)
    if ($errLines.Count -gt $printedErr) {
      $errLines[$printedErr..($errLines.Count - 1)] | ForEach-Object { Write-Host $_ }
      $printedErr = $errLines.Count
    }

    $summaryHit = (Select-String -Path $LogFile, $errFile -Pattern "^Ran .* tests across .* files" -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($summaryHit) {
      Start-Sleep -Seconds 2  # let it flush
      if (-not $proc.HasExited) { $proc.Kill() }
      break
    }
    if ($waited -ge $MaxWaitSeconds) {
      $timedOut = $true
      if (-not $proc.HasExited) { $proc.Kill() }
      break
    }
  }

  # Merge stderr into the main log for parsing/display.
  if (Test-Path $errFile) {
    Get-Content $errFile | Add-Content $LogFile
    Remove-Item $errFile -Force
  }

  $content = Get-Content $LogFile -ErrorAction SilentlyContinue
  $pass = 0; $fail = 0; $skip = 0
  $passMatch = ($content | Select-String -Pattern "^\s*(\d+)\s+pass"  | Select-Object -Last 1)
  $failMatch = ($content | Select-String -Pattern "^\s*(\d+)\s+fail"  | Select-Object -Last 1)
  $skipMatch = ($content | Select-String -Pattern "^\s*(\d+)\s+skip"  | Select-Object -Last 1)
  if ($passMatch) { $pass = [int]$passMatch.Matches[0].Groups[1].Value }
  if ($failMatch) { $fail = [int]$failMatch.Matches[0].Groups[1].Value }
  if ($skipMatch) { $skip = [int]$skipMatch.Matches[0].Groups[1].Value }

  return @{
    Group = $Group; Pass = $pass; Fail = $fail; Skip = $skip
    TimedOut = $timedOut; Log = $LogFile
    Failures = ($content | Select-String -Pattern "\(fail\)" | ForEach-Object { $_.Line.Trim() })
  }
}

$logDir = Join-Path $env:TEMP "opencode-test-local"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$results = @()

if ($Parallel) {
  Write-Section "Running groups $($Groups -join ', ') in PARALLEL"
  # Launch every group's `bun test` directly from THIS process (no Start-Job;
  # background job runspaces tear down the child process early). Then poll all
  # logs in one loop, killing each bun once its summary line appears — bun keeps
  # the event loop alive after printing results (server tests), so it won't exit
  # on its own.
  $running = @{}
  foreach ($g in $Groups) {
    $log = Join-Path $logDir "group-$g.log"
    $errFile = "$log.err"
    if (Test-Path $log) { Remove-Item $log -Force }
    if (Test-Path $errFile) { Remove-Item $errFile -Force }
    $bunArgs = @("test", "--timeout", "30000") + $GroupPaths[$g] + $ExtraArgs
    $proc = Start-Process -FilePath "bun" -ArgumentList $bunArgs -WorkingDirectory $PackageDir `
      -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError $errFile
    $running[$g] = @{ Proc = $proc; Log = $log; Err = $errFile; Done = $false; TimedOut = $false }
    Write-Host "Started group $g (pid $($proc.Id)) -> $log"
  }

  Write-Host "Running $($running.Count) group(s) concurrently; polling for completion..."
  $waited = 0
  while ($true) {
    $allDone = $true
    foreach ($g in $Groups) {
      $e = $running[$g]
      if ($e.Done) { continue }
      $summary = Select-String -Path $e.Log, $e.Err -Pattern "^Ran .* tests across .* files" -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($summary) {
        Start-Sleep -Seconds 2  # let it flush the summary
        if (-not $e.Proc.HasExited) { $e.Proc.Kill() }
        $e.Done = $true
      } elseif ($e.Proc.HasExited) {
        $e.Done = $true  # exited without a summary (crash/early-exit)
      } else {
        $allDone = $false
      }
    }
    if ($allDone) { break }
    Start-Sleep -Seconds 1
    $waited++

    # Heartbeat every 10s: per-group elapsed + pass/fail-so-far + current test file.
    if (($waited % 10) -eq 0) {
      Write-Host "--- progress @ ${waited}s ---" -ForegroundColor DarkGray
      foreach ($g in $Groups) {
        $e = $running[$g]
        if ($e.Done) { Write-Host ("  group {0}: done" -f $g) -ForegroundColor DarkGray; continue }
        $c = @(Get-Content $e.Log -ErrorAction SilentlyContinue) + @(Get-Content $e.Err -ErrorAction SilentlyContinue)
        $p = @($c | Select-String -Pattern "\(pass\)").Count
        $f = @($c | Select-String -Pattern "\(fail\)").Count
        $lastFile = ($c | Select-String -Pattern "\.test\.ts:" | Select-Object -Last 1)
        $where = if ($lastFile) { $lastFile.Line.Trim() } else { "starting..." }
        Write-Host ("  group {0}: {1} pass, {2} fail so far | {3}" -f $g, $p, $f, $where) -ForegroundColor DarkGray
      }
    }

    if ($waited -ge $MaxWaitSeconds) {
      foreach ($g in $Groups) {
        $e = $running[$g]
        if (-not $e.Done) { if (-not $e.Proc.HasExited) { $e.Proc.Kill() }; $e.TimedOut = $true; $e.Done = $true }
      }
      break
    }
  }

  foreach ($g in $Groups) {
    $e = $running[$g]
    if (Test-Path $e.Err) { Get-Content $e.Err | Add-Content $e.Log; Remove-Item $e.Err -Force }
    $content = Get-Content $e.Log -ErrorAction SilentlyContinue
    $pass = 0; $fail = 0; $skip = 0
    $pm = ($content | Select-String -Pattern "^\s*(\d+)\s+pass" | Select-Object -Last 1)
    $fm = ($content | Select-String -Pattern "^\s*(\d+)\s+fail" | Select-Object -Last 1)
    $sm = ($content | Select-String -Pattern "^\s*(\d+)\s+skip" | Select-Object -Last 1)
    if ($pm) { $pass = [int]$pm.Matches[0].Groups[1].Value }
    if ($fm) { $fail = [int]$fm.Matches[0].Groups[1].Value }
    if ($sm) { $skip = [int]$sm.Matches[0].Groups[1].Value }
    $ranOk = ($content | Select-String -Pattern "^Ran .* tests across .* files" | Select-Object -First 1)
    $results += @{
      Group = $g; Pass = $pass; Fail = $fail; Skip = $skip
      TimedOut = ($e.TimedOut -or -not $ranOk); Log = $e.Log
      Failures = ($content | Select-String -Pattern "\(fail\)" | ForEach-Object { $_.Line.Trim() })
    }
  }
} else {
  foreach ($g in $Groups) {
    Write-Section "Running group $g : $($GroupPaths[$g] -join ' ')"
    $log = Join-Path $logDir "group-$g.log"
    $results += Invoke-Group -Group $g -LogFile $log
  }
}

# --- Summary ---------------------------------------------------------------
Write-Section "Summary"
$totalPass = 0; $totalFail = 0; $totalSkip = 0; $anyTimeout = $false
foreach ($r in $results | Sort-Object { $_.Group }) {
  $status = if ($r.TimedOut) { "TIMED OUT" } elseif ($r.Fail -gt 0) { "FAIL" } else { "PASS" }
  $color = if ($r.TimedOut) { "Yellow" } elseif ($r.Fail -gt 0) { "Red" } else { "Green" }
  Write-Host ("Group {0}: {1,-9} {2} pass, {3} fail, {4} skip   (log: {5})" -f $r.Group, $status, $r.Pass, $r.Fail, $r.Skip, $r.Log) -ForegroundColor $color
  foreach ($f in $r.Failures) { Write-Host "    $f" -ForegroundColor Red }
  $totalPass += $r.Pass; $totalFail += $r.Fail; $totalSkip += $r.Skip
  if ($r.TimedOut) { $anyTimeout = $true }
}
Write-Host ""
Write-Host ("TOTAL: {0} pass, {1} fail, {2} skip" -f $totalPass, $totalFail, $totalSkip)

if ($anyTimeout) { Write-Host "One or more groups timed out." -ForegroundColor Yellow; exit 2 }
if ($totalFail -gt 0) { exit 1 }
Write-Host "All selected groups passed." -ForegroundColor Green
exit 0
