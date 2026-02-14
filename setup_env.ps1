
Write-Host "Setting up Digital Signage Environment..." -ForegroundColor Cyan

# 1. Web Environment
$WebEnvPath = ".\web\.env"
$WebExamplePath = ".\web\.env.example"

if (-not (Test-Path $WebEnvPath)) {
    if (Test-Path $WebExamplePath) {
        Copy-Item $WebExamplePath $WebEnvPath
        Write-Host "Created web/.env from example." -ForegroundColor Green
        Write-Host "⚠️  IMPORTANT: Please update web/.env with your real secrets (Database, NextAuth)." -ForegroundColor Yellow
    }
    else {
        Write-Host "Error: web/.env.example not found!" -ForegroundColor Red
    }
}
else {
    Write-Host "web/.env already exists. Skipping." -ForegroundColor Gray
}

# 2. Player Configuration
$PlayerConfigPath = ".\player\config.json"
$PlayerExamplePath = ".\player\config.example.json"

if (-not (Test-Path $PlayerConfigPath)) {
    if (Test-Path $PlayerExamplePath) {
        # Read example
        $Config = Get-Content $PlayerExamplePath | ConvertFrom-Json
        
        # Ensure token is empty for pairing flow
        $Config.device_token = ""
        
        # Write to actual config
        $Config | ConvertTo-Json -Depth 4 | Set-Content $PlayerConfigPath
        
        Write-Host "Created player/config.json (Pairing Mode)." -ForegroundColor Green
    }
    else {
        Write-Host "Error: player/config.example.json not found!" -ForegroundColor Red
    }
}
else {
    Write-Host "player/config.json already exists. Skipping." -ForegroundColor Gray
}

Write-Host "Environment setup complete!" -ForegroundColor Cyan
