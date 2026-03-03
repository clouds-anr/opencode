# Build and copy claude-bedrock.exe and env.bedrock to the sandbox folder
# Usage: Run this script from the project root in PowerShell

$ErrorActionPreference = 'Stop'


# Set output and sandbox paths
$projectRoot = $PSScriptRoot
$sandbox = "C:\Users\DontaDalpoas\OneDrive - Alaska Northstar Resources LLC\Desktop\SandboxFiles"

# Ensure sandbox directory exists
if (-not (Test-Path $sandbox)) {
    New-Item -ItemType Directory -Path $sandbox | Out-Null
}

# Build the executable (overwrite if exists)
Write-Host "Building claude-bedrock.exe... (overwriting if exists)"
if (Test-Path "$sandbox\claude-bedrock.exe") {
    Remove-Item "$sandbox\claude-bedrock.exe" -Force
}
go build -o "$sandbox\claude-bedrock.exe" "$projectRoot\cmd\main.go"

# Copy env.bedrock (overwrite if exists)
Write-Host "Copying env.bedrock to sandbox... (overwriting if exists)"
if (Test-Path "$sandbox\env.bedrock") {
    Remove-Item "$sandbox\env.bedrock" -Force
}
Copy-Item -Path "$projectRoot\env.bedrock" -Destination "$sandbox\env.bedrock" -Force

# Create startup script for sandbox
Write-Host "Creating sandbox startup script..."
$startupScript = @"
Set-Location C:\Users\WDAGUtilityAccount\Desktop\SandboxFiles
Write-Host "Welcome to Windows Sandbox!" -ForegroundColor Green
Write-Host "Current directory: `$PWD" -ForegroundColor Cyan
"@
Set-Content -Path "$sandbox\sandbox-startup.ps1" -Value $startupScript -Force

Write-Host "Done. Files are in $sandbox"
