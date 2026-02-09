# Canonical Deployment Context

## Cloud Deployment (Vercel)
- **Repo:** GitHub connected.
- **Environment:**
  - `DATABASE_URL`: Neon Postgres Connection String.
  - `NEXTAUTH_SECRET`: Auth secret.
  - `NEXT_PUBLIC_APP_URL`: Canonical URL for the app (prevents Host Header Injection in sync).
  - `BLOB_READ_WRITE_TOKEN`: Vercel Blob access.
  - `E2E_USERNAME` / `E2E_PASSWORD`: Required for E2E testing (DO NOT hardcode in tests).

## Security & Maintenance
- **Credentials:** Never commit hardcoded secrets. Use `.env` and environment variables.
- **Gitignore:** Ensure `playwright-report`, `test-results`, `web/dev.db`, `web/public/uploads`, and `.env` are ignored.
- **Admin Recovery:** Use `web/scripts/reset_password.js` to reset admin credentials directly in DB.
- **Device Debugging:** Use `web/scripts/check_devices.js` to verify device tokens and status in DB.

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
- **Script:** `deploy.ps1` (in root) automates rsync/scp, dependency installation, and configuration.
  - **Command:** `powershell .\deploy.ps1 -PlayerIp <IP> -PlayerUser <USER>`
  - **Verified Example:** `powershell .\deploy.ps1 -PlayerIp 192.168.100.6 -PlayerUser pi4`
  - **Transfers:** `player.py`, `sync.py`, `setup_wallpaper.py`, `setup_device.sh`, `rotation_utils.py`, `config.json`, and dependencies.
- **Config:** `temp_config_prod.json` (Production) / `temp_config_local.json` (Dev).
- **Files Transferred:** `player.py`, `sync.py`, `config.json`, `setup_*.sh/py`, `rotation_utils.py`, `logger_service.py`, `install_dependencies.sh`.

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
