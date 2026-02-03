param(
    [string]$PlayerIp,
    [string]$PlayerUser
)


if ([string]::IsNullOrEmpty($PlayerIp)) {
    $PlayerIp = Read-Host "Enter Player IP Address (e.g. 192.168.1.100)"
}

if ([string]::IsNullOrEmpty($PlayerUser)) {
    $PlayerUser = Read-Host "Enter Player Username (e.g. pi, masal)"
}

$User = $PlayerUser

$TargetDir = "~/signage-player"

Write-Host "Deploying to $User@$PlayerIp..." -ForegroundColor Cyan

# Copy files
scp .\player\player.py .\player\sync.py .\player\setup_timezone.sh .\player\debug_player.py .\player\rotation_utils.py .\player\fix_rotation_boot.sh "$User@$PlayerIp`:$TargetDir"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Files transferred successfully." -ForegroundColor Green
    
    # Restart Service
    Write-Host "Attempting to restart signage-player service..." -ForegroundColor Cyan
    ssh "$User@$PlayerIp" "sudo systemctl restart signage-player"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Service restarted." -ForegroundColor Green
    }
    else {
        Write-Host "Could not restart service automatically. You may need to restart the device manually." -ForegroundColor Yellow
    }
}
else {
    Write-Host "File transfer failed. Check IP address and connection." -ForegroundColor Red
}
