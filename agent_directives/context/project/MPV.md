# MPV Player Context

## Playback Architecture
The player uses a hybrid approach to handle different content types and durations.

### 1. Mixed Content Loop (Standard)
- **Used for:** 
  - Playlists containing Web content.
  - Playlists containing Images with custom durations (not default).
  - Mixed media types (Video + Image + Web).
- **Mechanism:** Python controls the loop, launching MPV for each item or keeping an MPV instance alive.
- **IPC Strategy:** 
  - Uses a persistent Unix socket at `~/signage-player/mpv.sock`.
  - **Critical:** The Python script MUST explicitly wait for the socket to exist (`wait_for_socket()`) before sending commands to avoid race conditions.
  - Uses `loadfile` command for seamless transitions between items without closing the window.
- **Key Flags:** `mpv --idle --keep-open=yes --loop-file=inf --input-ipc-server=~/signage-player/mpv.sock`

### 2. Native Loop (Optimized)
- **Used for:** strictly homogenous media playlists (Images/Videos) where ALL items use the default duration.
- **Mechanism:** Generates a temporary `.m3u` playlist and launches MPV once with `--loop-playlist=inf`.
- **Pros:** Zero gap between items, lower CPU usage.
- **Cons:** Cannot handle per-item custom durations easily without complex EDL files.

### 3. Sync/VideoWall Mode (Implemented)
- **Used for:** active Sync sessions controlled by backend commands.
- **Mechanism:**
  - Player receives `sync.prepare` via command polling.
  - MPV starts in paused warm-up mode with Lua script `lua/videowall_sync.lua`.
  - Runtime loop applies correction policy:
    - deadband `< 25ms`
    - soft correction `25..500ms`
    - hard resync `>= 500ms`
- **Config files:**
  - `mpv-videowall.conf`
  - `lua/videowall_sync.lua`
- **State transitions:** `assigned -> preloading -> ready -> warming_up -> playing` with rejoin support.
- **Observability:** emits structured sync events (`READY`, `STARTED`, `HARD_RESYNC`, `REJOIN`, `MPV_CRASH`, `THERMAL_THROTTLE`).

## Hardware Acceleration (Canonical)
- **Selection Model:** Hardware decode backend MUST be selected by runtime capability detection, NOT by Raspberry Pi model string.
- **Selector Module:** `player/hwaccel.py` probes:
  - `mpv --hwdec=help`
  - accessible `/dev/video*` nodes (V4L2 mem2mem path)
  - accessible `/dev/dri/renderD*` nodes (DRM render path)
- **Current Priority Order:** `v4l2m2m-copy` -> `v4l2m2m` -> `auto-copy-safe` -> `auto-safe` -> `auto` -> `no`
- **Runtime Flaging Rule:** All MPV launch paths (mixed loop, native loop, videowall sync) MUST use the same runtime-selected hwdec backend and include `--gpu-context=auto`.
- **Config Ownership Rule:** `mpv-videowall.conf` MUST NOT hardcode `hwdec=...`; hwdec selection belongs to Python runtime.

## Configuration & Constraints
- **Socket Location:** MUST be in a persistent user directory (e.g., `~/signage-player/mpv.sock`), NOT `/tmp`.
  - Reason: `/tmp` cleaning policies or systemd isolation can cause "Connection refused" errors even if the process is running.
- **Startup Logic:** 
  1. Remove old socket file.
  2. Launch MPV subprocess with `--input-ipc-server=...`.
  3. Enter `while` loop to polling for socket existence (max 5s) before proceeding.
- **Seamless playback:** To prevent black screen flicker, MPV instances must be kept alive (`--idle --keep-open=yes`) and images should loop infinitely (`--loop-file=inf`) until the Python script explicitly commands a change via IPC.
- **Native Loop IPC Rule:** Native media-only MPV loop must also use the same persistent socket path (`~/signage-player/mpv.sock`) for consistency and diagnostics.
- **Diagnostics Package:** `v4l-utils` is an approved player dependency for runtime diagnostics (`v4l2-ctl`).

## Runtime Verification (Canonical)
- **Selection log:** `journalctl -u signage-player` should show `[HWACCEL] selected=<backend> ...`.
- **Command verification:** MPV command lines should include `--gpu-context=auto` and `--hwdec=<selected>`.
- **Strong runtime proof:** Query MPV IPC socket (`~/signage-player/mpv.sock`) property `hwdec-current`; expected non-empty backend (for example `v4l2m2m-copy`) during active video playback.
