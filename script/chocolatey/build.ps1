#!/usr/bin/env pwsh
# Build the opencode Chocolatey package.
# Usage: ./script/chocolatey/build.ps1 -Version <ver> -X64Url <url> -X64Sha256 <hash>
param(
  [Parameter(Mandatory)] [string] $Version,
  [Parameter(Mandatory)] [string] $X64Url,
  [Parameter(Mandatory)] [string] $X64Sha256
)

$ErrorActionPreference = 'Stop'
$outDir = Join-Path $PSScriptRoot "../../dist/chocolatey"
New-Item -ItemType Directory -Force "$outDir/tools" | Out-Null

# nuspec
[xml] $nuspec = [xml]::new()
$nuspec.LoadXml(@"
<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>opencode</id>
    <version>PLACEHOLDER</version>
    <authors>anomalyco</authors>
    <description>The open source AI coding agent for the terminal.</description>
    <projectUrl>https://opencode.ai</projectUrl>
    <licenseUrl>https://github.com/anomalyco/opencode/blob/dev/LICENSE</licenseUrl>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <tags>opencode ai cli coding-agent</tags>
  </metadata>
</package>
"@)
$nuspec.package.metadata.version = $Version
$nuspec.Save("$outDir/opencode.nuspec")

# install script
$installScript = @(
  "`$ErrorActionPreference = 'Stop'",
  "`$toolsDir = Split-Path -Parent `$MyInvocation.MyCommand.Definition",
  "Install-ChocolateyZipPackage ``",
  "  -PackageName 'opencode' ``",
  "  -UnzipLocation `$toolsDir ``",
  "  -Url64 '$X64Url' ``",
  "  -Checksum64 '$X64Sha256' ``",
  "  -ChecksumType64 'sha256'"
) -join "`n"
Set-Content "$outDir/tools/chocolateyInstall.ps1" $installScript

choco pack "$outDir/opencode.nuspec" --out "$outDir"
Write-Host "Built: $outDir/opencode.$Version.nupkg"
