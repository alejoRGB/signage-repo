# Digital Signage Player - New Device Setup Guide

Follow these instructions to program a **NEW** Raspberry Pi from scratch.

## 1. Prepare the Raspberry Pi (Hardware & OS)

1.  **Download & Install:** [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your PC.
2.  **Flash SD Card:**
    *   **OS:** Choose "Raspberry Pi OS (Legacy, 64-bit)" or "Raspberry Pi OS with Desktop". (Desktop is required for video playback).
    *   **Settings (Gear Icon):**
        *   Enable SSH (Password authentication).
        *   Set User: `<USER>` (any username).
        *   Set Password: `raspberry` (or your choice).
        *   Configure WiFi (SSID & Password).
3.  **Boot:** Insert SD card into Pi, connect to screen, and power on.

## 2. Initial Configuration (On the Pi)

You can do this directly on the Pi or via SSH (`ssh <USER>@<PI_IP>`).

1.  **Update System (required):**
    ```bash
    sudo apt update
    sudo apt upgrade -y
    ```

2.  **Ensure the Pi is online and SSH is working.**

## 3. Deploy Code (From PC)

Use the deployment script to upload the code from your Windows PC to the Pi.

> **First‑time setup on your PC:** from the repo root, run:
> ```powershell
> .\setup_env.ps1
> ```
> This will create `web/.env` and `player/config.json` from their example files **only if they do not exist**. These files contain local secrets/config and are ignored by git.

1.  Open a terminal in the repo root.
2.  Run the deploy script (replace IP and User):
    ```powershell
    .\deploy.ps1 -PlayerUser <USER> -PlayerIp <PI_IP>
    ```
    *Enter the Pi's password when prompted.*
3.  This script:
    - Resolves the remote home directory (`~/signage-player`) so it is username-agnostic.
    - Copies the player files (including `config.json` generated on your PC).
    - Installs dependencies and sets the wallpaper.
    - Restarts or installs the systemd service.

## 4. Final Setup (On the Pi)

After deploy, verify config and pairing.

1.  SSH into the Pi again.
2.  **IMPORTANT: Configure Server URL & Identity**
    Edit the config file to ensure it points to the correct server and has no previous identity:
    ```bash
    nano ~/signage-player/config.json
    ```
    Ensure the content looks like this (replace URL if needed, but ensure `device_token` is `null`):
    ```json
    {
        "server_url": "https://signage-repo-dc5s.vercel.app",
        "device_token": null
    }
    ```
    *Note: `device_token` must be `null` for a new pairing code to be generated.*
3.  Restart the service:
    ```bash
    sudo systemctl restart signage-player
    ```

## 5. Verify & Pair

1.  **Check Status:**
    The player should be running now. Check logs:
    ```bash
    journalctl -u signage-player -f
    ```
2.  **Pair:**
    The screen (and logs) should show a **Pairing Code** (e.g., `123456`).
    Go to your Dashboard -> Devices -> Pair Device and enter that code.

## 6. Troubleshooting

*   **No Code on Screen?**
    Ensure `feh` is installed: `sudo apt install feh`.
*   **Video not seamless?**
    Ensure using `mpv` version 0.35+ (default in standard Bookworm OS).
*   **Deployment fails?**
    Check SSH connection: `ssh <USER>@<PI_IP>` from your PC.
