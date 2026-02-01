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
# chromium-browser: web player
# python3-pip: for python libs
# pcmanfm: wallpaper manager
# unclutter: hides mouse
# feh: image viewer for pairing code
# libopenjp2-7: often needed for Pillow
sudo apt-get install -y git mpv chromium-browser python3-pip pcmanfm unclutter feh libopenjp2-7

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
    # We clone into a temp dir and move files because APP_DIR might not be empty (media dir)
    git clone "$REPO_URL" "$APP_DIR/temp_repo"
    cp -r "$APP_DIR/temp_repo/player/"* "$APP_DIR/" 2>/dev/null || true
    # Also fetch setup scripts if they are in root or player
    cp "$APP_DIR/temp_repo/deploy.ps1" "$APP_DIR/" 2>/dev/null || true
    rm -rf "$APP_DIR/temp_repo"
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
