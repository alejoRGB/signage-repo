# Digital Signage Monorepo

This repository contains both the web dashboard and the player software.

## Structure

- **/web**: Next.js Dashboard Application (Management Interface)
- **/player**: Python Player Service (Raspberry Pi Client)

## Getting Started (Quick Setup)

### 1. Unified Deployment & Setup
We use a single script to handle local setup and deployment.
```powershell
.\deploy.ps1
```
- **First Run**: It will automatically create your local configuration files (`web/.env`, `player/config.json`) and ask you which server to use (Vercel Production or Localhost).
- **Subsequent Runs**: It will deploy the code to your Raspberry Pi.

### 2. Manual Development
If you only want to work on the web dashboard:
1. Run `npm install` in `web/`.
2. Update `web/.env` with your real database/auth secrets (Ask team lead).
3. Run `npm run dev`.

### 3. Environment & Security
- **`web/.env`**: Manages local secrets. **NEVER COMMIT THIS FILE.**
- **`player/config.json`**: Manages player connection settings. **NEVER COMMIT THIS FILE.**
- **`setup_env.ps1`**: Helper script used by `deploy.ps1` to create the files above from templates.

### Player
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
