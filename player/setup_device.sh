#!/bin/bash
set -e

# ==========================================
# Digital Signage Player - Auto Installer (v2.4 - Config Fix)
# ==========================================

USER_HOME="/home/$(whoami)"
APP_DIR="$USER_HOME/signage-player"
REPO_URL="https://github.com/alejoRGB/signage-repo.git"
CONFIG_BACKUP="/tmp/signage_config_backup.json"

echo "[INSTALLER] Starting installation v2.4 (Wallpaper Config Fix)..."
echo "[INSTALLER] 🛑 Stopping existing service to prevent conflicts..."
sudo systemctl stop signage-player || true

echo "[INSTALLER] User: $(whoami)"
echo "[INSTALLER] App Dir: $APP_DIR"

# 0. Backup Config (Prevention of data loss)
if [ -f "$APP_DIR/config.json" ]; then
    echo "[INSTALLER] Backing up existing configuration..."
    cp "$APP_DIR/config.json" "$CONFIG_BACKUP"
fi

# 1. Clean Slate (Ensure no nested folder madness)
if [ -d "$APP_DIR" ]; then
    echo "[INSTALLER] Cleaning up existing installation to ensure fresh state..."
    rm -rf "$APP_DIR"
fi
mkdir -p "$APP_DIR/media"

# 2. System Dependencies
echo "[INSTALLER] Installing dependencies..."
sudo apt-get update -y
COMMON_DEPS="git mpv python3-pip pcmanfm unclutter feh libopenjp2-7"
sudo apt-get install -y $COMMON_DEPS

# Browser check
if sudo apt-get install -y chromium-browser; then
    echo "[INSTALLER] chromium-browser installed."
elif sudo apt-get install -y chromium; then
    echo "[INSTALLER] chromium installed."
else
    echo "[INSTALLER] WARNING: No chromium found."
fi

# 3. Clone & Extract
# 3. Download Source (Direct via Curl)
echo "[INSTALLER] Downloading player files directly..."

BASE_URL="https://raw.githubusercontent.com/alejoRGB/signage-repo/master/player"
FILES="player.py setup_wallpaper.py logger_service.py rotation_utils.py sync.py fix_rotation_boot.sh setup_timezone.sh"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

for FILE in $FILES; do
    echo "[INSTALLER] Downloading $FILE..."
    if curl -sLf "$BASE_URL/$FILE" -o "$FILE"; then
        echo "   -> OK"
    else
        echo "   -> FAIL: Could not download $FILE"
        echo "      Url: $BASE_URL/$FILE"
        exit 1
    fi
done

echo "[INSTALLER] Files downloaded successfully."

# Cleanup legacy temp dirs if any
rm -rf "$APP_DIR/temp_repo"

# 4. Verification (Fail Fast)
if [ ! -f "$APP_DIR/player.py" ]; then
    echo "[INSTALLER] CRITICAL ERROR: player.py is MISSING in $APP_DIR"
    echo "Current Directory Contents:"
    ls -la "$APP_DIR"
    exit 1
fi
echo "[INSTALLER] Verified: player.py exists."

# 5. Restore Config
if [ -f "$CONFIG_BACKUP" ]; then
    echo "[INSTALLER] Restoring configuration..."
    mv "$CONFIG_BACKUP" "$APP_DIR/config.json"
else
    echo "[INSTALLER] Creating new configuration..."
    cat <<EOF > "$APP_DIR/config.json"
{
  "server_url": "https://signage-repo-dc5s-git-master-alejos-projects-7a73f1be.vercel.app",
  "device_token": "",
  "media_dir": "$APP_DIR/media"
}
EOF
fi

# 6. Python Deps
echo "[INSTALLER] Installing Python libs..."
pip3 install requests python-socketio "Pillow" --break-system-packages || pip3 install requests python-socketio "Pillow"

# 7. Setup Service
echo "[INSTALLER] Configuring Systemd..."
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
sudo systemctl restart signage-player.service

echo "[INSTALLER] ========================================="
echo "[INSTALLER] SUCCESS! Service restarted."
echo "[INSTALLER] Logs: journalctl -u signage-player -f"
echo "[INSTALLER] ========================================="
