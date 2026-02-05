#!/bin/bash
set -e

# Digital Signage Player - Dependency Installer
# Installs system and python dependencies required for the player

echo "[INSTALLER] Checking and Installing Dependencies..."

# 1. System Dependencies
echo "[INSTALLER] Updating apt..."
sudo apt-get update -y

COMMON_DEPS="git mpv python3-pip pcmanfm unclutter feh libopenjp2-7 python3-pil python3-requests"
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
# verified requirements: requests, python-socketio, Pillow
echo "[INSTALLER] Installing Python libs..."
pip3 install requests python-socketio Pillow --break-system-packages || \
pip3 install requests python-socketio Pillow

echo "[INSTALLER] Dependencies installed successfully."
