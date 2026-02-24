#!/bin/bash
set -e

# Digital Signage Player - Legacy Installer
# This file is kept for backward compatibility and now delegates to the
# canonical installer: player/setup_device.sh in the repo.

echo "==================================================="
echo "   Digital Signage Player Installer (Legacy)"
echo "==================================================="
echo "This installer is deprecated. Redirecting to canonical setup_device.sh..."

REPO_OWNER="${SIGNAGE_REPO_OWNER:-alejoRGB}"
REPO_NAME="${SIGNAGE_REPO_NAME:-signage-repo}"
REPO_REF="${SIGNAGE_REPO_REF:-master}"
CANONICAL_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_REF}/player/setup_device.sh"
EXPECTED_SHA256="${SIGNAGE_SETUP_SHA256:-}"
TMP_SCRIPT="$(mktemp /tmp/signage-setup-device.XXXXXX.sh)"

cleanup() {
  rm -f "$TMP_SCRIPT"
}
trap cleanup EXIT

if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found. Installing..."
  sudo apt-get update -y
  sudo apt-get install -y curl
fi

echo "Downloading installer from ${REPO_OWNER}/${REPO_NAME}@${REPO_REF}"
curl -sLf "$CANONICAL_URL" -o "$TMP_SCRIPT"

if [ -n "$EXPECTED_SHA256" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_SHA256="$(sha256sum "$TMP_SCRIPT" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL_SHA256="$(shasum -a 256 "$TMP_SCRIPT" | awk '{print $1}')"
  else
    echo "No SHA-256 tool found (sha256sum/shasum). Cannot verify SIGNAGE_SETUP_SHA256."
    exit 1
  fi

  if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
    echo "SHA-256 mismatch for downloaded installer."
    echo "Expected: $EXPECTED_SHA256"
    echo "Actual:   $ACTUAL_SHA256"
    exit 1
  fi
fi

bash "$TMP_SCRIPT"
