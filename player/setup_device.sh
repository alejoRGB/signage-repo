#!/bin/bash
set -e

# ==========================================
# Digital Signage Player - Auto Installer
# ==========================================

USER_HOME="/home/$(whoami)"
APP_DIR="$USER_HOME/signage-player"
REPO_URL="https://github.com/alejoRGB/signage-repo.git"

echo "[INSTALLER] Starting installation..."

# 1. System Update
echo "[INSTALLER] Updating system packages..."
sudo apt-get update -y

# 2. Install Dependencies
echo "[INSTALLER] Installing apt dependencies..."
# git: to clone source
# mpv: media player
# python3-pip: for python libs
# pcmanfm: wallpaper manager
# unclutter: hides mouse
# feh: image viewer for pairing code
# libopenjp2-7: often needed for Pillow
COMMON_DEPS="git mpv python3-pip pcmanfm unclutter feh libopenjp2-7"

echo "[INSTALLER] Installing base packages: $COMMON_DEPS"
sudo apt-get install -y $COMMON_DEPS

echo "[INSTALLER] Installing Web Browser..."
# Try chromium-browser (RPi OS) first, then chromium (Debian/Ubuntu)
if sudo apt-get install -y chromium-browser; then
    echo "[INSTALLER] chromium-browser installed successfully."
elif sudo apt-get install -y chromium; then
    echo "[INSTALLER] chromium installed successfully."
else
    echo "[INSTALLER] CRITICAL: Could not find 'chromium-browser' or 'chromium'. Continuing but web playback may fail."
fi

# 3. Setup Directory Structure
echo "[INSTALLER] Setting up directory structure..."
mkdir -p "$APP_DIR/media"

# 4. Fetch Code
echo "[INSTALLER] Fetching code from GitHub..."
if [ -d "$APP_DIR/.git" ]; then
    echo "[INSTALLER] Repo already exists, pulling changes..."
    cd "$APP_DIR"
    git pull
else
    echo "[INSTALLER] Cloning repo..."
    # We clone the full repo
    git clone "$REPO_URL" "$APP_DIR/temp_repo"
    
    # Copy ONLY the player directory contents to APP_DIR
    echo "[INSTALLER] Extracting player code..."
    
    # Check if we are in Monorepo structure (likely)
    if [ -d "$APP_DIR/temp_repo/player" ]; then
        echo "[INSTALLER] Found /player folder in repo. Copying contents..."
        cp -a "$APP_DIR/temp_repo/player/." "$APP_DIR/"
        
        # Also copy deploy scripts if useful
        cp "$APP_DIR/temp_repo/deploy_player.ps1" "$APP_DIR/" 2>/dev/null || true
    else
        # Fallback: maybe we are already inside a player-only repo?
        echo "[INSTALLER] WARNING: /player folder not found. Dumping valid files..."
        cp -a "$APP_DIR/temp_repo/." "$APP_DIR/"
    fi

    # CLEANUP: Remove the heavy web app code and temp repo
    echo "[INSTALLER] Cleaning up temp repo..."
    rm -rf "$APP_DIR/temp_repo"

    # CRITICAL FIX: Check if we have a nested 'player' folder incorrectly
    if [ -f "$APP_DIR/player/player.py" ] && [ ! -f "$APP_DIR/player.py" ]; then
        echo "[INSTALLER] Fixing nested directory structure..."
        mv "$APP_DIR/player/"* "$APP_DIR/"
        rmdir "$APP_DIR/player"
    fi

    # FINAL VERIFICATION
    if [ ! -f "$APP_DIR/player.py" ]; then
        echo "[INSTALLER] CRITICAL ERROR: player.py not found in $APP_DIR!"
        echo "[INSTALLER] Directory listing:"
        ls -R "$APP_DIR"
        exit 1
    fi
fi

# 5. Install Python Dependencies
echo "[INSTALLER] Installing Python libraries..."
# Using --break-system-packages if on newer Debian/Raspberry OS (Bookworm)
pip3 install requests python-socketio "Pillow" --break-system-packages || pip3 install requests python-socketio "Pillow" 

# 6. Init Configuration (Force Pairing Mode)
echo "[INSTALLER] Initializing configuration..."
CONFIG_PATH="$APP_DIR/config.json"
if [ ! -f "$CONFIG_PATH" ]; then
    cat <<EOF > "$CONFIG_PATH"
{
  "server_url": "https://signage-repo-dc5s-git-master-alejos-projects-7a73f1be.vercel.app",
  "device_token": "",
  "media_dir": "$APP_DIR/media"
}
EOF
    echo "[INSTALLER] config.json created. Device set to PAIRING MODE."
else
    echo "[INSTALLER] config.json already exists. Skipping overwrite."
fi

# 7. Stealth Mode & Wallpaper
echo "[INSTALLER] Applying Stealth Mode..."
if [ -f "$APP_DIR/setup_wallpaper.py" ]; then
    python3 "$APP_DIR/setup_wallpaper.py"
else
    echo "[INSTALLER] WARNING: setup_wallpaper.py not found!"
fi

# 8. Service Setup
echo "[INSTALLER] Setting up Systemd Service..."
SERVICE_FILE="$APP_DIR/signage-player.service"

# Create service file content dynamically to ensure paths are correct
cat <<EOF | sudo tee /etc/systemd/system/signage-player.service
[Unit]
Description=Digital Signage Player
After=network-online.target graphical.target
Wants=network-online.target

[Service]
User=$(whoami)
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/python3 $APP_DIR/player.py
Restart=always
RestartSec=10
Environment=DISPLAY=:0
Environment=XAUTHORITY=$USER_HOME/.Xauthority

[Install]
WantedBy=graphical.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable signage-player.service
# sudo systemctl start signage-player.service  <-- Uncomment to auto-start immediately

# 9. Mouse Hiding (Unclutter)
# Usually unclutter auto-starts via X11, but we can ensure it via lxsession if needed.
# For now, apt install is usually enough for desktop envs.

echo "[INSTALLER] ========================================="
echo "[INSTALLER] Installation Complete!"
echo "[INSTALLER] Device is ready."
echo "[INSTALLER] To start the player: sudo systemctl start signage-player"
echo "[INSTALLER] ========================================="
