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

## Configuration & Constraints
- **Socket Location:** MUST be in a persistent user directory (e.g., `~/signage-player/mpv.sock`), NOT `/tmp`.
  - Reason: `/tmp` cleaning policies or systemd isolation can cause "Connection refused" errors even if the process is running.
- **Startup Logic:** 
  1. Remove old socket file.
  2. Launch MPV subprocess with `--input-ipc-server=...`.
  3. Enter `while` loop to polling for socket existence (max 5s) before proceeding.
- **Seamless playback:** To prevent black screen flicker, MPV instances must be kept alive (`--idle --keep-open=yes`) and images should loop infinitely (`--loop-file=inf`) until the Python script explicitly commands a change via IPC.
