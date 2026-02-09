# Canonical Project Context

## Overview
**Product Name:** Expanded Signage (Digital Signage System)
**Version:** 1.2 (Feb 2026)
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
- **Hardening:** Debug endpoints (`/api/debug-env`) blocked in Production. Stack traces removed from API errors.

## Frontend Design & UX
- **Theme:** "Deep Space Minimal" (Dark, Gradient backgrounds, Glassmorphism elements).
- **Navigation:** Sidebar with Overview, Devices, Media, Playlists, Schedules.
- **Tab Specifications:**
  - **Devices:** Table view. Action buttons: Edit, Logs, Delete (icon-only, right aligned).
  - **Media:** Grid view. Card displays:
    - **Video:** Thumbnail + Duration + Resolution (e.g., 1920x1080).
    - **Image:** Thumbnail + Resolution.
    - **Web:** Placeholder + URL + Name.
  - **Playlists:** Expanded card view showing internal "Content Sequence" (list of items with individual durations).
  - **Schedules:** Weekly Calendar view (Grid).
  - **Modals & Forms:**
    - **Input/Select:** Must explicitly use `text-gray-900` on white backgrounds to ensure visibility against the tailwind reset.
    - **Destructive Actions:** Must use `ConfirmModal` + `useToast` pattern (no native `window.confirm`).

## Constraints
- **Hardware:** Raspberry Pi 4/5 targeting standard displays.
- **Operating System:** Raspberry Pi OS / Linux.
- **Network:** Devices must handle offline playback (cache required).
- **Multi-Device:** No synchronized playback (Video Wall features NOT supported).
- **Content:** Images, Videos, Web Pages. Mixed playlists supported via Python Mixed Loop.
- **Schedule:** Items calculated dynamically (Start = Prev End). Default duration 1h. Capped at 23:59.
- **Observability:** Dashboard displays assigned Schedule per device (or "No Schedule"). Status reflects connectivity and sync state.

## Key Workflows
1. **Pairing:** Device generates code -> User enters on Dashboard -> Token issued.
2. **Sync:** Device heartbeats (60s) -> Receives JSON payload -> Downloads media -> Reports `playingPlaylistId` -> Plays.
3. **Playback:**
   - Media: MPV loop.
   - Web: Chromium Kiosk.
   - Mixed: Python controller orchestrating MPV/Chromium handoff.
