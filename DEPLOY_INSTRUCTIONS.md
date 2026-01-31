# Digital Signage Player - New Device Setup Guide

Follow these instructions to program a **NEW** Raspberry Pi from scratch.

## 1. Prepare the Raspberry Pi (Hardware & OS)

1.  **Download & Install:** [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your PC.
2.  **Flash SD Card:**
    *   **OS:** Choose "Raspberry Pi OS (Legacy, 64-bit)" or "Raspberry Pi OS with Desktop". (Desktop is required for video playback).
    *   **Settings (Gear Icon):**
        *   Enable SSH (Password authentication).
        *   Set User: `masal` (or `pi`).
        *   Set Password: `raspberry` (or your choice).
        *   Configure WiFi (SSID & Password).
3.  **Boot:** Insert SD card into Pi, connect to screen, and power on.

## 2. Initial Configuration (On the Pi)

You can do this directly on the Pi or via SSH (`ssh masal@<PI_IP>`).

1.  **Update System:**
    ```bash
    sudo apt update
    sudo apt upgrade -y
    ```

2.  **Install Dependencies:**
    Copy and run this single command to install everything needed:
    ```bash
    sudo apt install -y python3 python3-pip python3-requests python3-pil mpv feh git unclutter
    ```

3.  **Prepare Directory:**
    ```bash
    mkdir -p ~/signage-player/media
    ```

## 3. Deploy Code (From PC)

Use the deployment script to upload the code from your Windows PC to the Pi.

1.  Open VS Code Terminal.
2.  Run the deploy script (replace IP and User if different):
    ```powershell
    .\deploy.ps1 -PiUser masal -PiHost 192.168.100.6
    ```
    *Enter the Pi's password when prompted.*

## 4. Final Setup (On the Pi)

Now that the files are uploaded, run the setup script to make it start automatically.

1.  SSH into the Pi again.
2.  Make scripts executable:
    ```bash
    chmod +x ~/signage-player/*.sh
    ```
3.  Run the Service Setup:
    ```bash
    sudo bash ~/signage-player/setup_service.sh
    ```
    *(This will configure the player to auto-start on boot).*

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
    Check SSH connection: `ssh masal@<IP>` from your PC.
