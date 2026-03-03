# Build for Linux and deploy to WSL Ubuntu
$wslPath = "\\wsl.localhost\Ubuntu\home\donta"
$outputName = "claude-bedrock"

Write-Host "Building for Linux..." -ForegroundColor Cyan
$env:GOOS = "linux"
$env:GOARCH = "amd64"

go build -o $outputName ./cmd/main.go

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green

# Copy to WSL
Write-Host "Copying to WSL at $wslPath..." -ForegroundColor Cyan
Copy-Item -Path $outputName -Destination $wslPath -Force

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully deployed to WSL" -ForegroundColor Green
    Write-Host "Binary location: $wslPath\$outputName" -ForegroundColor Yellow
} else {
    Write-Host "Failed to copy to WSL" -ForegroundColor Red
    exit 1
}

# Clean up local binary
Remove-Item -Path $outputName -Force
Write-Host "Cleaned up local binary" -ForegroundColor Gray
