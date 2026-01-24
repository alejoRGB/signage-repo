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
                "--image-display-duration=10",
                "--loop-playlist=inf",
                "--prefetch-playlist=yes",
                "--force-window=immediate",
                "--cache=yes",
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
                viewer = subprocess.Popen(["feh", "--fullscreen", image_path])
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
            subprocess.run(["pkill", "feh"], check=False)

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
        sync_interval = 60 # Check every minute

        while self.running:
            time.sleep(5) 
            
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
                
            # Check if MPV crashed
            if self.mpv_process and self.mpv_process.poll() is not None:
                print("[PLAYER] MPV exited unexpectedly. Restarting...")
                self.start_mpv()

if __name__ == "__main__":
    player = Player()
    try:
        player.run()
    except KeyboardInterrupt:
        print("\n[PLAYER] Stopped")
        if player.mpv_process:
            player.mpv_process.terminate()
