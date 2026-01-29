param (
    [string]$PiUser = "masal",
    [string]$PiHost = "192.168.100.6"
)

$RemotePath = "~/signage-player"
$LocalPath = "c:\Users\masal\.gemini\antigravity\scratch\digital-signage\player"

Write-Host "--- Digital Signage Player Deployment ---" -ForegroundColor Cyan
Write-Host "Target: ${PiUser}@${PiHost}:${RemotePath}" -ForegroundColor Gray

# 1. Check if files exist locally
$Files = @("player.py", "sync.py", "logger_service.py", "config.json")
foreach ($File in $Files) {
    if (-not (Test-Path "$LocalPath\$File")) {
        Write-Error "File not found: $LocalPath\$File"
        exit 1
    }
}

# 1.5 Pre-cleanup (Fix Permissions)
Write-Host "`n[0/3] Fixing permissions..." -ForegroundColor Yellow
$FixCmd = "ssh ${PiUser}@${PiHost} 'sudo rm -f ~/signage-player/logger_service.py'"
Invoke-Expression $FixCmd

# 2. Upload Files (SCP)
Write-Host "`n[1/3] Uploading files..." -ForegroundColor Yellow
$ScpCmd = "scp $LocalPath\player.py $LocalPath\sync.py $LocalPath\logger_service.py $LocalPath\config.json ${PiUser}@${PiHost}:${RemotePath}/"
Write-Host "Command: $ScpCmd"
Invoke-Expression $ScpCmd

if ($LASTEXITCODE -ne 0) {
    Write-Error "SCP failed. Please check your password and connection."
    exit 1
}

# 3. Restart Service (SSH)
Write-Host "`n[2/3] Restarting Player Service..." -ForegroundColor Yellow
$SshRestartCmd = "ssh ${PiUser}@${PiHost} 'sudo systemctl restart signage-player'"
Invoke-Expression $SshRestartCmd

# 4. Verify Status (SSH)
Write-Host "`n[3/3] Verifying Status & Logs..." -ForegroundColor Yellow
$SshStatusCmd = "ssh ${PiUser}@${PiHost} 'systemctl status signage-player --no-pager -n 10'"
Invoke-Expression $SshStatusCmd

Write-Host "`n--- Deployment Complete ---" -ForegroundColor Cyan
Write-Host "Please check the Dashboard to see if the device comes online."
