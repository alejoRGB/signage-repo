#!/bin/bash

# Check if a timezone argument is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup_timezone.sh <Region/City>"
    echo "Example: ./setup_timezone.sh America/Argentina/Buenos_Aires"
    echo "List available timezones with: timedatectl list-timezones"
    exit 1
fi

TIMEZONE=$1

echo "Setting timezone to $TIMEZONE..."
sudo timedatectl set-timezone $TIMEZONE

echo "Enabling Network Time Protocol (NTP) for auto-sync..."
sudo timedatectl set-ntp true

echo "Current System Time:"
date

echo "Done. Please restart the player service if it was running:"
echo "sudo systemctl restart signage-player"
