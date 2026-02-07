# Digital Signage Player - Raspberry Pi Setup

## Installation on Raspberry Pi

### 1. Install Dependencies

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Python and required packages
sudo apt-get install -y python3 python3-pip

# Install media players
sudo apt-get install -y mpv feh

# Install Python requests library
pip3 install requests
```

### 2. Setup Player Directory

```bash
# Create player directory
mkdir -p /home/pi/signage-player/media
cd /home/pi/signage-player

# Copy player files (you'll need to transfer these from your PC)
# - player.py
# - sync.py
# - config.json
# - setup_wallpaper.py
# - setup_device.sh
# - rotation_utils.py
# - logger_service.py
# - README.md
```

### 3. Create Configuration

Create `/home/pi/signage-player/config.json`:

```json
{
  "server_url": "http://192.168.100.4:3000",
  "device_token": "cmkqc23340020n2yxfs987i6h",
  "sync_interval": 300,
  "media_dir": "/home/pi/signage-player/media"
}
```

**Replace**:
- `server_url` with your PC's IP address
- `device_token` with your device's token from the dashboard

### 4. Test Sync

```bash
cd /home/pi/signage-player
python3 sync.py
```

You should see:
```
[SYNC] Fetching playlist from http://192.168.100.4:3000/api/device/sync
[SYNC] Device: RaspberryPi-Test2
[SYNC] Playlist: My Playlist (2 items)
[DOWNLOAD] Downloading video1.mp4...
[DOWNLOAD] ✓ video1.mp4 downloaded
```

### 5. Test Player

```bash
python3 player.py
```

The player will:
1. Sync the playlist
2. Download media files
3. Play items in sequence
4. Loop forever

Press `Ctrl+C` to stop.

### 6. Auto-start on Boot

We have provided a script to automatically verify dependencies and install the systemd service.

1.  **Create the Setup Script**:
    Create `/home/pi/signage-player/setup_service.sh` and paste the content provided by the assistant.

2.  **Run the Script**:
    ```bash
    chmod +x setup_service.sh
    ./setup_service.sh
    ```

3.  **Check Status**:
    ```bash
    sudo systemctl status signage-player
    ```

4.  **View Logs**:
    ```bash
    journalctl -u signage-player -f
    ```

The player will now start automatically when the Pi boots up!

## Transferring Files to Pi

### 6. Deployment (Recommended)

We provide a PowerShell script to handle file transfer, permission fixing, and service restarting automatically.

**From your development machine:**
```powershell
.\deploy_player.ps1 -PlayerIp <RPI_IP> -PlayerUser <USER>
# Example: .\deploy_player.ps1 -PlayerIp 192.168.1.50 -PlayerUser pi
```

### 7. Playback Modes

The player automatically selects the best playback strategy:

*   **Native Mode (Optimized):** Used when the playlist contains **only** videos/images.
    *   Handled entirely by MPV for gapless/seamless transitions.
    *   Uses a persistent window to prevent black screens.
*   **Mixed Mode:** Used when the playlist contains Web Content.
    *   Manages a mixed loop of MPV (for video) and Chromium (for web).
    *   Slightly higher overhead but higher flexibility.

## Transferring Files to Pi (Manual)

### Option 1: SCP (from your PC)
```bash
scp -r player.py sync.py config.json scripts/ pi@raspberrypi.local:/home/pi/signage-player/
```

### Option 2: Direct Edit via SSH
```bash
ssh pi@raspberrypi.local
cd /home/pi/signage-player
nano sync.py  # Paste content
nano player.py  # Paste content
nano config.json  # Create config
```

### Option 3: Git
```bash
# On PC: commit files to git
# On Pi: clone repo
git clone <your-repo> /home/pi/signage-player
```
