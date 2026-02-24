#!/bin/bash
set -e

# Digital Signage Player - Dependency Installer
# Installs system and python dependencies required for the player

echo "[INSTALLER] Checking and Installing Dependencies..."

# 1. System Dependencies
echo "[INSTALLER] Updating apt..."
sudo apt-get update -y

COMMON_DEPS="git mpv python3-pip pcmanfm unclutter feh libopenjp2-7 python3-pil python3-requests chrony v4l-utils"
echo "[INSTALLER] Installing: $COMMON_DEPS"
sudo apt-get install -y $COMMON_DEPS

# Browser check/install
if dpkg -l | grep -q chromium-browser; then
    echo "[INSTALLER] chromium-browser already installed."
elif dpkg -l | grep -q chromium; then
    echo "[INSTALLER] chromium already installed."
else
    echo "[INSTALLER] Installing chromium..."
    if sudo apt-get install -y chromium-browser; then
        echo "[INSTALLER] chromium-browser installed."
    elif sudo apt-get install -y chromium; then
        echo "[INSTALLER] chromium installed."
    else
        echo "[INSTALLER] WARNING: Could not install chromium."
    fi
fi

# 2. Python Dependencies (pip)
# Using --break-system-packages because on recent Raspbian versions pip is managed externally
# Runtime package versions are pinned in requirements-runtime.txt for reproducibility.
echo "[INSTALLER] Installing Python libs..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_REQS_FILE="$SCRIPT_DIR/requirements-runtime.txt"

if [ ! -f "$PY_REQS_FILE" ]; then
    echo "[INSTALLER] ERROR: Missing Python requirements file: $PY_REQS_FILE"
    exit 1
fi

pip3 install -r "$PY_REQS_FILE" --break-system-packages || \
pip3 install -r "$PY_REQS_FILE"

echo "[INSTALLER] Dependencies installed successfully."
sudo systemctl enable chrony
sudo systemctl restart chrony || true
if chronyc tracking >/dev/null 2>&1; then
    echo "[INSTALLER] chrony tracking is available."
else
    echo "[INSTALLER] WARNING: chronyc tracking unavailable. Sync readiness will fail while clock is critical."
fi
