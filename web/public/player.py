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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s',
    handlers=[
        logging.StreamHandler() # Keep printing to stdout
    ]
)

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
        self.mpv_process = None
        self.running = True
        
        # Ensure DISPLAY is set
        if "DISPLAY" not in os.environ:
            os.environ["DISPLAY"] = ":0"

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
            # --image-display-duration=10 : Default duration for images (can be tunable later)
            # --loop-playlist : Loop forever
            # --fullscreen : Fullscreen
            # --no-osd-bar : Clean look
            # --input-ipc-server : Allow controlling mpv while running
            cmd = [
                "mpv",
                f"--playlist={self.playlist_m3u}",
                "--fullscreen",
                "--no-osd-bar",
                "--no-audio-display",
                "--image-display-duration=10",
                "--loop-playlist=inf",
                "--prefetch-playlist=yes",
                "--force-window=immediate",
                "--cache=yes",
                "--demuxer-max-bytes=150M",
                "--demuxer-max-back-bytes=50M",
                "--hr-seek=yes",
                "--gpu-context=auto",
                "--input-ipc-server=/tmp/mpv-socket"
            ]
            
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

    def play_mixed_content_loop(self, items: List[Dict], playlist_id: str):
        """
        Manages playback item-by-item to support Web/Mixed content.
        This blocks the main loop, so we need to be careful to check for schedule updates occasionally.
        """
        logging.info(f"[MIXED_PLAYER] Starting mixed content loop with {len(items)} items. Playlist ID: {playlist_id}")
        
        idx = 0
        browser_process = None
        current_browser_url = None
        
        # Sync control for mixed loop
        last_sync_time = time.time()
        sync_interval = 60

        try:
            while self.running:
                item = items[idx]
                media = item
                m_type = media.get('type')
                duration = media.get('duration', 10) 
                
                logging.info(f"[MIXED_PLAYER] Playing item {idx}: {media.get('name')} ({m_type})")
                
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
                                    "--user-data-dir=/home/masal/.config/chromium-signage-temp"
                                ]
                                try:
                                    browser_process = subprocess.Popen(cmd)
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
                                     self.sync_manager.sync()
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
                    filename = media.get('filename')
                    if filename:
                        local_path = os.path.join(self.media_dir, filename)
                        try:
                            cmd = [
                                "mpv",
                                local_path,
                                "--fullscreen",
                                "--no-osd-bar",
                                f"--image-display-duration={duration}" if m_type == 'image' else "",
                                "--no-terminal"
                            ]
                            cmd = [c for c in cmd if c]
                            proc = subprocess.Popen(cmd)
                            proc.wait() 
                        except Exception as e:
                             logging.error(f"[MIXED_PLAYER] Media failed: {e}")

                # Next Item
                idx = (idx + 1) % len(items)
                
                # HEARTBEAT CHECK
                if time.time() - last_sync_time > sync_interval:
                    logging.debug("[MIXED_PLAYER] Sending Heartbeat (Sync)...")
                    self.sync_manager.sync() # This updates lastSeenAt on server
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
                if self.sync_manager.sync():
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
                         
                         # Check if mixed content (Web vs Video)
                         items = target_playlist.get('items', [])
                         has_web = any(item.get('type') == 'web' for item in items)
                         
                         if has_web:
                             # mixed mode logic would go here, for now we just handle switching
                             # But wait, the original logic assumes MPV for everything. 
                             # If we have web items, we can't just throw them at MPV.
                             # We need a new "Play Loop" that iterates items one by one.
                             logging.info("[PLAYER] Mixed content detected. Switching to Item-by-Item Controller.")
                             self.stop_mpv()
                             self.play_mixed_content_loop(items, target_id)
                             current_playlist_id = target_id
                             continue
                         
                         if self.generate_m3u(target_playlist):
                             # 1. Try Seamless IPC Switch first
                             ipc_success = False
                             if self.mpv_process and self.mpv_process.poll() is None:
                                 # "loadlist <file> replace" replaces the current playlist and starts playing it
                                 ipc_success = self.send_ipc_command(["loadlist", self.playlist_m3u, "replace"])
                             
                             if ipc_success:
                                 logging.info("[PLAYER] Seamlessly switched playlist via IPC.")
                                 current_playlist_id = target_id
                             else:
                                 # 2. Fallback to Restart
                                 logging.info("[PLAYER] IPC failed or MPV not running. Restarting process.")
                                 self.start_mpv()
                                 current_playlist_id = target_id
                         else:
                             logging.error("[PLAYER] Failed to generate M3U")
                
                elif self.mpv_process:
                    # No playlist should be playing (e.g. gaps in schedule and no default)
                    logging.info("[PLAYER] No target playlist. Stopping playback.")
                    self.stop_mpv()
                    current_playlist_id = None

            # Check if MPV crashed
            if self.mpv_process and self.mpv_process.poll() is not None:
                logging.error("[PLAYER] MPV exited unexpectedly. Restarting...")
                self.start_mpv()


if __name__ == "__main__":
    player = Player()
    try:
        player.run()
    except KeyboardInterrupt:
        print("\n[PLAYER] Stopped")
        if player.mpv_process:
            player.mpv_process.terminate()
