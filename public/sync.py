#!/usr/bin/env python3
"""
Digital Signage Player - Sync Module
Handles authentication and playlist synchronization with the server
"""

import json
import os
import requests
import hashlib
from typing import Optional, Dict, List

class SyncManager:
    def __init__(self, config_path: str = "/home/pi/signage-player/config.json"):
        self.config = self._load_config(config_path)
        self.server_url = self.config["server_url"]
        self.device_token = self.config["device_token"]
        self.media_dir = self.config.get("media_dir", "/home/pi/signage-player/media")
        self.playlist_cache = os.path.join(os.path.dirname(config_path), "playlist.json")
        
        # Ensure media directory exists
        os.makedirs(self.media_dir, exist_ok=True)
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from JSON file"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"ERROR: Config file not found at {config_path}")
            print("Please create config.json with server_url and device_token")
            exit(1)
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid JSON in config file: {e}")
            exit(1)
    
    def register(self) -> Optional[Dict]:
        """Register device and get pairing code"""
        try:
            url = f"{self.server_url}/api/device/register"
            print(f"[SYNC] Registering device at {url}...")
            response = requests.post(url, json={}, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"[SYNC] Registration successful. Code: {data['pairing_code']}")
                return data
            else:
                print(f"[SYNC] Registration error: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"[SYNC] Registration connection error: {e}")
            return None

    def poll_status(self, token: str) -> Optional[str]:
        """Check if device is paired"""
        try:
            url = f"{self.server_url}/api/device/status?token={token}"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("status")
            return None
        except Exception:
            return None

    def save_config(self, new_token: str):
        """Update config with new token"""
        self.config["device_token"] = new_token
        with open("/home/pi/signage-player/config.json", 'w') as f:
            json.dump(self.config, f, indent=2)
        self.device_token = new_token
        print("[SYNC] Device token saved to config.json")

    def generate_pairing_image(self, code: str) -> str:
        """Generate an image with the pairing code using PIL"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # Create black image 1920x1080
            width, height = 1920, 1080
            img = Image.new('RGB', (width, height), color='black')
            d = ImageDraw.Draw(img)
            
            # Try to load a font, fallback to default
            try:
                # Common locations for fonts on Linux
                font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
                if not os.path.exists(font_path):
                    font_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
                font = ImageFont.truetype(font_path, 100)
                small_font = ImageFont.truetype(font_path, 40)
            except:
                font = ImageFont.load_default()
                small_font = ImageFont.load_default()
            
            # Draw Text
            text = f"Pairing Code: {code}"
            
            # Calculate text size (rough approximation if getbbox fails)
            try:
                text_bbox = d.textbbox((0, 0), text, font=font)
                text_w = text_bbox[2] - text_bbox[0]
                text_h = text_bbox[3] - text_bbox[1]
            except:
                text_w, text_h = 400, 100
                
            x = (width - text_w) / 2
            y = (height - text_h) / 2
            
            d.text((x, y), text, fill=(255, 255, 255), font=font)
            
            # Subtitle
            sub = f"Go to Dashboard > Devices > Pair Device"
            try:
                sub_bbox = d.textbbox((0, 0), sub, font=small_font)
                sub_w = sub_bbox[2] - sub_bbox[0]
            except:
                sub_w = 300
            
            d.text(((width - sub_w) / 2, y + 150), sub, fill=(200, 200, 200), font=small_font)
            
            # Save
            filepath = os.path.join(self.media_dir, "pairing.png")
            img.save(filepath)
            return filepath
            
        except ImportError:
            print("[SYNC] PIL not installed. Cannot generate pairing image.")
            return None
        except Exception as e:
            print(f"[SYNC] Error generating pairing image: {e}")
            return None

    def fetch_playlist(self) -> Optional[Dict]:
        """Fetch playlist from server"""
        if not self.device_token:
            print("[SYNC] No device token. Cannot fetch playlist.")
            return None
            
        try:
            url = f"{self.server_url}/api/device/sync"
            payload = {"device_token": self.device_token}
            
            print(f"[SYNC] Fetching playlist from {url}")
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"[SYNC] Device: {data.get('device_name')}")
                
                if data.get('playlist'):
                    print(f"[SYNC] Playlist: {data['playlist']['name']} ({len(data['playlist']['items'])} items)")
                    return data['playlist']
                else:
                    print("[SYNC] No playlist assigned")
                    return None
            elif response.status_code == 401:
                print("[SYNC] Unauthorized: Invalid token. Device might have been deleted.")
                # Optional: Clear token?
                return None
            else:
                print(f"[SYNC] Error: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"[SYNC] Connection error: {e}")
            return None
    
    def download_media(self, item: Dict) -> bool:
        """Download a media file if not already present"""
        filename = item['filename']
        url = item['url']
        filepath = os.path.join(self.media_dir, filename)
        
        # Check if file already exists
        if os.path.exists(filepath):
            # print(f"[DOWNLOAD] Skipping {filename} (already exists)")
            return True
        
        try:
            print(f"[DOWNLOAD] Downloading {filename}...")
            response = requests.get(url, stream=True, timeout=30)
            
            if response.status_code == 200:
                with open(filepath, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"[DOWNLOAD] ✓ {filename} downloaded")
                return True
            else:
                print(f"[DOWNLOAD] ✗ Failed to download {filename}: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"[DOWNLOAD] ✗ Error downloading {filename}: {e}")
            return False
    
    def sync(self) -> bool:
        """Sync playlist and download new media"""
        playlist = self.fetch_playlist()
        
        if not playlist:
            # print("[SYNC] No playlist to sync")
            return False
        
        # Download all media files
        success = True
        for item in playlist['items']:
            if not self.download_media(item):
                success = False
        
        # Save playlist to cache
        try:
            with open(self.playlist_cache, 'w') as f:
                json.dump(playlist, f, indent=2)
            print(f"[SYNC] Playlist cached to {self.playlist_cache}")
        except Exception as e:
            print(f"[SYNC] Error saving playlist cache: {e}")
            success = False
        
        # TODO: Clean up old media files not in current playlist
        
        return success
    
    def load_cached_playlist(self) -> Optional[Dict]:
        """Load playlist from local cache"""
        try:
            with open(self.playlist_cache, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print("[SYNC] No cached playlist found")
            return None
        except json.JSONDecodeError as e:
            print(f"[SYNC] Error reading cached playlist: {e}")
            return None


if __name__ == "__main__":
    # Test sync
    sync = SyncManager()
    
    print("=" * 50)
    print("Digital Signage Player - Sync Test")
    print("=" * 50)
    
    sync.sync()
