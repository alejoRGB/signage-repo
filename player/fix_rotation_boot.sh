#!/bin/bash
# fix_rotating_boot.sh
# Fixes "BadMatch" error on xrandr rotation by enabling Full KMS driver.

CONFIG_FILE="/boot/firmware/config.txt"
if [ ! -f "$CONFIG_FILE" ]; then
    CONFIG_FILE="/boot/config.txt"
fi

echo "--- Patching $CONFIG_FILE for Screen Rotation ---"

# Backup
sudo cp "$CONFIG_FILE" "${CONFIG_FILE}.bak_rotation"

# 1. Ensure Full KMS is used (vc4-kms-v3d) instead of Fake KMS (vc4-fkms-v3d)
if grep -q "dtoverlay=vc4-fkms-v3d" "$CONFIG_FILE"; then
    echo "Replacing Fake KMS (fkms) with Full KMS (kms)..."
    sudo sed -i 's/dtoverlay=vc4-fkms-v3d/dtoverlay=vc4-kms-v3d/' "$CONFIG_FILE"
elif ! grep -q "dtoverlay=vc4-kms-v3d" "$CONFIG_FILE"; then
    echo "Adding Full KMS overlay..."
    echo "dtoverlay=vc4-kms-v3d" | sudo tee -a "$CONFIG_FILE"
fi

# 2. Increase GPU Memory to ensure buffer space for rotation
# 128MB is usually enough, but 256MB is safer for high res
if grep -q "gpu_mem" "$CONFIG_FILE"; then
    echo "Updating gpu_mem to 256..."
    sudo sed -i 's/^gpu_mem=.*/gpu_mem=256/' "$CONFIG_FILE"
else
    echo "Adding gpu_mem=256..."
    echo "gpu_mem=256" | sudo tee -a "$CONFIG_FILE"
fi

# 3. Disable 4K60Hz to save bandwidth (often helps with rotation stability)
if ! grep -q "hdmi_enable_4kp60=0" "$CONFIG_FILE"; then
     echo "Disabling 4K60 to improve compatibility..."
     echo "hdmi_enable_4kp60=0" | sudo tee -a "$CONFIG_FILE"
fi

echo "---------------------------------------------------"
echo "Patch applied."
echo "CRITICAL: You MUST reboot the Raspberry Pi now."
echo "sudo reboot"
