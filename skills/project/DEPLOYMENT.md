# Canonical Deployment Context

## Cloud Deployment (Vercel)
- **Repo:** GitHub connected.
- **Canonical Production URL:** `https://senaldigital.xyz`
- **Canonical Project Link:** scope `alejos-projects-7a73f1be`, project `signage-repo-dc5s`
- **Environment:**
  - `DATABASE_URL_UNPOOLED`: Neon Postgres **non-pooler** connection string (required by Prisma; must NOT include `-pooler`).
  - `NEXTAUTH_SECRET`: Auth secret.
  - `NEXT_PUBLIC_APP_URL`: Canonical URL for the app (prevents Host Header Injection in sync).
  - `SYNC_VIDEOWALL_ENABLED`: Feature gate for Sync UI + Sync session control (`true`/`false`, default `false`).
  - `SYNC_LAN_ENABLED`: Enables LAN beacon timing in sync sessions (`true`/`false`, default `false`).
  - `SYNC_LAN_BEACON_HZ`: Master beacon frequency in Hz (default `20`).
  - `SYNC_LAN_BEACON_PORT`: UDP port for LAN beacons (default `39051`).
  - `SYNC_LAN_TIMEOUT_MS`: Follower timeout before cloud fallback (default `1500`).
  - `SYNC_LAN_FALLBACK_TO_CLOUD`: Enables automatic follower fallback to cloud timing (`true`/`false`, default `true`).
  - `BLOB_READ_WRITE_TOKEN`: Vercel Blob access.
  - `E2E_USERNAME` / `E2E_PASSWORD`: Required for credentialed E2E testing (DO NOT hardcode in tests).
  - `E2E_ADMIN_USERNAME` (or `E2E_ADMIN_EMAIL`) / `E2E_ADMIN_PASSWORD`: Required for credentialed admin E2E testing on `/admin`.
  - `E2E_BASE_URL`: Optional override for Playwright; defaults to canonical production URL.
  - `E2E_SYNC_MODE`: Optional QA selector for Sync gate tests (`on` / `off`). This does NOT toggle product feature flags.

## Security & Maintenance
- **Credentials:** 
  - Never commit hardcoded secrets. `git rm --cached` used to enforce this.
  - Rotated credentials (Feb 2026) due to historic exposure.
- **Gitignore:** Ensure `web/dev.db`, `web/public/uploads`, `playwright-report`, `test-results`, and `.env*` are ignored.
- **QA Artifacts:** Also ignore `qa_automation/playwright-report` and `qa_automation/test-results`.
- **Admin Recovery:** Use `web/scripts/reset_password.js` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars to reset admin credentials directly in DB.
- **Device Debugging:** Use `web/scripts/check_devices.js` to verify device tokens and status in DB.

## Sync Release Checklist (Vercel)
1. Confirm env vars in target environment:
   - `SYNC_VIDEOWALL_ENABLED=true` (only when rollout stage enables Sync)
   - If LAN timing rollout is enabled:
     - `SYNC_LAN_ENABLED=true`
     - `SYNC_LAN_BEACON_HZ`, `SYNC_LAN_BEACON_PORT`, `SYNC_LAN_TIMEOUT_MS`, `SYNC_LAN_FALLBACK_TO_CLOUD` set as intended
   - `NEXT_PUBLIC_APP_URL`, `DATABASE_URL_UNPOOLED`, `NEXTAUTH_SECRET` valid.
2. Deploy web from `master`.
3. Run DB migrations in deployed environment:
```bash
cd web
npx prisma migrate deploy
npx prisma generate
```
4. Validate Sync test gate locally before production promotion:
```bash
python execution/run_tests.py sync
python execution/run_tests.py qa:smoke --project=chromium
python execution/run_tests.py qa:regression --project=chromium
# If Sync flag is enabled in the target environment:
python execution/run_tests.py qa:sync:on --project=chromium
# If Sync flag is disabled in the target environment:
python execution/run_tests.py qa:sync:off --project=chromium
```
5. Execute staging runbook before scaling rollout:
   - `docs/sync_qa_runbook.md`
   - Validate start alignment from persisted `DeviceLog` events (`STARTED.data.started_at_ms`) with inter-device gap `<= 100ms`.
6. If Sync tuning defaults are changed in web code (for example `web/lib/sync-command-service.ts`), redeploy web before validating behavior on devices.
   - Confirmation rule: player logs for new sessions must show the expected tuning tuple in `[VIDEOWALL] Sync tuning ...`.
   - If logs still show old values (`soft=[25,500] deadband=25`), web deploy has not applied yet.
7. Rollback (fast):
   - Set `SYNC_VIDEOWALL_ENABLED=false`
   - Redeploy web
   - Keep Schedules path operational.

## Canonical Notes (2026-02-21)
- **Failover re-prepare guarantee:**
  - In failover, backend now enqueues `SYNC_PREPARE` for the newly elected master as well (not only followers/old master).
  - Validation anchor: `web/__tests__/api/sync-master-failover.test.ts`.
- **LAN diagnostics persisted in DB:**
  - `SyncSessionDevice` includes `lanMode` and `lanBeaconAgeMs`.
  - Migration required in target env:
```bash
cd web
npx prisma migrate deploy
npx prisma generate
```
- **Device sync base URL fallback:**
  - `/api/device/sync` now falls back to request origin when `NEXT_PUBLIC_APP_URL` is unset.
  - Validation anchor: `web/__tests__/api/device-heartbeat-sync.test.ts`.
- **QA failover chaos test (opt-in):**
  - Added `qa_automation/tests/4_sync_failover.spec.ts`.
  - Run manually only when explicitly enabled:
```powershell
cd qa_automation
$env:E2E_SYNC_FAILOVER_RUN="true"
$env:E2E_SYNC_STOP_CMD_<MASTER_KEY>="<stop command>"
$env:E2E_SYNC_START_CMD_<MASTER_KEY>="<start command>"
npx playwright test tests/4_sync_failover.spec.ts
```

## Canonical QA Runtime Notes (Updated Feb 19, 2026)
- Production QA runs use:
  - `E2E_BASE_URL=https://senaldigital.xyz`
  - Credentialed dashboard auth (`E2E_USERNAME`, `E2E_PASSWORD`)
  - Credentialed admin auth (`E2E_ADMIN_USERNAME` or `E2E_ADMIN_EMAIL`, plus `E2E_ADMIN_PASSWORD`)
- Playwright credentialed specs must normalize env values (`trim`) before login usage to avoid false failures from trailing whitespace in external env providers.
- Sync gate behavior is controlled only by deployment env var `SYNC_VIDEOWALL_ENABLED`.
- `E2E_SYNC_MODE` only decides which test subset runs:
  - `qa:sync:on` -> runs `@sync-on`
  - `qa:sync:off` -> runs `@sync-off`
- Recommended policy to avoid excessive production redeploys:
  - Validate `qa:sync:on` in production when production flag is ON.
  - Validate `qa:sync:off` in staging/preview with flag OFF.
  - Toggle production flag only when explicitly validating rollback behavior.
- Confirmed on Feb 19, 2026:
  - `qa:smoke` passed against production.
  - `qa:sync:off` passed when `SYNC_VIDEOWALL_ENABLED=false` and deployment was redeployed.
  - `qa:sync:on` passed after restoring `SYNC_VIDEOWALL_ENABLED=true` and redeploying.

## Canonical Production Baseline (Feb 19, 2026)
- Branch: `master`
- Commit source of truth: latest successful `origin/master` deployment
- Active aliases include `https://senaldigital.xyz` and `https://signage-repo-dc5s.vercel.app`.
- Repository history was sanitized after secret exposure; all local clones must sync with `fetch + hard reset` (or fresh clone) before continuing.

## Canonical Deployment Rules (Updated Feb 20, 2026)
- Scope classification is mandatory before deployment:
  - `Web-only`: deploy/verify Vercel only.
  - `Player-only`: deploy/verify Raspberry devices only.
  - `Mixed`: run both workflows.
- Do not trigger unnecessary deploy loops:
  - If only player files changed, skip web redeploy validation.
  - If only web files changed, skip Raspberry rollout.
- For player sync fixes, deployment is complete only after:
  - code copied to each target device,
  - `signage-player` service is active,
  - runtime logs show expected sync events for a live session.

## Sync Runtime Verification (Player) (Updated Feb 20, 2026)
- After deploying sync-related player changes, validate on a real running session:
  - `journalctl -u signage-player -f` should include runtime sync signals (`VIDEOWALL_SYNC`, and when applicable `SOFT_CORRECTION` / `HARD_RESYNC`).
  - DB runtime fields in `SyncSessionDevice` should move away from flat zero when drift exists (`avgDriftMs`, `maxDriftMs`, `resyncCount`).
  - Session health panel should update `last heartbeat`, `drift avg`, and `drift max` continuously.
  - In LAN-enabled sessions, runtime should report LAN diagnostics:
    - `lan_mode` expected as `master` (master device) or `follower` (followers),
    - on beacon loss, `lan_mode` transitions to `cloud_fallback` without session interruption.

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

### Multi-Device Deploy (Sync pilot/fleet)
- Deploy player updates device by device:
```powershell
python execution/player_ops.py deploy -PlayerIp <IP> -PlayerUser <USER>
```
- In environments without SSH keys, password-based `plink/pscp` with host-key pinning is an accepted fallback for urgent player-only rollout.
- Validate service and clock after each deploy:
```powershell
python execution/player_ops.py remote_status -PlayerIp <IP> -PlayerUser <USER>
```
```bash
chronyc tracking
```
- If player logs show `Invalid device token`, re-pair the device (clear/remove token in `~/signage-player/config.json` and restart service).
- For Sync diagnostics after deploy, also capture:
  - `journalctl -u signage-player` filtered by `VIDEOWALL_SYNC`, `HARD_RESYNC`, `SOFT_CORRECTION`
  - Latest `Dropped` frame counters from mpv log lines.

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
  - **Flujo de config:** Si `player/config.json` no existe en tu PC, `deploy.ps1` llama primero a `setup_env.ps1` para generarlo. En deploy normal, el script preserva `~/signage-player/config.json` remoto si ya existe (evita resetear pairing). Para sobrescribirlo explícitamente usar `-ForceConfigSync`.
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
For Sync/Videowall sessions use chrony health check:
```bash
sudo systemctl status chrony
chronyc tracking
```
If `chronyc tracking` is unhealthy, devices will not transition to `READY` in sync mode.

### Force Pairing Reset
If code is invalid/expired:
1. Stop service.
2. Create config with ONLY `server_url` (remove `device_token`) or set `device_token` to `null`/`""`.
3. Restart service.
4. Check logs for NEW code.
