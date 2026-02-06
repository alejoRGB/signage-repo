---
name: deploying-and-verifying
description: Deploys code to the Raspberry Pi using the PowerShell script and verifies service logs via SSH. Use when user asks to deploy, update the player, or check logs.
---

# Deploy and Debug on Raspberry Pi

## When to use this skill
- User asks to deploy code to the Raspberry Pi.
- User asks to update the player software.
- User asks to check logs or debug the player remotely.
- User mentions verifying if code is running on the device.

## Workflow

1.  **Deployment**: Run the deployment script.
2.  **Verification**: SSH into the device and check the service status.
3.  **Logs**: Read the logs to confirm successful startup and operation.

## Instructions

### 1. Run Deployment Script
Execute the PowerShell script to transfer files and restart the service.
(Default IP: `raspberrypi`, User: `pi4`, Password: `22`)

```powershell
.\deploy_player.ps1 -PlayerIp raspberrypi -PlayerUser pi4
```

### 2. Verify Service Status
Connect via SSH and check the systemd service status.

```bash
ssh -tt pi4@raspberrypi "sudo systemctl status signage-player --no-pager"
```

### 3. Check Live Logs
If the service is running but behavior is suspect, check the live logs.

```bash
ssh -tt pi4@raspberrypi "journalctl -u signage-player -f -n 50"
```

## Troubleshooting
- **Permission Denied**: Check if the SSH key is added or type the password (`22`) when prompted.
- **Service Failed**: If `systemctl status` shows failed, check `journalctl -u signage-player -n 100` for traceback.
