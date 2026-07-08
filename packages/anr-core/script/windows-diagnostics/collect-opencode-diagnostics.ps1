param(
  [string]$OpencodePath = "opencode.exe",
  [int]$Attempts = 3,
  [string[]]$RunArgs = @(),
  [switch]$SkipCleanEnvProbe,
  [switch]$InteractiveSession
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

function Invoke-Captured {
  param(
    [string]$Name,
    [scriptblock]$Script,
    [string]$OutputDir
  )

  $safe = ($Name -replace "[^a-zA-Z0-9._-]", "_")
  $outfile = Join-Path $OutputDir "$safe.txt"
  $exitFile = Join-Path $OutputDir "$safe.exitcode.txt"

  Write-Host "[$Name] -> $outfile"
  $result = & $Script 2>&1
  $result | Out-File -FilePath $outfile -Encoding utf8
  $LASTEXITCODE | Out-File -FilePath $exitFile -Encoding ascii
}

function Redact-Value {
  param(
    [string]$Name,
    [string]$Value
  )

  if ($Name -match "(?i)(token|secret|password|api[_-]?key|authorization|cookie|credential)") {
    return "<REDACTED>"
  }

  if ($null -eq $Value) {
    return ""
  }

  return $Value
}

if ($Attempts -lt 1) {
  throw "Attempts must be at least 1"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$root = Get-Location
$outputDir = Join-Path $root "opencode-diagnostics-$timestamp"
$null = New-Item -ItemType Directory -Path $outputDir -Force

$transcript = Join-Path $outputDir "transcript.txt"
Start-Transcript -Path $transcript -Force | Out-Null

try {
  Write-Step "Resolving OpenCode binary"
  $cmd = Get-Command $OpencodePath -ErrorAction Stop
  $cmd | Format-List * | Out-File -FilePath (Join-Path $outputDir "opencode-command.txt") -Encoding utf8

  Write-Step "Collecting shell and system context"
  [PSCustomObject]@{
    Timestamp = (Get-Date).ToString("o")
    PowerShellVersion = $PSVersionTable.PSVersion.ToString()
    PSEdition = $PSVersionTable.PSEdition
    Host = $Host.Name
    Platform = $PSVersionTable.Platform
    ProcessArchitecture = $env:PROCESSOR_ARCHITECTURE
    User = $env:USERNAME
    ComputerName = $env:COMPUTERNAME
    CurrentDirectory = (Get-Location).Path
  } | Format-List | Out-File -FilePath (Join-Path $outputDir "context.txt") -Encoding utf8

  Write-Step "Capturing environment (sensitive keys redacted)"
  Get-ChildItem Env: |
    Sort-Object Name |
    ForEach-Object {
      "{0}={1}" -f $_.Name, (Redact-Value -Name $_.Name -Value $_.Value)
    } | Out-File -FilePath (Join-Path $outputDir "environment.txt") -Encoding utf8

  Write-Step "Capturing key environment toggles"
  @(
    "HOME",
    "XDG_DATA_HOME",
    "XDG_CONFIG_HOME",
    "XDG_STATE_HOME",
    "LOCALAPPDATA",
    "APPDATA",
    "USERPROFILE",
    "TERM",
    "TERM_PROGRAM",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR"
  ) | ForEach-Object {
    "{0}={1}" -f $_, (Redact-Value -Name $_ -Value ([Environment]::GetEnvironmentVariable($_, "Process")))
  } | Out-File -FilePath (Join-Path $outputDir "environment-key-values.txt") -Encoding utf8

  Write-Step "Running OpenCode identity commands"
  Invoke-Captured -Name "opencode-version" -OutputDir $outputDir -Script {
    & $OpencodePath --version
  }
  Invoke-Captured -Name "opencode-debug-paths" -OutputDir $outputDir -Script {
    & $OpencodePath debug paths
  }

  if ($InteractiveSession) {
    Write-Step "Running interactive verbose session"
    $interactiveNotes = Join-Path $outputDir "interactive-session.txt"
    @(
      "Interactive mode enabled.",
      "Run started: $((Get-Date).ToString(\"o\"))",
      "Process command: $OpencodePath --print-logs --log-level DEBUG $($RunArgs -join ' ')",
      "Use OpenCode normally. When it crashes or you exit, the script will continue collecting logs."
    ) | Out-File -FilePath $interactiveNotes -Encoding utf8

    & $OpencodePath --print-logs --log-level DEBUG @RunArgs
    $interactiveExitCode = $LASTEXITCODE

    @(
      "Run ended: $((Get-Date).ToString(\"o\"))",
      "ExitCode: $interactiveExitCode"
    ) | Out-File -FilePath (Join-Path $outputDir "interactive-session-exit.txt") -Encoding utf8
  }
  else {
    Write-Step "Running verbose OpenCode startup attempts"
    for ($i = 1; $i -le $Attempts; $i++) {
      Invoke-Captured -Name "opencode-verbose-attempt-$i" -OutputDir $outputDir -Script {
        & $OpencodePath --print-logs --log-level DEBUG @RunArgs
      }
    }
  }

  if (-not $SkipCleanEnvProbe) {
    Write-Step "Running clean-env probe"
    $probeVars = @(
      "HOME",
      "XDG_DATA_HOME",
      "XDG_CONFIG_HOME",
      "XDG_STATE_HOME",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "ALL_PROXY",
      "SSL_CERT_FILE",
      "SSL_CERT_DIR"
    )
    $saved = @{}
    foreach ($name in $probeVars) {
      $saved[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
      [Environment]::SetEnvironmentVariable($name, $null, "Process")
    }

    try {
      Invoke-Captured -Name "opencode-clean-env-probe" -OutputDir $outputDir -Script {
        & $OpencodePath --print-logs --log-level DEBUG @RunArgs
      }
    }
    finally {
      foreach ($name in $probeVars) {
        [Environment]::SetEnvironmentVariable($name, $saved[$name], "Process")
      }
    }
  }

  Write-Step "Collecting recent log files"
  $home = [Environment]::GetFolderPath("UserProfile")
  $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
  $logCandidates = @(
    (Join-Path $home ".local\share\opencode\log"),
    (Join-Path $localAppData "opencode\log")
  )

  $logCandidates | Out-File -FilePath (Join-Path $outputDir "log-candidates.txt") -Encoding utf8

  $recent = @()
  foreach ($candidate in $logCandidates) {
    if (Test-Path $candidate) {
      $recent += Get-ChildItem -Path $candidate -Recurse -File -ErrorAction SilentlyContinue
    }
  }

  $recent |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 25 FullName, LastWriteTime, Length |
    Format-Table -AutoSize |
    Out-File -FilePath (Join-Path $outputDir "recent-log-files.txt") -Encoding utf8

  Write-Step "Writing run summary"
  @(
    "OpenCode diagnostics complete.",
    "Output directory: $outputDir",
    "Transcript: $transcript",
    "Attach the full folder contents to support/engineering."
  ) | Out-File -FilePath (Join-Path $outputDir "README.txt") -Encoding utf8

  Write-Host ""
  Write-Host "Diagnostics complete."
  Write-Host "Folder: $outputDir"
}
finally {
  Stop-Transcript | Out-Null
}
