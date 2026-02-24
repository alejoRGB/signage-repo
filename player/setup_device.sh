#!/bin/bash
set -e

# ==========================================
# Digital Signage Player - Auto Installer (v2.5 - Full Util)
# ==========================================

USER_HOME="/home/$(whoami)"
APP_DIR="$USER_HOME/signage-player"
CONFIG_BACKUP="/tmp/signage_config_backup.json"

REPO_OWNER="${SIGNAGE_REPO_OWNER:-alejoRGB}"
REPO_NAME="${SIGNAGE_REPO_NAME:-signage-repo}"
REPO_REF="${SIGNAGE_REPO_REF:-}"
SERVER_URL="${SIGNAGE_SERVER_URL:-https://signage-repo-dc5s.vercel.app}"

if [[ -z "$REPO_OWNER" || -z "$REPO_NAME" || -z "$REPO_REF" ]]; then
  echo "[INSTALLER] ERROR: Repository source is not configured correctly."
  echo "[INSTALLER] Set SIGNAGE_REPO_OWNER, SIGNAGE_REPO_NAME and SIGNAGE_REPO_REF (pinned tag or commit)."
  exit 1
fi

case "$REPO_REF" in
  master|main|develop|dev)
    echo "[INSTALLER] ERROR: SIGNAGE_REPO_REF must be a pinned tag or commit, not a mutable branch ('$REPO_REF')."
    exit 1
    ;;
esac

echo "[INSTALLER] Starting installation v2.5 (Timezone Script Added)..."
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
COMMON_DEPS="git mpv python3-pip pcmanfm unclutter feh libopenjp2-7 chrony v4l-utils"
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

BASE_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_REF}/player"
FILES="player.py hwaccel.py setup_wallpaper.py logger_service.py rotation_utils.py sync.py lan_sync.py videowall_controller.py state_machine.py videowall_drift.py mpv-videowall.conf lua/videowall_sync.lua fix_rotation_boot.sh setup_timezone.sh requirements-runtime.txt"

echo "[INSTALLER] Source repo: ${REPO_OWNER}/${REPO_NAME}@${REPO_REF}"
echo "[INSTALLER] Default server_url: ${SERVER_URL}"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

for FILE in $FILES; do
    echo "[INSTALLER] Downloading $FILE..."
    mkdir -p "$(dirname "$FILE")"
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
  "server_url": "${SERVER_URL}",
  "device_token": "",
  "media_dir": "$APP_DIR/media"
}
EOF
fi

# 6. Python Deps
echo "[INSTALLER] Installing Python libs..."
if [ ! -f "$APP_DIR/requirements-runtime.txt" ]; then
    echo "[INSTALLER] ERROR: Missing Python requirements file in install directory."
    exit 1
fi
pip3 install -r "$APP_DIR/requirements-runtime.txt" --break-system-packages || \
pip3 install -r "$APP_DIR/requirements-runtime.txt"

# 6.1 Chrony service
echo "[INSTALLER] Enabling chrony..."
sudo systemctl enable chrony
sudo systemctl restart chrony || true
if chronyc tracking >/dev/null 2>&1; then
    echo "[INSTALLER] chronyc tracking OK"
else
    echo "[INSTALLER] WARNING: chronyc tracking failed. Sync mode will not enter READY while clock is critical."
fi

# Disable Chromium browser prompts globally (managed policy, independent of page language/site prompts).
echo "[INSTALLER] Installing Chromium managed policy (disable browser prompts)..."
CHROMIUM_POLICY_JSON='{"TranslateEnabled": false, "DefaultNotificationsSetting": 2, "DefaultGeolocationSetting": 2, "DefaultPopupsSetting": 2, "DefaultMediaStreamSetting": 2, "AudioCaptureAllowed": false, "VideoCaptureAllowed": false}'
for POLICY_DIR in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed; do
    sudo mkdir -p "$POLICY_DIR"
    echo "$CHROMIUM_POLICY_JSON" | sudo tee "$POLICY_DIR/signage-policy.json" >/dev/null
done

# 7. Setup Service
echo "[INSTALLER] Configuring Systemd..."
cat <<EOF | sudo tee /etc/systemd/system/signage-player.service
[Unit]
Description=Digital Signage Player
After=network-online.target graphical.target chrony.service
Wants=network-online.target chrony.service

[Service]
User=$(whoami)
WorkingDirectory=$APP_DIR
ExecStartPre=/bin/bash -c '/usr/bin/chronyc tracking >/tmp/signage-chrony-startup.log 2>&1 || true'
ExecStart=/usr/bin/python3 $APP_DIR/player.py
Restart=always
RestartSec=10
Environment=DISPLAY=:0
Environment=XAUTHORITY=$USER_HOME/.Xauthority
Environment=SYNC_CLOCK_MAX_OFFSET_MS=50

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
