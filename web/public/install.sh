#!/bin/bash
set -e

# Digital Signage Player - Legacy Installer
# This file is kept for backward compatibility and now delegates to the
# canonical installer: player/setup_device.sh in the repo.

echo "==================================================="
echo "   Digital Signage Player Installer (Legacy)"
echo "==================================================="
echo "This installer is deprecated. Redirecting to canonical setup_device.sh..."

CANONICAL_URL="https://raw.githubusercontent.com/alejoRGB/signage-repo/master/player/setup_device.sh"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found. Installing..."
  sudo apt-get update -y
  sudo apt-get install -y curl
fi

curl -sLf "$CANONICAL_URL" | bash
