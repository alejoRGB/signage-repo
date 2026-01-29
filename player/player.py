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
        reg_data = self.sync_manager.register()
        if not reg_data:
            logging.warning("[PLAYER] Registration failed. Retrying in 10s...")
            time.sleep(10)
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
                    if item['startTime'] <= current_time_str < item['endTime']:
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
                    # For now, maybe stop MPV? Or show black?
                    # Requirement said: "reproducir una playlist por default".
                    # If we are here, it means NO default playlist exists either.
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
