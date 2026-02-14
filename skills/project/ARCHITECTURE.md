# Canonical Architecture Context

## Tech Stack
### Cloud (Dashbord & API)
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon Serverless)
- **ORM:** Prisma
- **Storage:** Vercel Blob
- **Styling:** Tailwind CSS v4 (Deep Space Theme)
  - Config: Native CSS variables in `globals.css` (No `tailwind.config.ts`)
- **Auth:** NextAuth.js
- **Validation:** Zod

### Edge (Player Client)
- **Hardware:** Raspberry Pi
- **Language:** Python 3
- **Playback Engine:**
  - `mpv` (Video/Images)
  - `chromium-browser` (Web Content)
  - `feh` (Static images/Pairing code)
- **Process Management:** systemd
- **Rotation:** xrandr

## Agent Roles
- **Coordinator:** Orchestrates and routes tasks.
- **Frontend:** Next.js/React/CSS implementation.
- **Backend:** API/Prisma/DB implementation.
- **Player:** Python/RPi implementation.
- **QA:** Playwright/Pytest verification.

## Architecture Decisions
1. **Unified Playback Loop:** `player.py` controls the loop. See [MPV Context](MPV.md).
   - **Mixed Loop:** Standard mode. Used for almost ALL playlists (Web + Custom Image Durations + Mixed Types). Uses IPC/Socket for control.
   - **Native Loop:** Optimized mode strictly for homogenous media playlists where ALL items use the default global duration. Uses MPV native playlist looping.
2. **Offline First:** Player *must* continue working if network fails.
3. **No Web sockets:** Communication is polling-based (Heartbeat every 60s).
4. **True Sync Status:** Dashboard reflects *actual* device state (`playingPlaylistId`).
5. **API Security:** 
   - Rate limiting (60 req/min) enforced on all Device endpoints.
   - **Strict Ownership:** Middleware/Logic ensures users only access their own data.
   - **Input Validation:** Zod schemas validate all incoming JSON.
   - **Error Hygiene:** Production API responses must not include stack traces or internal exception details.
6. **Chromium Security Policy (Player):**
   - Default execution is sandbox-enabled.
   - `--no-sandbox` is allowed only as compatibility fallback (explicit override) or when the process is running as root.
7. **Manual Deployment:** RPi deployment via `deploy.ps1` (PowerShell) or `setup_device.sh`.
