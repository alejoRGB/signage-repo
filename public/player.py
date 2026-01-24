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
import requests
from datetime import datetime
from typing import Dict, List, Optional
from sync import SyncManager

class Player:
    def __init__(self):
        # Dynamically find config based on user home
        home = os.path.expanduser("~")
        config_path = os.path.join(home, "signage-player", "config.json")
            
        self.sync_manager = SyncManager(config_path)
        self.media_dir = self.sync_manager.media_dir
        self.playlist_m3u = os.path.join(os.path.dirname(config_path), "playlist.m3u")
        self.mpv_process = None
        self.running = True
        
        # Watchdog state
        self.last_health_check = time.time()
        self.mpv_restart_count = 0
        self.last_mpv_check_time = time.time()
        self.watchdog_log = os.path.join(os.path.dirname(config_path), "watchdog.log")
        
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
            print(f"[PLAYER] Error generating M3U: {e}")
            return False

    def start_mpv(self):
        """Start MPV with the current playlist"""
        if self.mpv_process:
            self.stop_mpv()

        print("[PLAYER] Starting MPV seamless playback...")
        try:
            # --image-display-duration=10 : Default duration for images (can be tunable later)
            # --loop-playlist : Loop forever
            # --fullscreen : Fullscreen
            # --no-osd-bar : Clean look
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
                "--gpu-context=auto" 
            ]
            
            self.mpv_process = subprocess.Popen(cmd)
        except Exception as e:
            print(f"[PLAYER] Failed to start MPV: {e}")

    def stop_mpv(self):
        """Stop the running MPV process"""
        if self.mpv_process:
            print("[PLAYER] Restarting/Stopping MPV...")
            try:
                self.mpv_process.terminate()
                self.mpv_process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.mpv_process.kill()
            self.mpv_process = None

    def is_mpv_running(self) -> bool:
        """Check if MPV process is running"""
        if not self.mpv_process:
            return False
        return self.mpv_process.poll() is None

    def is_mpv_responsive(self) -> bool:
        """Check if MPV is responsive (not frozen)"""
        if not self.is_mpv_running():
            return False
        
        # Check if process is in a good state
        try:
            # If poll() returns None, process is still running
            if self.mpv_process.poll() is None:
                return True
        except Exception as e:
            print(f"[WATCHDOG] Error checking MPV responsiveness: {e}")
            return False
        
        return False

    def check_mpv_health(self) -> bool:
        """Comprehensive MPV health check"""
        if not self.is_mpv_running():
            self.log_watchdog_event("mpv_not_running", "MPV process not found")
            return False
        
        if not self.is_mpv_responsive():
            self.log_watchdog_event("mpv_unresponsive", "MPV process unresponsive")
            return False
        
        return True

    def log_watchdog_event(self, event_type: str, details: str):
        """Log watchdog events locally and send to dashboard"""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] {event_type}: {details}\n"
        
        # Log locally
        try:
            with open(self.watchdog_log, 'a') as f:
                f.write(log_entry)
        except Exception as e:
            print(f"[WATCHDOG] Failed to write local log: {e}")
        
        # Log to console
        print(f"[WATCHDOG] {log_entry.strip()}")
        
        # Send to dashboard API (non-blocking)
        try:
            if self.sync_manager.device_token:
                requests.post(
                    f"{self.sync_manager.api_base}/devices/watchdog",
                    json={
                        "event_type": event_type,
                        "details": details,
                        "timestamp": timestamp,
                        "restart_count": self.mpv_restart_count
                    },
                    headers={"Authorization": f"Bearer {self.sync_manager.device_token}"},
                    timeout=5
                )
        except Exception as e:
            # Don't fail if API is unreachable
            print(f"[WATCHDOG] Failed to send event to API: {e}")

    def restart_mpv(self, reason: str = "unknown"):
        """Kill and restart MPV process"""
        self.log_watchdog_event("mpv_restart", f"Restarting MPV: {reason}")
        self.mpv_restart_count += 1
        
        # Kill existing process
        if self.mpv_process:
            try:
                self.mpv_process.kill()
                self.mpv_process.wait(timeout=2)
            except Exception as e:
                print(f"[WATCHDOG] Error killing MPV: {e}")
        
        self.mpv_process = None
        time.sleep(1)
        
        # Restart with current playlist
        if os.path.exists(self.playlist_m3u):
            self.start_mpv()
        else:
            print("[WATCHDOG] No playlist available for restart")

    def pairing_loop(self):
        """Handle pairing (same as before)"""
        print("\n[PLAYER] Device unpaired. Starting pairing process...")
        
        # Reuse sync manager logic
        reg_data = self.sync_manager.register()
        if not reg_data:
            print("[PLAYER] Registration failed. Retrying in 10s...")
            time.sleep(10)
            return

        code = reg_data['pairing_code']
        token = reg_data['device_token']
        poll_interval = reg_data.get('poll_interval', 5000) / 1000.0
        
        print(f"PAIRING CODE: {code}")
        
        image_path = self.sync_manager.generate_pairing_image(code)
        viewer = None
        
        if image_path and os.path.exists(image_path):
            try:
                # Use MPV for image display (works on X11 and DRM/Lite)
                viewer = subprocess.Popen([
                    "mpv", 
                    image_path, 
                    "--fullscreen", 
                    "--loop-file=inf", 
                    "--no-osd-bar",
                    "--force-window=immediate"
                ])
            except:
                pass

        while self.running:
            status = self.sync_manager.poll_status(token)
            if status == "paired":
                print("\n[PLAYER] Device paired successfully!")
                self.sync_manager.save_config(token)
                break
            time.sleep(poll_interval)
            
        if viewer:
            viewer.terminate()
            try:
                viewer.wait(timeout=1)
            except:
                viewer.kill()

    def run(self):
        print("=" * 50)
        print("Digital Signage Player (Seamless Mode)")
        print("=" * 50)

        # 1. Pairing Check
        token = self.sync_manager.device_token
        if not token or token == "":
            self.pairing_loop()

        # 2. Initial Sync
        print("[PLAYER] Performing initial sync...")
        self.sync_manager.sync()
        
        # 3. Start Playback
        playlist = self.sync_manager.load_cached_playlist()
        if playlist and self.generate_m3u(playlist):
            self.start_mpv()
        else:
            print("[PLAYER] No playlist found. Waiting for sync...")

        # 4. Monitor Loop
        last_sync_time = time.time()
        last_health_check = time.time()
        sync_interval = 60  # Check every minute
        health_check_interval = 30  # Health check every 30 seconds

        while self.running:
            time.sleep(5) 
            
            # Watchdog: Health check every 30 seconds
            if time.time() - last_health_check > health_check_interval:
                if not self.check_mpv_health():
                    self.restart_mpv("health check failed")
                last_health_check = time.time()
            
            # Periodically sync
            if time.time() - last_sync_time > sync_interval:
                print("[PLAYER] Checking for updates...")
                
                # Check actual content change to avoid unnecessary restarts
                old_playlist_data = ""
                if os.path.exists(self.sync_manager.playlist_cache):
                    with open(self.sync_manager.playlist_cache, 'r') as f:
                        old_playlist_data = f.read()

                if self.sync_manager.sync():
                    # Sync returned success (network ok), now check if CONTENT changed
                    new_playlist_data = ""
                    if os.path.exists(self.sync_manager.playlist_cache):
                        with open(self.sync_manager.playlist_cache, 'r') as f:
                            new_playlist_data = f.read()
                    
                    if old_playlist_data != new_playlist_data:
                        print("[PLAYER] Content updated! Restarting playback...")
                        playlist = self.sync_manager.load_cached_playlist()
                        if playlist and self.generate_m3u(playlist):
                            self.start_mpv()
                    else:
                        print("[PLAYER] No changes detected.")
                
                last_sync_time = time.time()
                
            # Check if MPV crashed (redundant with health check, but kept for immediate detection)
            if self.mpv_process and self.mpv_process.poll() is not None:
                print("[PLAYER] MPV exited unexpectedly. Restarting...")
                self.restart_mpv("process exited")

if __name__ == "__main__":
    player = Player()
    try:
        player.run()
    except KeyboardInterrupt:
        print("\n[PLAYER] Stopped")
        if player.mpv_process:
            player.mpv_process.terminate()
