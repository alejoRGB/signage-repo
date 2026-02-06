---
name: mpv-playback
description: Defines production-grade mpv usage for Linux digital signage. Use when configuring video playback, mpv flags, or fixing playback issues on kiosk/unattended systems.
---

# MPV – Linux Digital Signage Playback

This skill is the **authoritative reference** for configuring mpv in unattended, kiosk-mode environments.

## When to use this skill
- Video playback in signage context
- mpv used directly or via subprocess (Python, Node.js, systemd)
- Fullscreen, looping, unattended playback
- Debugging black screens, audio issues, or UI leaks

## Canonical Command

**Baseline mpv command** – use unless explicitly justified otherwise:

```bash
mpv \
  --fullscreen \
  --no-border \
  --no-osc \
  --no-input-default-bindings \
  --input-vo-keyboard=no \
  --cursor-autohide=always \
  --hwdec=auto-safe \
  --loop=inf \
  --keep-open=no \
  --really-quiet \
  --audio=no \
  /path/to/video.mp4
```

## Mandatory Flags

| Flag | Purpose |
|------|---------|
| `--fullscreen` | Forces fullscreen playback |
| `--no-border` | Removes window decorations (X11) |
| `--no-osc` | Disables on-screen controller |
| `--no-input-default-bindings` | Prevents keyboard shortcuts |
| `--input-vo-keyboard=no` | Disables VO keyboard handling |
| `--cursor-autohide=always` | Hides cursor |
| `--hwdec=auto-safe` | Safe hardware decoding |
| `--keep-open=no` | Exit on failure (allows restart) |

## Audio Policy

**Default: `--audio=no`**

Reasons:
- HDMI handshake issues
- ALSA/Pulse deadlocks
- TVs muting video on audio failure

Enable audio only if explicitly required.

## Video Output Overrides

| Situation | Flag |
|-----------|------|
| Default | (let mpv decide) |
| Black screen/tearing | `--vo=gpu` |
| Legacy fallback | `--vo=x11` |

> ⚠️ Avoid Wayland unless entire stack is tested.

## Common Failure Modes

| Issue | Cause | Fix |
|-------|-------|-----|
| UI controls visible | Missing `--no-osc` | Add flag |
| User can exit with keyboard | Missing `--no-input-default-bindings` | Add flag |
| Black screen on boot | GPU not ready | Delay startup or `--vo=x11` |
| Playback blocked | HDMI/ALSA issues | Use `--audio=no` |

## Integration Rules

**mpv MAY be launched from:**
- Python subprocess
- Bash scripts
- systemd services
- Node.js child_process

**mpv MUST NEVER:**
- Handle scheduling
- Manage playlists
- Decide what content to play next

Those responsibilities belong to the signage application.

## Enforcement

- Deviations must be documented and justified

## Raspberry Pi 4 Optimized Configuration (Gapless)

For **seamless/gapless** playback on RPi 4, use this specific configuration. It prevents black flashes between videos and avoids freezing.

```bash
mpv \
  --playlist=/path/to/playlist.m3u \
  --fullscreen \
  --no-osd-bar \
  --no-audio-display \
  --image-display-duration=10 \
  --loop-playlist=inf \
  --prefetch-playlist=yes \
  --force-window=immediate \
  --keep-open=yes \
  --cache=yes \
  --demuxer-max-bytes=150M \
  --demuxer-max-back-bytes=50M \
  --hr-seek=yes \
  --gpu-context=auto \
  --hwdec=auto-safe
```

**Critical Flags for RPi:**
*   `--gpu-context=auto`: Prevents crashes common with `x11` or specific contexts on Pi.
*   `--keep-open=yes`: **Essential** for gapless. Keeps the window open at end of file (avoiding black flash) but allows playlist to advance (unlike `always`).
*   `--fixed-vo`: **DO NOT USE**. Not supported on standard Pi OS builds, causes fatal error.
*   `--demuxer-readahead-secs`: Can cause stuttering if too aggressive; rely on cache bytes instead.
