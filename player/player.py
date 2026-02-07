#!/usr/bin/env python3
"""
Digital Signage Player - Optimized for Seamless Playback
Uses MPV playlist mode to avoid black screens between items.
"""

import os
import json
import subprocess
import time
import signal
from typing import Dict, List, Optional
from sync import SyncManager

import logging
from logger_service import LoggerService
from rotation_utils import ScreenRotator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s',
    handlers=[
        logging.StreamHandler() # Keep printing to stdout
    ]
)

# --- MPV SKILL CONFIGURATION ---
# See .agent/skills/mpv-playback/SKILL.md
ENABLE_AUDIO = False 
# -------------------------------

class Player:
    def __init__(self):
        # Dynamically find config based on user home
        home = os.path.expanduser("~")
        config_path = os.path.join(home, "signage-player", "config.json")
            
        self.sync_manager = SyncManager(config_path)
        
        # Add our custom remote logger
        self.remote_logger = LoggerService(self.sync_manager)
        logging.getLogger().addHandler(self.remote_logger)
        
        self.media_dir = self.sync_manager.media_dir
        self.playlist_m3u = os.path.join(os.path.dirname(config_path), "playlist.m3u")
        self.rotator = ScreenRotator()
        self.mpv_process = None
        self.running = True
        
        # Ensure DISPLAY is set
        if "DISPLAY" not in os.environ:
            os.environ["DISPLAY"] = ":0"
            
        self.start_unclutter()

    def start_unclutter(self):
        """Start unclutter to hide mouse cursor"""
        import shutil
        if shutil.which("unclutter"):
            try:
                # Kill existing to avoid duplicates
                subprocess.run(["pkill", "unclutter"], check=False)
                # Start new instance, idle 0.1s, root window (all screens)
                subprocess.Popen(["unclutter", "-idle", "0.1", "-root"])
                logging.info("[PLAYER] unclutter started (Mouse hidden)")
            except Exception as e:
                logging.error(f"[PLAYER] Failed to start unclutter: {e}")
        else:
            logging.warning("[PLAYER] unclutter not found. Mouse will be visible.")

    def generate_m3u(self, playlist: Dict) -> bool:
        """Generate M3U playlist file for MPV"""
        try:
            items = sorted(playlist['items'], key=lambda x: x['order'])
            
            with open(self.playlist_m3u, 'w') as f:
                for item in items:
                    filepath = os.path.join(self.media_dir, item['filename'])
                    if os.path.exists(filepath):
                        f.write(f"{filepath}\n")
            return True
        except Exception as e:
            logging.error(f"[PLAYER] Error generating M3U: {e}")
            return False

    def send_ipc_command(self, command: List[str]) -> bool:
        """Send a command to the running MPV instance via IPC"""
        import socket
        
        payload = json.dumps({"command": command}).encode() + b'\n'
        
        try:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                client.connect("/tmp/mpv-socket")
                client.sendall(payload)
                return True
        except Exception as e:
            # It's normal to fail if mpv isn't running or socket doesn't exist yet
            logging.warning(f"[PLAYER] IPC Command failed: {e}")
            return False

    def start_mpv(self):
        """Start MPV with the current playlist"""
        if self.mpv_process:
            self.stop_mpv()

        logging.info("[PLAYER] Starting MPV seamless playback...")
        try:
            # See mpv-playback skill for flag justification
            cmd = [
                "mpv",
                f"--playlist={self.playlist_m3u}",
                "--fullscreen",
                "--no-border",
                "--no-osc",
                "--no-input-default-bindings",
                "--input-vo-keyboard=no",
                "--cursor-autohide=always",
                "--hwdec=auto-safe",
                "--image-display-duration=10",
                "--loop-playlist=inf",
                "--prefetch-playlist=yes",
                "--force-window=immediate",
                "--cache=yes",
                "--demuxer-max-bytes=150M",
                "--demuxer-max-back-bytes=50M",
                "--hr-seek=yes",
                "--keep-open=no",
                "--really-quiet",
            ]

            if not ENABLE_AUDIO:
                cmd.append("--audio=no")

            cmd.append("--input-ipc-server=/tmp/mpv-socket")
            
            self.mpv_process = subprocess.Popen(cmd)
        except Exception as e:
            logging.error(f"[PLAYER] Failed to start MPV: {e}")

    def check_internet(self):
        """Simple check to see if we are online"""
        import socket
        try:
            # Connect to Google DNS
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except OSError:
            return False

    def _play_media_only_native(self, items: List[Dict], playlist_id: str, playlist_obj: Dict = None):
        """
        Native MPV playlist mode for media-only playlists (no web items).
        Generates M3U file and uses --loop-playlist=inf for seamless transitions.
        """
        logging.info(f"[NATIVE_MPV] Starting native MPV playback for {len(items)} media items.")
        
        # Apply playlist rotation if needed
        playlist_orientation = playlist_obj.get("orientation", "landscape") if playlist_obj else "landscape"
        if self.rotator.current_orientation != playlist_orientation:
            self.rotator.rotate(playlist_orientation)
        
        # Generate M3U playlist file
        m3u_path = os.path.join(self.media_dir, "current_playlist.m3u")
        try:
            with open(m3u_path, 'w') as f:
                f.write("#EXTM3U\n")
                for item in items:
                    filename = item.get('filename')
                    if filename:
                        local_path = os.path.join(self.media_dir, filename)
                        if os.path.exists(local_path):
                            f.write(f"{local_path}\n")
                        else:
                            logging.warning(f"[NATIVE_MPV] File not found: {local_path}")
            logging.info(f"[NATIVE_MPV] Generated M3U playlist: {m3u_path}")
        except Exception as e:
            logging.error(f"[NATIVE_MPV] Failed to write M3U: {e}")
            return
        
        # Stop any existing MPV
        self.stop_mpv()
        
        # Start MPV with native playlist looping (Raspberry Pi 4 optimized)
        # See mpv-playback skill
        try:
            cmd = [
                "mpv",
                f"--playlist={m3u_path}",
                "--fullscreen",
                "--no-osd-bar",
                "--no-audio-display",
                "--image-display-duration=10",
                "--loop-playlist=inf",
                "--prefetch-playlist=yes",
                "--force-window=immediate",
                "--keep-open=yes", # Keep window open (but not always, to allow loop)
                "--cache=yes",
                "--demuxer-max-bytes=150M",
                "--demuxer-max-back-bytes=50M",
                "--hr-seek=yes",
                "--gpu-context=auto",
            ]
            
            if ENABLE_AUDIO:
                cmd.append("--gapless-audio=yes")
            else:
                cmd.append("--audio=no")

            
            cmd.append("--input-ipc-server=/tmp/mpv-socket")

            self.mpv_process = subprocess.Popen(cmd)
            logging.info("[NATIVE_MPV] MPV started with native playlist loop.")
        except Exception as e:
            logging.error(f"[NATIVE_MPV] Failed to start MPV: {e}")
            return
        
        # Now loop to monitor for playlist changes and send heartbeats
        last_sync_time = 0 # Force immediate sync
        sync_interval = 60
        
        while self.running:
            # Check if MPV is still running
            if self.mpv_process and self.mpv_process.poll() is not None:
                logging.warning("[NATIVE_MPV] MPV process died unexpectedly. Will restart on next loop.")
                self.mpv_process = None
                break  # Break to let main loop restart
            
            # Heartbeat / Sync check
            if time.time() - last_sync_time > sync_interval:
                logging.debug("[NATIVE_MPV] Sending Heartbeat (Sync)...")
                self.sync_manager.sync(playlist_id)
                last_sync_time = time.time()
                
                # Check for playlist change (hot-swap)
                data = self.sync_manager.load_cached_playlist()
                new_target = self.get_current_target_playlist(data)
                new_id = new_target.get('id') if new_target else None
                
                if new_id != playlist_id:
                    logging.info(f"[NATIVE_MPV] Playlist changed ({playlist_id} -> {new_id}). Breaking loop.")
                    self.stop_mpv()
                    break
            
            time.sleep(1)
        
        logging.info("[NATIVE_MPV] Exiting native MPV playback loop.")

    def play_mixed_content_loop(self, items: List[Dict], playlist_id: str, playlist_obj: Dict = None):
        """
        Manages playback item-by-item to support Web/Mixed content.
        This blocks the main loop, so we need to be careful to check for schedule updates occasionally.
        
        OPTIMIZATION: For media-only playlists (no web), use native MPV playlist for seamless transitions.
        """
        logging.info(f"[MIXED_PLAYER] Starting mixed content loop with {len(items)} items. Playlist ID: {playlist_id}")
        
        # Check if ALL items are media (video/image) - no web items
        has_web = any(item.get('type') == 'web' for item in items)
        
        if not has_web and len(items) > 0:
            logging.info("[MIXED_PLAYER] Media-only playlist detected. Using native MPV playback for seamless transitions.")
            self._play_media_only_native(items, playlist_id, playlist_obj)
            return
        
        # Continue with mixed content loop for playlists with web items
        logging.info("[MIXED_PLAYER] Mixed content detected (has web items). Using item-by-item playback.")
        
        idx = 0
        browser_process = None
        current_browser_url = None
        
        # Sync control for mixed loop
        last_sync_time = 0 # Force immediate sync
        sync_interval = 60
        
        # Determine Playlist defaults
        playlist_orientation = "landscape"
        if playlist_obj:
            playlist_orientation = playlist_obj.get("orientation", "landscape")

        try:
            while self.running:
                item = items[idx]
                media = item
                m_type = media.get('type')
                
                # Duration Logic: Try item -> playlist default -> hard default
                duration = media.get('duration')
                if not duration and playlist_obj:
                    duration = playlist_obj.get('default_duration')
                if not duration:
                    duration = 10
                
                logging.info(f"[MIXED_PLAYER] Playing item {idx}: {media.get('name')} | Type: {m_type} | Duration: {duration}s")
                
                # Apply Screen Rotation: Item > Playlist > Default
                target_orientation = media.get('orientation')
                if not target_orientation:
                    target_orientation = playlist_orientation
                
                curr_orientation = self.rotator.current_orientation
                rotation_changed = curr_orientation != target_orientation
                
                logging.info(f"[MIXED_PLAYER] Rotation -> Target: {target_orientation} (Playlist: {playlist_orientation}) | Current: {curr_orientation}")
                
                if rotation_changed:
                    self.rotator.rotate(target_orientation)
                
                if rotation_changed and browser_process:
                    logging.info("[MIXED_PLAYER] Orientation changed. Forcing browser restart.")
                    try:
                        browser_process.terminate()
                        browser_process.wait(timeout=2)
                    except:
                        pass
                    browser_process = None
                    current_browser_url = None
                
                if m_type == 'web':
                    url = media.get('url')
                    cache_offline = media.get('cacheForOffline', False)
                    is_online = self.check_internet()
                    should_play = is_online or cache_offline
                    
                    if not should_play:
                        logging.warning(f"[MIXED_PLAYER] Skipping web item (Offline & No Cache Mode): {url}")
                        # If we skip, we should probably close the browser if it was open on this URL?
                        # Or just hold previous? Let's close to be safe.
                        if browser_process:
                            try:
                                browser_process.terminate()
                                browser_process.wait(timeout=1)
                            except:
                                pass
                            browser_process = None
                            current_browser_url = None

                    else:
                        self.stop_mpv()
                        
                        # Decide: Reuse or Start New?
                        reuse = False
                        if browser_process and current_browser_url == url:
                            if browser_process.poll() is None:
                                reuse = True
                                logging.info(f"[MIXED_PLAYER] Reusing existing browser for {url}")
                            else:
                                logging.warning("[MIXED_PLAYER] Browser process died. Restarting.")
                        
                        if not reuse:
                            # 1. Stop existing
                            if browser_process:
                                try:
                                    browser_process.terminate()
                                    browser_process.wait(timeout=2)
                                except:
                                    pass
                            
                            # 2. Find Executable (Optimized: check once or cached?)
                            # For safety, let's just do the check quickly
                            import shutil
                            browsers = ["chromium-browser", "chromium", "chromium-browser-v7", "google-chrome"]
                            browser_exec = None
                            for b in browsers:
                                if shutil.which(b):
                                    browser_exec = b
                                    break
                            
                            if not browser_exec:
                                logging.error("[MIXED_PLAYER] Chromium not found!")
                            else:
                                env = os.environ.copy()
                                # Suppress DBus errors by explicitly setting address if missing, or finding user bus
                                if "DBUS_SESSION_BUS_ADDRESS" not in env:
                                     uid = os.getuid()
                                     env["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path=/run/user/{uid}/bus"

                                cmd = [
                                    browser_exec,
                                    "--kiosk",
                                    f"--app={url}",
                                    "--noerrdialogs",
                                    "--disable-infobars",
                                    "--check-for-update-interval=31536000",
                                    "--no-sandbox",
                                    "--disable-setuid-sandbox",
                                    "--disable-gpu",
                                    "--disable-software-rasterizer",
                                    "--disable-dev-shm-usage",
                                    "--password-store=basic",
                                    "--user-data-dir=/home/masal/.config/chromium-signage-temp"
                                ]
                                try:
                                    browser_process = subprocess.Popen(cmd, env=env, stderr=subprocess.DEVNULL) # Reduce log spam
                                    current_browser_url = url
                                except Exception as e:
                                    logging.error(f"[MIXED_PLAYER] Failed to launch browser: {e}")
                                    browser_process = None
                        
                        # Wait for Duration (monitoring crash)
                        if browser_process:
                             start_time = time.time()
                             while time.time() - start_time < duration:
                                 if browser_process.poll() is not None:
                                     logging.error(f"[MIXED_PLAYER] Browser crashed early with code {browser_process.returncode}")
                                     browser_process = None # Mark dead
                                     current_browser_url = None
                                     break
                                 
                                 # HEARTBEAT CHECK (Inside Duration Loop)
                                 if time.time() - last_sync_time > sync_interval:
                                     logging.debug("[MIXED_PLAYER] Sending Heartbeat (Sync) during playback...")
                                     self.sync_manager.sync(playlist_id)
                                     last_sync_time = time.time()
                                     
                                     # HOT-SWAP CHECK
                                     data = self.sync_manager.load_cached_playlist()
                                     new_target = self.get_current_target_playlist(data)
                                     new_id = new_target.get('id') if new_target else None
                                     
                                     if new_id != playlist_id:
                                         logging.info(f"[MIXED_PLAYER] Detected playlist change ({playlist_id} -> {new_id}) during playback. Hot-swapping...")
                                         browser_process.terminate()
                                         browser_process = None
                                         current_browser_url = None
                                         break # Break inner wait loop
                                     
                                 time.sleep(0.5)

                
                else:
                    # Video/Image - Close Browser
                    if browser_process:
                        try:
                            browser_process.terminate()
                            browser_process.wait(timeout=2)
                        except:
                            pass
                        browser_process = None
                        current_browser_url = None

                    # Play MPV logic (Simplified for clarity)
                    if rotation_changed:
                         logging.info("[MIXED_PLAYER] Rotation changed. Restarting MPV.")
                         self.stop_mpv()

                    # Play MPV logic
                    filename = media.get('filename')
                    if filename:
                        local_path = os.path.join(self.media_dir, filename)
                        
                        # 1. Try Seamless Transition via IPC
                        ipc_success = False
                        if self.mpv_process and self.mpv_process.poll() is None:
                            # Use "loadfile" to switch content without closing window
                            # "replace" tells MPV to stop current and play this one immediately
                            ipc_success = self.send_ipc_command(["loadfile", local_path, "replace"])
                            if ipc_success:
                                logging.info(f"[MIXED_PLAYER] Seamless transition to {filename}")
                            else:
                                logging.warning("[MIXED_PLAYER] IPC failed. Restarting MPV.")
                                self.stop_mpv()
                        
                        # 2. Start new instance if needed
                        if not ipc_success:
                            try:
                                cmd = [
                                    "mpv",
                                    "--idle=yes",   # Keep open even after file ends
                                    "--keep-open=always", # ALWAYS keep window open (not just 'yes')
                                    "--force-window=immediate", # Force window to show immediately
                                    local_path,
                                    "--fullscreen",
                                    "--no-border",
                                    "--no-osc",
                                    "--no-input-default-bindings",
                                    "--input-vo-keyboard=no",
                                    "--cursor-autohide=always",
                                    "--no-terminal",
                                    f"--image-display-duration={duration}" if m_type == 'image' else "",
                                    "--input-ipc-server=/tmp/mpv-socket",
                                    "--hwdec=auto-safe",
                                    "--video-sync=display-resample", # Smoother playback
                                    "--cache=yes",
                                    "--cache-secs=10",
                                    "--demuxer-readahead-secs=5",
                                ]
                                
                                if ENABLE_AUDIO:
                                    cmd.append("--gapless-audio=yes")
                                else:
                                    cmd.append("--audio=no")

                                cmd = [c for c in cmd if c]
                                self.mpv_process = subprocess.Popen(cmd)
                                logging.info(f"[MIXED_PLAYER] Started MPV for {filename}")
                            except Exception as e:
                                logging.error(f"[MIXED_PLAYER] Failed to start MPV: {e}")
                                continue

                        # 3. Wait Loop (for Duration & Heartbeats)
                        # We use the same non-blocking logic as before to handle duration
                        start_time = time.time()
                        proc = self.mpv_process # Use class member
                        
                        while time.time() - start_time < duration:
                            # Check if MPV died
                            if proc.poll() is not None:
                                logging.warning("[MIXED_PLAYER] MPV died unexpectedly.")
                                self.mpv_process = None
                                break
                            
                            # HEARTBEAT CHECK
                            if time.time() - last_sync_time > sync_interval:
                                logging.debug("[MIXED_PLAYER] Sending Heartbeat (Sync)...")
                                self.sync_manager.sync(playlist_id)
                                last_sync_time = time.time()
                                
                                # HOT-SWAP CHECK
                                data = self.sync_manager.load_cached_playlist()
                                new_target = self.get_current_target_playlist(data)
                                new_id = new_target.get('id') if new_target else None
                                
                                if new_id != playlist_id:
                                    logging.info(f"[MIXED_PLAYER] Detected playlist change ({playlist_id} -> {new_id}). Hot-swapping...")
                                    # Don't kill MPV here if next playlist is media!
                                    # But for simplicity/safety of mixed content logic, let's break loop.
                                    # Verify next playlist type? No, just break.
                                    # Clean up will happen if type changes next loop or we can just stop it.
                                    # Let's stop it to be safe and ensure clean state for new playlist.
                                    self.stop_mpv()
                                    break 
                                    
                            time.sleep(0.5)

                        # End of Item Duration
                        # Do NOT kill MPV here! We want it to stay open for the next item.
                        # Unless rotation changed or next item is web (handled at start of loop)

                # Next Item
                idx = (idx + 1) % len(items)
                
                # HEARTBEAT CHECK
                if time.time() - last_sync_time > sync_interval:
                    logging.debug("[MIXED_PLAYER] Sending Heartbeat (Sync)...")
                    self.sync_manager.sync(playlist_id) # This updates lastSeenAt on server
                    last_sync_time = time.time()
                
                # Check for playlist change
                data = self.sync_manager.load_cached_playlist()
                new_target = self.get_current_target_playlist(data)
                
                if not new_target:
                     logging.info("[MIXED_PLAYER] No target playlist. Breaking.")
                     break
                     
                new_id = new_target.get('id')
                if new_id != playlist_id: 
                     logging.info(f"[MIXED_PLAYER] Schedule changed ({playlist_id} -> {new_id}). Breaking loop.")
                     break
        
        finally:
            # Reset Rotation to Landscape on exit
            self.rotator.rotate("landscape")
            
            # Cleanup on exit
            if browser_process:
                logging.info("[MIXED_PLAYER] Cleaning up browser process...")
                try:
                    browser_process.terminate()
                    browser_process.wait(timeout=2)
                except:
                    try:
                        browser_process.kill()
                    except:
                        pass


    def stop_mpv(self):
        """Stop the running MPV process"""
        if self.mpv_process:
            logging.info("[PLAYER] Restarting/Stopping MPV...")
            try:
                self.mpv_process.terminate()
                self.mpv_process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.mpv_process.kill()
            self.mpv_process = None

    def pairing_loop(self):
        """Handle pairing (same as before)"""
        logging.info("[PLAYER] Device unpaired. Starting pairing process...")
        
        # Reuse sync manager logic
        while self.running:
            reg_data = self.sync_manager.register()
            if reg_data:
                break
            logging.warning("[PLAYER] Registration failed. Retrying in 10s...")
            time.sleep(10)
        
        if not self.running:
            return

        code = reg_data['pairing_code']
        token = reg_data['device_token']
        poll_interval = reg_data.get('poll_interval', 5000) / 1000.0
        
        logging.info(f"PAIRING CODE: {code}")
        
        image_path = self.sync_manager.generate_pairing_image(code)
        viewer = None
        
        if image_path and os.path.exists(image_path):
            try:
                viewer = subprocess.Popen(["feh", "--fullscreen", image_path])
            except:
                pass

        while self.running:
            status = self.sync_manager.poll_status(token)
            if status == "paired":
                logging.info("[PLAYER] Device paired successfully!")
                self.sync_manager.save_config(token)
                break
            time.sleep(poll_interval)
            
        if viewer:
            viewer.terminate()
            subprocess.run(["pkill", "feh"], check=False)

    def get_current_target_playlist(self, sync_data: Dict) -> Optional[Dict]:
        """Determine which playlist should be playing right now based on schedule"""
        import datetime
        
        now = datetime.datetime.now()
        current_day_index = (now.weekday() + 1) % 7 # Python weekday 0=Mon. Our schema 0=Sun. So Mon=1, Sun=0.
        
        current_time_str = now.strftime("%H:%M") # "14:30"
        
        # Check Schedule
        if sync_data.get('schedule') and sync_data['schedule'].get('items'):
            for item in sync_data['schedule']['items']:
                if item['dayOfWeek'] == current_day_index:
                    start = item['startTime']
                    end = item['endTime']
                    
                    # Handle Midnight Wrap for current day
                    if end == "00:00":
                        end = "24:00"
                    
                    if start <= current_time_str < end:
                        logging.info(f"[SCHEDULER] Match Rule: {item['startTime']}-{item['endTime']} -> Playlist {item.get('playlist', {}).get('name')}")
                        return item.get('playlist')
        
        # Default
        if sync_data.get('default_playlist'):
            logging.debug("[SCHEDULER] Using Default Playlist")
            return sync_data['default_playlist']
            
        # Fallback to legacy
        if sync_data.get('playlist'):
             logging.debug("[SCHEDULER] Using Legacy Playlist")
             return sync_data['playlist']
             
        return None

    def run(self):
        print("=" * 50)
        print("Digital Signage Player (Scheduler Mode)")
        print("=" * 50)

        # 1. Pairing Check
        token = self.sync_manager.device_token
        if not token or token == "":
            self.pairing_loop()

        # 2. Initial Sync
        logging.info("[PLAYER] Performing initial sync...")
        self.sync_manager.sync()
        
        # 3. Main Loop
        current_playlist_id = None
        last_sync_time = 0
        sync_interval = 60
        check_schedule_interval = 10 
        last_check_time = 0

        while self.running:
            time.sleep(1)
            now_ts = time.time()
            
            # A. SYNC TASK
            if now_ts - last_sync_time > sync_interval:
                if self.sync_manager.sync(current_playlist_id):
                     logging.debug("[PLAYER] Sync completed")
                last_sync_time = now_ts

            # B. SCHEDULE CHECK TASK
            if now_ts - last_check_time > check_schedule_interval:
                last_check_time = now_ts
                
                # Load latest data
                data = self.sync_manager.load_cached_playlist()
                if not data:
                    continue
                
                target_playlist = self.get_current_target_playlist(data)
                
                if target_playlist:
                     target_id = target_playlist.get('id')
                     
                     if target_id != current_playlist_id:
                         logging.info(f"[PLAYER] Playlist changed! New: {target_playlist.get('name')} ({target_id})")
                         
                         items = target_playlist.get('items', [])
                         
                         # Always use the Item-by-Item Controller (Mixed Loop)
                         # This ensures consistent handling of:
                         # 1. Per-item duration (especially for images)
                         # 2. Per-item rotation
                         # 3. Web content
                         # 4. Seamless transitions (best effort)
                         
                         logging.info("[PLAYER] Starting Playback Loop...")
                         self.stop_mpv() 

                         # Optimization: Check content type here for explicit dispatch
                         has_web = any(x.get('type') == 'web' for x in items)
                         
                         if not has_web and len(items) > 0:
                             logging.info("[PLAYER] Optimized Mode: Native MPV Loop (Media Only)")
                             self._play_media_only_native(items, target_id, target_playlist)
                         else:
                             logging.info("[PLAYER] Standard Mode: Mixed Content Loop (Web + Media)")
                             self.play_mixed_content_loop(items, target_id, target_playlist)
                         
                         # CRITICAL FIX: If loop returns (crash/end), reset ID so it restarts next check
                         current_playlist_id = None 
                         continue
                         
                elif self.mpv_process:
                    # No playlist should be playing
                    logging.info("[PLAYER] No target playlist. Stopping playback.")
                    self.stop_mpv()
                    current_playlist_id = None


if __name__ == "__main__":
    player = Player()
    try:
        player.run()
    except KeyboardInterrupt:
        print("\n[PLAYER] Stopped")
        if player.mpv_process:
            player.mpv_process.terminate()
