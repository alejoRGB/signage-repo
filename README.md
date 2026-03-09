# Digital Signage Monorepo

This repository contains both the web dashboard and the player software.

## Structure

- **/web**: Next.js Dashboard Application (Management Interface)
- **/player**: Python Player Service (Raspberry Pi Client)
- **/qa_automation**: Playwright-based QA and local smoke coverage
- **/execution**: helper scripts to run grouped validation flows

## Recommended setup

### 1. Bootstrap local config

We use a single script to handle local setup and deployment.
```powershell
.\deploy.ps1
```
- First run creates local config files such as `web/.env` and `player/config.json`.
- Subsequent runs can deploy the player code to a Raspberry Pi.

### 2. Develop locally

Web dashboard:
```powershell
cd web
npm install
npm run dev
```

Player tests:
```powershell
cd player
python -m pytest -q
```

Local smoke E2E:
```powershell
cd qa_automation
npm install
npm run test:local
```

### 3. Validate before deploy

From `web/`:
```powershell
npm run lint
npm run build
npm run test:api
npm run test:ui
npm run test:e2e
```

From `player/`:
```powershell
python -m pytest -q
```

Or run the grouped sync-focused suite from the repo root:
```powershell
python execution/run_tests.py sync
```

## Environment and security

- **`web/.env`**: Manages local secrets. **NEVER COMMIT THIS FILE.**
- **`player/config.json`**: Manages player connection settings. **NEVER COMMIT THIS FILE.**
- **`setup_env.ps1`**: Helper script used by `deploy.ps1` to create the files above from templates.

## Player deployment

Preferred (from your PC, username-agnostic):
1. SSH into the Pi and run:
```bash
sudo apt update
sudo apt upgrade -y
```
2. From the repo root on your PC:
```powershell
.\deploy.ps1 -PlayerIp <PI_IP> -PlayerUser <USER>
```

Alternative (manual install on the Pi, safer than `curl | bash`):
```bash
curl -sLf -o /tmp/signage-setup_device.sh \
  https://raw.githubusercontent.com/alejoRGB/signage-repo/<TAG_OR_COMMIT>/player/setup_device.sh
less /tmp/signage-setup_device.sh
echo "<SHA256_OF_PLAYER_SETUP_DEVICE_SH>  /tmp/signage-setup_device.sh" | sha256sum -c -
SIGNAGE_REPO_REF=<TAG_OR_COMMIT> \
SIGNAGE_SERVER_URL="https://signage-repo-dc5s.vercel.app" \
bash /tmp/signage-setup_device.sh
```

Use a pinned tag/commit for `SIGNAGE_REPO_REF` (required) and verify the downloaded script checksum before execution. The legacy installer (`web/public/install.sh`) now also refuses to run without `SIGNAGE_SETUP_SHA256`.

## Where to look next

- `web/README.md`: dashboard-specific setup and validation
- `player/INSTALL_INSTRUCTIONS.md`: Raspberry Pi installation details
- `qa_automation/README.md`: QA and Playwright flows
- `DEPLOY_INSTRUCTIONS.md`: deployment procedure
