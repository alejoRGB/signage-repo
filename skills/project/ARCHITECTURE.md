# Canonical Architecture Context

## Tech Stack
### Cloud (Dashbord & API)
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon Serverless)
- **ORM:** Prisma
- **Storage:** Vercel Blob
- **Styling:** Vanilla CSS (Refactoring to "Premium Dark SaaS" / Glassmorphism)
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
1. **Unified Playback Loop:** `player.py` controls the loop, launching externally managed processes (mpv/chromium) to avoid Python GIL issues and ensure hardware acceleration.
2. **Offline First:** Player *must* continue working if network fails.
3. **No Web sockets:** Communication is polling-based (Heartbeat every 60s) for simplicity and firewall affinity.
4. **Manual Deployment:** RPi deployment via `setup_device.sh` curl pipe.
