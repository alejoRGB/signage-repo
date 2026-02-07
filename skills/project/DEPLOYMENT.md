# Canonical Deployment Context

## Cloud Deployment (Vercel)
- **Repo:** GitHub connected.
- **Environment:**
  - `DATABASE_URL`: Neon Postgres Connection String.
  - `NEXTAUTH_SECRET`: Auth secret.
  - `BLOB_READ_WRITE_TOKEN`: Vercel Blob access.

## Edge Deployment (Raspberry Pi)
### One-Line Install (Canonical)
```bash
curl -sL https://raw.githubusercontent.com/alejoRGB/signage-repo/master/player/setup_device.sh | bash
```

### Manual Steps
1. Flash Raspberry Pi OS (Lite recommended).
2. Enable SSH (`touch ssh` in boot).
3. Connect to network.
4. Run One-Line Install.

### Updates
- **Code:** `git pull` in `~/signage-player`.
- **Dependencies:** `pip install -r requirements.txt`.
- **Restart:** `sudo systemctl restart signage-player`.

## Development Deployment
- **Script:** `deploy.ps1` automates rsync/scp, dependency installation, and configuration (wallpaper, service restart).
  - **Transfers:** `player.py`, `sync.py`, `setup_wallpaper.py`, `setup_device.sh`, `rotation_utils.py`, `config.json`, and dependencies.
- **Config:** `temp_config_prod.json` (Production) / `temp_config_local.json` (Dev).

## Validation
- **Status Check:** `systemctl status signage-player`.
- **Logs:** `journalctl -u signage-player -f`.

## Troubleshooting
### Time Sync
If pairing fails or logs show wrong dates:
```bash
sudo systemctl restart systemd-timesyncd
date
```

### Force Pairing Reset
If code is invalid/expired:
1. Stop service.
2. Create config with ONLY `server_url` (remove `device_token`).
3. Restart service.
4. Check logs for NEW code.
