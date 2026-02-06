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
scp .\player\player.py .\player\sync.py .\player\setup_timezone.sh .\player\debug_player.py .\player\rotation_utils.py .\player\fix_rotation_boot.sh .\player\setup_service.sh .\player\logger_service.py .\player\config.json .\player\install_dependencies.sh "$User@$PlayerIp`:$TargetDir"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Files transferred successfully." -ForegroundColor Green
    
    # Make scripts executable
    ssh "$User@$PlayerIp" "chmod +x $TargetDir/setup_service.sh $TargetDir/install_dependencies.sh"

    # Install Dependencies
    Write-Host "Installing/Verifying Dependencies (this may take a minute)..." -ForegroundColor Cyan
    ssh "$User@$PlayerIp" "bash $TargetDir/install_dependencies.sh"

    # Restart Service
    Write-Host "Attempting to restart signage-player service..." -ForegroundColor Cyan
    ssh "$User@$PlayerIp" "sudo systemctl restart signage-player"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Service restarted." -ForegroundColor Green
    }
    else {
        Write-Host "Service restart failed. Service might not be installed." -ForegroundColor Yellow
        Write-Host "Attempting to install service via setup_service.sh..." -ForegroundColor Cyan
        
        # Run setup_service.sh
        ssh "$User@$PlayerIp" "bash $TargetDir/setup_service.sh"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Service installed and started successfully." -ForegroundColor Green
        }
        else {
            Write-Host "Failed to install service." -ForegroundColor Red
        }
    }
}
else {
    Write-Host "File transfer failed. Check IP address and connection." -ForegroundColor Red
}
