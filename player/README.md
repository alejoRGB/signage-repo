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
mkdir -p ~/signage-player/media
cd ~/signage-player

# Copy player files (you'll need to transfer these from your PC)
# - player.py
# - sync.py
# - setup_wallpaper.py
# - setup_device.sh
# - rotation_utils.py
# - logger_service.py
# - README.md
#
# Nota: config.json NO debe venir versionado en git. Se genera/localiza en tu PC
# y luego se copia a la Raspberry (por ejemplo, vía deploy.ps1 o SCP).
```

### 3. Create Configuration

Create `~/signage-player/config.json` (use an absolute path in `media_dir`; `~` does not expand in JSON):

```json
{
  "server_url": "http://192.168.100.4:3000",
  "device_token": "cmkqc23340020n2yxfs987i6h",
  "sync_interval": 300,
  "media_dir": "/home/<USER>/signage-player/media"
}
```

**Replace**:
- `server_url` with your PC's IP address or the production URL (por ejemplo la URL de Vercel).
- `device_token` with your device's token from the dashboard (o `null` para forzar un nuevo pairing).

### 4. Test Sync

```bash
cd ~/signage-player
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
    Create `~/signage-player/setup_service.sh` and paste the content provided by the assistant.

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
.\deploy.ps1 -PlayerIp <RPI_IP> -PlayerUser <USER>
# Example: .\deploy.ps1 -PlayerIp 192.168.1.50 -PlayerUser pi3
```
This script resolves the remote home directory and always targets `~/signage-player`, regardless of username.

> **Tip (entorno local en tu PC)**: Antes de tu primer deploy, ejecutá en la raíz del repo:
> ```powershell
> .\setup_env.ps1
> ```
> Esto creará `web/.env` y `player/config.json` desde sus archivos de ejemplo **solo si no existen**. Ambos quedan fuera de git y contienen tu configuración local real.

### 7. Playback Modes

The player automatically selects the best playback strategy:

*   **Native Mode (Optimized):** Used when the playlist contains **only** videos/images.
    *   Handled entirely by MPV for gapless/seamless transitions.
    *   Uses a persistent window to prevent black screens.
*   **Mixed Mode:** Used when the playlist contains Web Content.
    *   Manages a mixed loop of MPV (for video) and Chromium (for web).
    *   Slightly higher overhead but higher flexibility.

### Chromium Sandbox Policy

- By default, Chromium is launched with sandbox enabled.
- `--no-sandbox` is only applied when:
  - The process runs as `root`, or
  - `ALLOW_CHROMIUM_NO_SANDBOX=1` is set explicitly.
- Use `ALLOW_CHROMIUM_NO_SANDBOX` only as a compatibility fallback for environments where Chromium sandboxing fails.

## Transferring Files to Pi (Manual)

### Option 1: SCP (from your PC)
```bash
scp -r player.py sync.py config.json scripts/ <USER>@raspberrypi.local:~/signage-player/
```

### Option 2: Direct Edit via SSH
```bash
ssh <USER>@raspberrypi.local
cd ~/signage-player
nano sync.py  # Paste content
nano player.py  # Paste content
nano config.json  # Create config
```

### Option 3: Git
```bash
# On PC: commit code to git (NUNCA `config.json` ni secretos)
# On Pi: clone repo
git clone <your-repo> ~/signage-player

# Luego, en la Pi, creá/ajusta config.json directamente ahí siguiendo la sección "Create Configuration"
```
