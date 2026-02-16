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
   - **Web Loop:** Used for `web` playlists with Chromium playback and schedule-based switching.
   - **Native Media Loop:** Optimized mode for homogeneous video media playlists (MPV native loop).
2. **Offline First:** Player *must* continue working if network fails.
3. **No Web sockets:** Communication is polling-based (Heartbeat every 60s).
4. **True Sync Status:** Dashboard reflects *actual* device state (`playingPlaylistId`) and refreshes device state from `/api/devices` every 10s in Devices UI.
   - "Syncing..." is shown only while there is explicit mismatch between active playlist and a reported `playingPlaylistId`, or during optimistic update.
5. **API Security:** 
   - Rate limiting (60 req/min) enforced on all Device endpoints.
   - **Strict Ownership:** Middleware/Logic ensures users only access their own data.
   - **Input Validation:** Zod schemas validate all incoming JSON.
   - **Error Hygiene:** Production API responses must not include stack traces or internal exception details.
6. **Chromium Security Policy (Player):**
   - Default execution is sandbox-enabled.
   - `--no-sandbox` is allowed only as compatibility fallback (explicit override) or when the process is running as root.
7. **Manual Deployment:** RPi deployment via `deploy.ps1` (PowerShell) or `setup_device.sh`.
8. **Schedules Editor Architecture (Web):**
   - Production route `/dashboard/schedules/[scheduleId]` uses the redesigned slot-grid editor as canonical UI.
   - UI model is a 7x48 weekly grid (30-minute slots, 00:00 to 23:30).
   - Interaction model: click + drag paint, explicit eraser mode, and replacement on overlap.
   - Persistence model remains API-compatible through conversion to schedule items (`dayOfWeek`, `startTime`, `endTime`, `playlistId`) on manual save.
9. **Dashboard Device Preview Architecture (Web):**
   - Dashboard device cards resolve preview visuals from existing `MediaItem` records (`MediaItem.url`) using the device's reported current content identifier.
   - Device cards display assigned playlist (`activePlaylist`) and assigned schedule metadata from `/api/devices`.
   - Dashboard polling for device cards runs every 5s, while online/offline status uses the same criteria as Devices view.
10. **Dashboard Directive Tabs Architecture (Web):**
   - Global tabs are rendered at `/dashboard/*` layout level and control two independent states:
     - **Viewed tab:** Which panel is shown (`Schedules` or `Sync/VideoWall`).
     - **Active directive tab:** Which mode is marked active for directives.
   - Feature gate: `SYNC_VIDEOWALL_ENABLED` controls whether Sync tab is exposed.
   - If Sync is disabled, UI falls back to `Schedules` and does not render Sync controls.
   - Active directive tab is persisted per user in DB (`User.activeDirectiveTab`) through authenticated endpoint `/api/dashboard/directive-tab`.
   - Checkbox interaction updates persisted active directive tab (exclusive selection).
   - Tab click updates viewed panel only.
   - `Schedules` panel renders full existing dashboard shell; `Sync/VideoWall` hosts operational videowall controls when enabled.
11. **Sync Rollout Guardrails (Ops):**
   - Rollout order: `3 devices` pilot -> `10 devices` -> `20 devices`.
   - Progress to next stage only if drift/health KPIs remain within runbook thresholds.
   - Rollback path is fast and reversible: set `SYNC_VIDEOWALL_ENABLED=false` and redeploy.
   - Rollback must preserve existing Schedules behavior with no schema or playlist migration required.
