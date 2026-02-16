param(
    [string]$PlayerIp,
    [string]$PlayerUser,
    [switch]$ForceConfigSync
)


if ([string]::IsNullOrEmpty($PlayerIp)) {
    $PlayerIp = Read-Host "Enter Player IP Address (e.g. 192.168.1.100)"
}

if ([string]::IsNullOrEmpty($PlayerUser)) {
    $PlayerUser = Read-Host "Enter Player Username (e.g. pi, masal)"
}


# --- Auto-Setup & Configuration Check ---
$HelpersPath = ".\player\config.json"
if (-not (Test-Path $HelpersPath)) {
    Write-Host "Configuration not found. Running initial setup..." -ForegroundColor Yellow
    
    # Run setup to create base files
    if (Test-Path ".\setup_env.ps1") {
        & ".\setup_env.ps1"
    }
    else {
        Write-Host "Error: setup_env.ps1 not found!" -ForegroundColor Red
        exit 1
    }

    # Prompt for Server URL
    Write-Host "`nSelect Server URL for the Player:" -ForegroundColor Cyan
    Write-Host "1. Vercel Production (Default)" -ForegroundColor Gray
    Write-Host "2. Localhost (http://localhost:3000)" -ForegroundColor Gray
    Write-Host "3. Custom URL" -ForegroundColor Gray
    
    $Selection = Read-Host "Enter choice [1/2/3] (Press Enter for Default)"
    
    $ServerUrl = "https://signage-repo-dc5s.vercel.app" # Default
    
    switch ($Selection) {
        "2" { $ServerUrl = "http://localhost:3000" }
        "3" { $ServerUrl = Read-Host "Enter Custom URL" }
    }
    
    # Update config.json with selected URL
    try {
        $Config = Get-Content $HelpersPath | ConvertFrom-Json
        $Config.server_url = $ServerUrl
        $Config | ConvertTo-Json -Depth 4 | Set-Content $HelpersPath
        Write-Host "Updated config.json with Server URL: $ServerUrl" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to update config.json: $_" -ForegroundColor Red
    }
}

# --- Deployment Logic ---
$User = $PlayerUser


Write-Host "Resolving remote home directory..." -ForegroundColor Cyan
# Use single-quoted PowerShell string to avoid interpolation/escaping issues
$RemoteHome = ssh "$User@$PlayerIp" 'printf "%s" "$HOME"'
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($RemoteHome)) {
    Write-Host "Failed to resolve remote home directory. Check SSH connectivity." -ForegroundColor Red
    exit 1
}
$RemoteHome = $RemoteHome.Trim()
$TargetDir = "$RemoteHome/signage-player"

Write-Host "Deploying to $User@$PlayerIp..." -ForegroundColor Cyan
Write-Host "Target directory: $TargetDir" -ForegroundColor DarkGray

# Ensure target directory exists
ssh "$User@$PlayerIp" "mkdir -p $TargetDir"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create target directory on remote host." -ForegroundColor Red
    exit 1
}

# Copy files (preserve remote config.json by default to avoid resetting pairing)
$FilesToCopy = @(
    ".\player\player.py",
    ".\player\sync.py",
    ".\player\videowall_controller.py",
    ".\player\state_machine.py",
    ".\player\videowall_drift.py",
    ".\player\mpv-videowall.conf",
    ".\player\setup_timezone.sh",
    ".\player\debug_player.py",
    ".\player\rotation_utils.py",
    ".\player\fix_rotation_boot.sh",
    ".\player\setup_service.sh",
    ".\player\logger_service.py",
    ".\player\install_dependencies.sh",
    ".\player\setup_wallpaper.py",
    ".\player\setup_device.sh",
    ".\player\README.md"
)

$RemoteConfigPath = "$TargetDir/config.json"
$RemoteConfigExists = $false
ssh "$User@$PlayerIp" "test -f $RemoteConfigPath"
if ($LASTEXITCODE -eq 0) {
    $RemoteConfigExists = $true
}

if ($ForceConfigSync -or -not $RemoteConfigExists) {
    $FilesToCopy += ".\player\config.json"
    if ($ForceConfigSync) {
        Write-Host "ForceConfigSync enabled: remote config.json will be overwritten." -ForegroundColor Yellow
    }
    else {
        Write-Host "Remote config.json not found. Copying local config.json." -ForegroundColor DarkGray
    }
}
else {
    Write-Host "Remote config.json exists. Preserving it to keep current pairing." -ForegroundColor Green
}

scp $FilesToCopy "$User@$PlayerIp`:$TargetDir"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Files transferred successfully." -ForegroundColor Green

    # Ensure Lua scripts folder exists and sync videowall Lua script
    ssh "$User@$PlayerIp" "mkdir -p $TargetDir/lua"
    if (Test-Path ".\player\lua\videowall_sync.lua") {
        scp ".\player\lua\videowall_sync.lua" "$User@$PlayerIp`:$TargetDir/lua/"
    }
    
    # Make scripts executable
    ssh "$User@$PlayerIp" "chmod +x $TargetDir/setup_service.sh $TargetDir/install_dependencies.sh"

    # Install Dependencies
    Write-Host "Installing/Verifying Dependencies (this may take a minute)..." -ForegroundColor Cyan
    ssh "$User@$PlayerIp" "bash $TargetDir/install_dependencies.sh"

    # Setup Wallpaper
    Write-Host "Setting Black Wallpaper..." -ForegroundColor Cyan
    ssh "$User@$PlayerIp" "python3 $TargetDir/setup_wallpaper.py"

    # Restart Service
    Write-Host "Attempting to restart signage-player service..." -ForegroundColor Cyan
    $NeedsServiceSetup = $false
    ssh "$User@$PlayerIp" "sudo systemctl restart signage-player"

    if ($LASTEXITCODE -ne 0) {
        $NeedsServiceSetup = $true
    }
    else {
        $IsActive = (ssh "$User@$PlayerIp" "systemctl is-active signage-player").Trim()
        if ($IsActive -ne "active") {
            $NeedsServiceSetup = $true
        }
    }

    if (-not $NeedsServiceSetup) {
        Write-Host "Service restarted and is active." -ForegroundColor Green
    }
    else {
        Write-Host "Service restart failed or service is inactive." -ForegroundColor Yellow
        Write-Host "Attempting to install service via setup_service.sh..." -ForegroundColor Cyan
        
        # Run setup_service.sh
        ssh "$User@$PlayerIp" "bash $TargetDir/setup_service.sh"

        if ($LASTEXITCODE -eq 0) {
            $IsActive = (ssh "$User@$PlayerIp" "systemctl is-active signage-player").Trim()
            if ($IsActive -eq "active") {
                Write-Host "Service installed and started successfully." -ForegroundColor Green
            }
            else {
                Write-Host "Service installed but is not active. Check logs." -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "Failed to install service." -ForegroundColor Red
        }
    }
}
else {
    Write-Host "File transfer failed. Check IP address and connection." -ForegroundColor Red
}
