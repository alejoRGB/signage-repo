#!/bin/bash

# Digital Signage Player - Auto-start Setup Script
# Run this script to configure the player to start automatically on boot

SERVICE_FILE="/etc/systemd/system/signage-player.service"
# Dynamically get the current user and their home directory
CURRENT_USER=$(whoami)
HOME_DIR=$(eval echo ~$CURRENT_USER)
DIR="$HOME_DIR/signage-player"

echo "Configuring Digital Signage Player Service for user: $CURRENT_USER"
echo "Player directory: $DIR"

# Create systemd service file
sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Digital Signage Player
After=network-online.target chrony.service
Wants=network-online.target chrony.service

[Service]
Type=simple
Environment=DISPLAY=:0
Environment=XAUTHORITY=$HOME_DIR/.Xauthority
Environment=SYNC_CLOCK_MAX_OFFSET_MS=50
ExecStartPre=/bin/bash -c '/usr/bin/chronyc tracking >/tmp/signage-chrony-startup.log 2>&1 || true'
ExecStart=/usr/bin/python3 $DIR/player.py
WorkingDirectory=$DIR
Restart=always
RestartSec=10
User=$CURRENT_USER
Group=$CURRENT_USER

[Install]
WantedBy=graphical.target
EOL

# Ensure chrony exists and is enabled
echo "Ensuring chrony is installed and enabled..."
if ! command -v chronyc >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y chrony
fi
sudo systemctl enable chrony
sudo systemctl restart chrony || true

# Reload daemon and enable service
echo "Reloading systemd..."
sudo systemctl unmask signage-player
sudo systemctl daemon-reload
sudo systemctl enable signage-player.service
sudo systemctl restart signage-player

echo "==================================================="
echo "Service installed successfully for user $CURRENT_USER!"
echo "==================================================="
echo "To check status: sudo systemctl status signage-player"
echo "To view logs: journalctl -u signage-player -f"
