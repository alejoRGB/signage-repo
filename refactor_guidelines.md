# Project Refactoring Guidelines for Agent

## Project Overview
This project is a Digital Signage solution consisting of two parts:
1.  **Dashboard**: A Next.js (App Router) application for managing devices, media, and playlists.
    *   Location: `dashboard/`
    *   Tech Stack: Next.js 16, Prisma (PostgreSQL), NextAuth.js, TailwindCSS.
2.  **Player**: A Python-based player that runs on a Raspberry Pi (Linux).
    *   Location: `player/`
    *   Tech Stack: Python 3, `mpv` (video player), `feh` (image viewer), logic for syncing with the dashboard API.

## ⚠️ Critical Context
*   **Target OS**: The Player IS intended for **Linux (Raspberry Pi)**. Do NOT "fix" Linux-specific commands (like `feh` or `/home/pi` paths) to work on Windows.
*   **Database**: Uses Prisma with SQLite (dev) or Postgres (prod).

---

## Refactoring Tasks

### 1. Dashboard Code Organization
**Objective**: Clean up the root directory and organize utility scripts.

*   [ ] **Move Scripts**: The `dashboard/` root contains many cluttering `.js` files (e.g., `check-db.js`, `debug-login.js`).
    *   **Action**: Create a directory `dashboard/scripts/`.
    *   **Action**: Move all `.js` utility scripts into this folder.
    *   **Action**: Update `package.json` "scripts" logic if any of these are referenced there (most seem to be manual dev tools).

### 2. UI Component Refactoring
**Objective**: Break down monolithic components to improve maintainability.

*   [ ] **Refactor `device-manager.tsx`**:
    *   **Source**: `dashboard/app/dashboard/devices/device-manager.tsx` (~32KB).
    *   **Action**: Split this file into smaller, reusable components.
    *   **Destination**: Create a new folder `dashboard/components/devices/` (or use `dashboard/app/components/devices/` if you prefer keeping them close to usage, but consistency is key).
    *   **Sub-components to extract**:
        *   `DeviceListTable`: The table displaying devices.
        *   `DeviceStatusBadge`: The visual chip for online/offline status.
        *   `AddDeviceModal`: The form for registering a new device.
        *   `DeviceActions`: The menu for edit/delete actions.

### 3. Logic & Data Consistency
**Objective**: Fix discrepancies between Database state and API responses.

*   [ ] **Fix Device Status Logic**:
    *   **Context**: The `Device` model has a `status` field, but `GET /api/devices` ignores it and calculates status on-the-fly based on `lastSeenAt`.
    *   **Action**:
        *   **Option A (Preferred for Real-time)**: Keep the on-the-fly calculation but make it explicit. Add a `computedStatus` field to the response type, or update the DB `status` field via a cron job/scheduled task (more complex).
        *   **Recommendation**: In `api/devices/route.ts`, the current on-the-fly calculation is fine, but it masks the DB field.
        *   **Task**: Update the logic to be consistent. If we rely on `lastSeenAt`, explicitly define that the `status` column in DB is for *administrative* states (e.g. "banned", "unpaired") vs *connectivity* states ("online"/"offline").
        *   **Task**: Ensure the frontend (`DeviceStatusBadge`) clearly distinguishes between "Online" (connected recently) and "Active" (enabled in DB).

### 4. Code Cleanup
*   [ ] **Component Directory**:
    *   **Current State**: `dashboard/components` exists but is empty/unused, while `dashboard/app/components` exists.
    *   **Action**: Decide on ONE location. Standard practice in Next.js App Router is often `components/` at src/root for shared UI. Move `dashboard/app/components/*` to `dashboard/components/` and update imports.

## Directory Structure Reference
```
root/
├── dashboard/           # Next.js App
│   ├── app/             # App Router Pages & API
│   │   ├── api/         # Backend Routes
│   │   └── dashboard/   # Admin UI Pages
│   ├── components/      # (Target for shared UI)
│   ├── lib/             # Singletons (prisma.ts, auth.ts)
│   ├── prisma/          # DB Schema
│   └── scripts/         # (NEW) Utility scripts
└── player/              # Python Client (Linux/Pi)
    ├── player.py        # Main playback logic
    └── sync.py          # API communication
```
