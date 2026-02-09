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
1. **Unified Playback Loop:** `player.py` controls the loop.
   - **Mixed Loop:** Standard mode. Used for Web content, Mixed content, AND Media-only playlists with custom (non-default) durations.
   - **Native Loop:** Optimization for Media-only playlists where ALL items use the default 10s duration. Generates ephemeral M3U and uses MPV's native infinite loop.
2. **Offline First:** Player *must* continue working if network fails.
3. **No Web sockets:** Communication is polling-based (Heartbeat every 60s) for simplicity and firewall affinity.
4. **True Sync Status:** Dashboard reflects *actual* device state (`playingPlaylistId`) reported via heartbeat, not just target intent.
5. **API Security:** Rate limiting (60 req/min) enforced on all Device endpoints (`/api/device/*`) to prevent abuse.
6. **Manual Deployment:** RPi deployment via `setup_device.sh` curl pipe.
