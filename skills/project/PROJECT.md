# Canonical Project Context

## Overview
**Product Name:** Expanded Signage (Digital Signage System)
**Version:** 1.3 (Feb 2026)
**Purpose:** Cloud-based digital signage management system with web dashboard and Raspberry Pi player client.

## Core Decisions
- **Architecture:** Hybrid Cloud + Edge.
  - **Cloud:** Web Dashboard (Next.js, Postgres, Vercel).
  - **Edge:** Player Client (Raspberry Pi, Python, MPV).
- **Control Flow:**
  - Dashboard is Source of Truth for configuration.
  - Player syncs via API (Push/Pull model via Heartbeat) and reports active state ("True Sync").
- **Authentication:**
  - **Users:** NextAuth (Email/Password) against `User` table.
  - **Admins:** NextAuth against `Admin` table. Separate credentials.
  - **Devices:** Pairing Code (6-digit, expires in 15 mins). Device Token authentication. Token in `config.json` MUST match DB.

## Security
- **Authorization:** Strict ownership checks on all mutating endpoints (`DELETE`, `PUT`, `PATCH`). Users can only modify their own resources.
- **Validation:** Zod schemas used for all API inputs. Backend blocking of schedule overlaps.
- **Hardening:** Debug endpoints (`/api/debug-env`, `/api/debug/playlist/[id]`) blocked in Production. Public API errors must not expose stack traces or internal details.

## Frontend Design & UX
- **Theme:** "Deep Space Minimal" (Dark, Gradient backgrounds, Glassmorphism elements).
- **Navigation:** Sidebar with Overview, Devices, Media, Playlists, Schedules.
- **Dashboard Global Tabs:** Top-level tabs `Schedules` and `Sync/VideoWall` wrap all `/dashboard/*` views.
  - `Schedules` contains the full existing dashboard shell (mobile header, sidebar, and all dashboard pages).
  - `Sync/VideoWall` is a placeholder panel with no functional content yet.
  - Tab view and active-directive selection are independent states.
  - Active-directive selection uses exclusive checkbox logic and is persisted per user.
- **Tab Specifications:**
  - **Devices:** Table view. Action buttons: Edit, Logs, Delete (icon-only, right aligned).
  - **Media:** Grid view. Card displays:
    - **Video:** Thumbnail + Duration + Resolution (e.g., 1920x1080).
    - **Image:** Thumbnail + Resolution.
    - **Web:** Placeholder + URL + Name.
  - **Playlists:** Expanded card view showing internal "Content Sequence" (list of items with individual durations).
  - **Schedules:**
    - List view remains unchanged.
    - Detail editor is a weekly grid with days on X-axis and 30-minute slots on Y-axis (00:00 to 23:30).
    - Playlist assignment is done by click + drag painting.
    - Explicit eraser mode is required.
    - Overlaps are resolved by replacement on paint (single playlist per slot).
    - Playlist colors are deterministic by playlist ID and must remain consistent between sessions.
    - Save model is manual ("Save Changes"), not autosave.
    - Desktop must fit full week without horizontal scroll; mobile uses single-day view.
  - **Modals & Forms:**
    - **Input/Select:** Must explicitly use `text-gray-900` on white backgrounds to ensure visibility against the tailwind reset.
    - **Destructive Actions:** Must use `ConfirmModal` + `useToast` pattern (no native `window.confirm`).

## Constraints
- **Hardware:** Raspberry Pi 4/5 targeting standard displays.
- **Operating System:** Raspberry Pi OS / Linux.
- **Network:** Devices must handle offline playback (cache required).
- **Multi-Device:** No synchronized playback (Video Wall features NOT supported).
- **Content:** Images, Videos, Web Pages. Mixed playlists are NOT supported (only `media` or `web` playlists).
- **Schedule:** Canonical editing model is slot-based (30-minute cells). Persisted API payload remains `dayOfWeek`, `startTime`, `endTime`, `playlistId`.
- **Observability:** Dashboard displays assigned Schedule per device (or "No Schedule"). Status reflects connectivity and sync state.

## Canonical Notes (2026-02-14)
- **Devices Sync UI:** The "Syncing..." label under playlist selector is now bounded by actual playback reporting.
- **Web behavior:** Devices table performs explicit polling to `/api/devices` every 10s for live `playingPlaylistId` and status updates.
- **UX rule:** Do not show persistent "Syncing..." when device has active playlist but has not yet reported a playback ID.

## Canonical Notes (2026-02-15)
- **Schedules Editor:** The redesigned grid editor is now the canonical production editor for `/dashboard/schedules/[scheduleId]` (no feature-flag dependency).
- **Schedules Grid Boundary:** Last visible time row is `23:30` (no `24:00` row).

## Canonical Notes (2026-02-16)
- **Dashboard Device Cards:** `/dashboard` includes device cards below summary stats. Cards are collapsible (collapsed by default), fixed expanded height (`280px`), and ordered by device creation.
- **Preview Source:** Device cards use media-library thumbnails (`MediaItem.url`) based on current content metadata. Device-side screen screenshots are not used as the visual preview source.
- **Status Consistency Rule:** `online/offline` shown in Dashboard device cards must match the Devices tab criteria.
- **Playlist Label Rule:** Playlist shown in Dashboard device cards must match the assigned playlist shown in Devices (`activePlaylist`).
- **Directive Tabs (Dashboard):** Global tabs were introduced above the dashboard shell: `Schedules` and `Sync/VideoWall`.
- **Directive Selection Persistence:** Active directive is persisted in DB per user (`User.activeDirectiveTab`) and updates on checkbox interaction.
- **Decoupled UX Rule:** Opening a tab view must not change active-directive checkbox state, and changing active-directive checkbox must not force a view switch.

## Key Workflows
1. **Pairing:** Device generates code -> User enters on Dashboard -> Token issued.
2. **Sync:** Device heartbeats (60s) -> Receives JSON payload -> Downloads media -> Reports `playingPlaylistId` -> Plays.
3. **Playback:**
   - Media: MPV loop.
   - Web: Chromium Kiosk.
   - Mixed: Python controller orchestrating MPV/Chromium handoff.
