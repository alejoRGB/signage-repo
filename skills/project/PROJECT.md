# Canonical Project Context

## Overview
**Product Name:** Expanded Signage (Digital Signage System)
**Version:** 1.1 (Feb 2026)
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
  - **Devices:** Pairing Code (6-digit). Device Token authentication. Token in `config.json` MUST match DB.

## Constraints
- **Hardware:** Raspberry Pi 4/5 targeting standard displays.
- **Operating System:** Raspberry Pi OS / Linux.
- **Network:** Devices must handle offline playback (cache required).
- **Multi-Device:** No synchronized playback (Video Wall features NOT supported).
- **Content:** Images, Videos, Web Pages. No mixed playlists (enforced via UI, handled via Mixed Loop if necessary).
- **Schedule:** Items calculated dynamically (Start = Prev End). Default duration 1h. Capped at 23:59.
- **Observability:** Dashboard displays assigned Schedule per device (or "No Schedule"). Status reflects connectivity and sync state.

## Key Workflows
1. **Pairing:** Device generates code -> User enters on Dashboard -> Token issued.
2. **Sync:** Device heartbeats (60s) -> Receives JSON payload -> Downloads media -> Reports `playingPlaylistId` -> Plays.
3. **Playback:**
   - Media: MPV loop.
   - Web: Chromium Kiosk.
   - Mixed: Python controller orchestrating MPV/Chromium handoff.
