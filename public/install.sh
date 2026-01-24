#!/bin/bash

# Digital Signage Player - One-Line Installer
# Usage: curl -L https://your-domain.com/install.sh | bash

echo "==================================================="
echo "   Digital Signage Player Installer"
echo "==================================================="

# 1. Configuration
USER_HOME=$(eval echo ~$(whoami))
INSTALL_DIR="$USER_HOME/signage-player"
BASE_URL="https://signage-repo-dc5s-1cnhp9yu5-alejos-projects-7a73f1be.vercel.app" # Will update dynamically if needed

echo "Installing to: $INSTALL_DIR"

# 2. Install System Dependencies
echo "[1/5] Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-requests mpv feh git

# 3. Setup Directory
echo "[2/5] Setting up directories..."
mkdir -p "$INSTALL_DIR/media"

# 4. Download Player Software
echo "[3/5] Downloading player software..."
# Always download the latest optimized player from the public URL
wget -q "$BASE_URL/player.py" -O "$INSTALL_DIR/player.py"

# Download Service Script Logic (Embedded here to handle service creation)
SERVICE_FILE="/etc/systemd/system/signage-player.service"
CURRENT_USER=$(whoami)

# 5. Create Config if missing
echo "[4/5] Checking configuration..."
CONFIG_PATH="$INSTALL_DIR/config.json"
if [ ! -f "$CONFIG_PATH" ]; then
    echo "Creating default configuration..."
    cat > "$CONFIG_PATH" <<EOF
{
  "server_url": "${BASE_URL}",
  "device_token": "",
  "media_dir": "${INSTALL_DIR}/media"
}
EOF
    echo "⚠️  IMPORTANT: You must edit $CONFIG_PATH to add your device token later!"
else
    echo "Configuration exists. Skipping."
fi

# 6. Install Service
echo "[5/5] Installing auto-start service..."
sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Digital Signage Player
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=DISPLAY=:0
Environment=XAUTHORITY=$USER_HOME/.Xauthority
ExecStart=/usr/bin/python3 $INSTALL_DIR/player.py
WorkingDirectory=$INSTALL_DIR
Restart=always
RestartSec=10
User=$CURRENT_USER
Group=$CURRENT_USER

[Install]
WantedBy=graphical.target
EOL

sudo systemctl unmask signage-player
sudo systemctl daemon-reload
sudo systemctl enable signage-player.service
sudo systemctl restart signage-player

echo "==================================================="
echo "✅ Installation Complete!"
echo "==================================================="
echo "1. Go to your Dashboard and create a new Device."
echo "2. Copy the Token."
echo "3. Run: nano ~/signage-player/config.json"
echo "4. Paste the token and save."
echo "5. Restart the player: sudo systemctl restart signage-player"
echo "==================================================="
