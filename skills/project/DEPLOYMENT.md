# Canonical Deployment Context

## Cloud Deployment (Vercel)
- **Repo:** GitHub connected.
- **Canonical Production URL:** `https://signage-repo-dc5s.vercel.app`
- **Environment:**
  - `DATABASE_URL_UNPOOLED`: Neon Postgres **non-pooler** connection string (required by Prisma; must NOT include `-pooler`).
  - `NEXTAUTH_SECRET`: Auth secret.
  - `NEXT_PUBLIC_APP_URL`: Canonical URL for the app (prevents Host Header Injection in sync).
  - `BLOB_READ_WRITE_TOKEN`: Vercel Blob access.
  - `E2E_USERNAME` / `E2E_PASSWORD`: Required for credentialed E2E testing (DO NOT hardcode in tests).
  - `E2E_BASE_URL`: Optional override for Playwright; defaults to canonical production URL.

## Security & Maintenance
- **Credentials:** 
  - Never commit hardcoded secrets. `git rm --cached` used to enforce this.
  - Rotated credentials (Feb 2026) due to historic exposure.
- **Gitignore:** Ensure `web/dev.db`, `web/public/uploads`, `playwright-report`, `test-results`, and `.env*` are ignored.
- **QA Artifacts:** Also ignore `qa_automation/playwright-report` and `qa_automation/test-results`.
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

### PC Deploy (Username-Agnostic)
1. SSH into the Pi and run `sudo apt update && sudo apt upgrade -y`.
2. From the repo root on your PC:
   - `powershell .\deploy.ps1 -PlayerIp <IP> -PlayerUser <USER>`
3. Ensure `~/signage-player/config.json` has empty/unset token for new pairing (`device_token: null` or `device_token: ""`).
4. After a successful deploy and restart, the pairing code should appear on screen.

### Updates
- **Code:** `git pull` in `~/signage-player`.
- **Dependencies:** `pip install -r requirements.txt`.
- **Restart:** `sudo systemctl restart signage-player`.

## Development Deployment
- **Local Environment Bootstrap (PC):**
  - Run `.\setup_env.ps1` once per machine from the repo root.
  - This script creates `web/.env` (from `web/.env.example`) and `player/config.json` (from `player/config.example.json`) **only if they do not exist**.
  - These generated files contain real secrets/configuración local y **NO** deben comitearse (`.gitignore` los protege).
- **Script de Deploy:** `deploy.ps1` (en la raíz) automatiza copia de archivos, instalación de dependencias y configuración básica.
  - **Comando:** `powershell .\deploy.ps1 -PlayerIp <IP> -PlayerUser <USER>`
  - **Ejemplo verificado:** `powershell .\deploy.ps1 -PlayerIp 192.168.100.6 -PlayerUser pi4`
  - **Ruta destino:** Siempre usa el home del usuario remoto (`~/signage-player`). Nunca hardcodear `/home/pi` o `/root`.
  - **Flujo de config:** Si `player/config.json` no existe en tu PC, `deploy.ps1` llama primero a `setup_env.ps1` para generarlo y luego lo copia a la Raspberry.
  - **Transfers:** `player.py`, `sync.py`, `setup_wallpaper.py`, `setup_device.sh`, `rotation_utils.py`, `config.json`, y dependencias.
- **Template de config:** `player/config.example.json` (Template) -> Se usa como base para generar `player/config.json` local vía `setup_env.ps1`. En la Raspberry, `~/signage-player/config.json` puede editarse directamente para ajustar `server_url` y `device_token` (por ejemplo, poner `device_token: null` para un nuevo pairing).

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
2. Create config with ONLY `server_url` (remove `device_token`) or set `device_token` to `null`/`""`.
3. Restart service.
4. Check logs for NEW code.
