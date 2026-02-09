import logging
import json
import os
import requests
from typing import Dict, List, Optional, Any

class SyncManager:
    def __init__(self, config_path=None):
        if config_path:
             self.config_path = config_path
        else:
             # Default fallback
             home = os.path.expanduser("~")
             self.config_path = os.path.join(home, "signage-player", "config.json")

        self.config = self._load_config(self.config_path)
        self.server_url = self.config.get("server_url")
        self.device_token = self.config.get("device_token")
        
        self.media_dir = os.path.join(os.path.dirname(self.config_path), "media")
        self.playlist_cache = os.path.join(os.path.dirname(self.config_path), "playlist.json")
        
        if not os.path.exists(self.media_dir):
            os.makedirs(self.media_dir)
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from JSON file"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logging.error(f"Config file not found at {config_path}")
            print("Please create config.json with server_url and device_token")
            # We exit here, so print is fine as fallback
            exit(1)
        except json.JSONDecodeError as e:
            logging.error(f"Invalid JSON in config file: {e}")
            exit(1)
    
    def register(self) -> Optional[Dict]:
        """Register device and get pairing code"""
        try:
            url = f"{self.server_url}/api/device/register"
            logging.info(f"[SYNC] Registering device at {url}...")
            response = requests.post(url, json={}, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logging.info(f"[SYNC] Registration successful. Code: {data['pairing_code']}")
                return data
            else:
                logging.error(f"[SYNC] Registration error: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logging.error(f"[SYNC] Registration connection error: {e}")
            return None

    def poll_status(self, token: str) -> Optional[str]:
        """Check if device has been paired"""
        try:
            url = f"{self.server_url}/api/device/status?token={token}"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("status") # "paired" or "unpaired"
            else:
                return None
        except Exception:
            return None

    def save_config(self, new_token: str):
        """Update config with new token"""
        self.config["device_token"] = new_token
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
            self.device_token = new_token
            logging.info(f"[SYNC] Device token saved to {self.config_path}")
        except Exception as e:
            logging.error(f"[SYNC] Failed to save config: {e}")

    def generate_pairing_image(self, code: str) -> str:
        """Generate an image with the pairing code using PIL"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # Create black background
            width = 1920
            height = 1080
            img = Image.new('RGB', (width, height), color='black')
            draw = ImageDraw.Draw(img)
            
            # Load font (try standard paths, fallback to default)
            try:
                # Big font for code
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 200)
                # Small font for instructions
                font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 60)
            except IOError:
                font = ImageFont.load_default()
                font_small = ImageFont.load_default()
            
            # Draw Text
            text = f"{code}"
            instructions = "enter this code in dashboard"
            
            # Center text (approximate if using default font, better if truetype)
            # Recent PIllow versions use getbbox usually
            
            draw.text((width/2, height/2), text, font=font, anchor="mm", fill="white")
            draw.text((width/2, height/2 + 200), instructions, font=font_small, anchor="mm", fill="gray")
            
            # Save
            filepath = os.path.join(self.media_dir, "pairing.png")
            img.save(filepath)
            return filepath
            
        except ImportError:
            logging.warning("[SYNC] PIL not installed. Cannot generate pairing image.")
            return None
        except Exception as e:
            logging.error(f"[SYNC] Error generating pairing image: {e}")
            return None

    def fetch_sync_data(self, playing_playlist_id: Optional[str] = None) -> Optional[Dict]:
        """Fetch sync data (schedule, default, etc) from server"""
        if not self.device_token:
            logging.warning("[SYNC] No device token. Cannot fetch playlist.")
            return None
            
        try:
            url = f"{self.server_url}/api/device/sync"
            payload = {"device_token": self.device_token}
            
            if playing_playlist_id:
                payload["playing_playlist_id"] = playing_playlist_id
            
            logging.info(f"[SYNC] Fetching sync data. Sending ID: {playing_playlist_id}")
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    logging.info(f"[SYNC] Response: {str(data)[:200]}") # Log first 200 chars to check version
                    logging.debug(f"[SYNC] Device: {data.get('device_name')}")
                    return data
                except json.JSONDecodeError as e:
                    logging.error(f"[SYNC] Failed to decode JSON response: {e}")
                    logging.debug(f"[SYNC] Raw response text: {response.text}")
                    return None
            elif response.status_code == 401:
                logging.error("[SYNC] Unauthorized: Invalid token. Device might have been deleted.")
                return None
            else:
                logging.error(f"[SYNC] Error: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            logging.error(f"[SYNC] Connection error: {e}")
            return None
    
    def download_media(self, item: Dict) -> bool:
        """Download a media file if not already present"""
        filename = item['filename']
        url = item['url']
        filepath = os.path.join(self.media_dir, filename)
        
        # Skip downloading for web content
        if item.get('type') == 'web':
            return True

        # Check if file already exists
        if os.path.exists(filepath):
            return True
        
        try:
            logging.info(f"[DOWNLOAD] Downloading {filename}...")
            response = requests.get(url, stream=True, timeout=30)
            
            if response.status_code == 200:
                with open(filepath, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                logging.info(f"[DOWNLOAD] ✓ {filename} downloaded")
                return True
            else:
                logging.error(f"[DOWNLOAD] ✗ Failed to download {filename}: {response.status_code}")
                return False
                
        except Exception as e:
            logging.error(f"[DOWNLOAD] ✗ Error downloading {filename}: {e}")
            return False
    
    def sync(self, playing_playlist_id: Optional[str] = None) -> bool:
        """Sync schedule and download new media"""
        data = self.fetch_sync_data(playing_playlist_id)
        
        if not data:
            return False
        
        # Collect all items to download
        all_items = []
        
        # 1. Default Playlist
        if data.get('default_playlist'):
             all_items.extend(data['default_playlist']['items'])
             
        # 2. Schedule Items
        if data.get('schedule'):
            for item in data['schedule']['items']:
                if item.get('playlist'):
                    all_items.extend(item['playlist']['items'])
        
        # 3. Legacy Playlist (Fallback)
        if data.get('playlist'):
            all_items.extend(data['playlist']['items'])

        # Download all unique media files
        success = True
        downloaded_filenames = set()
        
        for item in all_items:
            # Avoid duplicates
            if item['filename'] in downloaded_filenames:
                continue
                
            if not self.download_media(item):
                success = False
            
            downloaded_filenames.add(item['filename'])
        
        # Save full data to cache
        try:
            with open(self.playlist_cache, 'w') as f:
                json.dump(data, f, indent=2)
            logging.debug(f"[SYNC] Data cached to {self.playlist_cache}")
        except Exception as e:
            logging.error(f"[SYNC] Error saving cache: {e}")
            success = False
        
        # Cleanup Strategy: Keep up to 10GB of unused files (LRU)
        MAX_UNUSED_BYTES = 10 * 1024 * 1024 * 1024  # 10 GB
        
        try:
            unused_files = []
            current_unused_size = 0
            
            # 1. Identify unused files and calculate their total size
            for filename in os.listdir(self.media_dir):
                filepath = os.path.join(self.media_dir, filename)
                
                # Skip directories and special files
                if os.path.isdir(filepath) or filename == "pairing.png":
                    continue
                    
                # If file is NOT in the current playlist, it's a candidate for cleanup
                if filename not in downloaded_filenames:
                    try:
                        stat = os.stat(filepath)
                        size = stat.st_size
                        mtime = stat.st_mtime
                        unused_files.append({
                            'path': filepath,
                            'name': filename,
                            'size': size,
                            'mtime': mtime
                        })
                        current_unused_size += size
                    except OSError:
                        pass # File might have vanished

            # 2. If unused size exceeds limit, delete oldest files first
            if current_unused_size > MAX_UNUSED_BYTES:
                logging.info(f"[CLEANUP] Unused media size ({current_unused_size / 1024 / 1024:.2f} MB) exceeds limit ({MAX_UNUSED_BYTES / 1024 / 1024:.2f} MB). Cleaning up...")
                
                # Sort by modification time (oldest first)
                unused_files.sort(key=lambda x: x['mtime'])
                
                for file_info in unused_files:
                    if current_unused_size <= MAX_UNUSED_BYTES:
                        break
                        
                    try:
                        os.remove(file_info['path'])
                        current_unused_size -= file_info['size']
                        logging.info(f"[CLEANUP] Deleted old file: {file_info['name']} ({file_info['size'] / 1024 / 1024:.2f} MB)")
                    except OSError as e:
                        logging.error(f"[CLEANUP] Error deleting {file_info['name']}: {e}")
            else:
                 logging.info(f"[CLEANUP] Unused media size ({current_unused_size / 1024 / 1024:.2f} MB) is within limit.")

        except Exception as e:
            logging.error(f"[CLEANUP] Error during cache cleanup: {e}")
        
        return success
    
    def load_cached_playlist(self) -> Optional[Dict]:
        """Load playlist from local cache"""
        try:
            with open(self.playlist_cache, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logging.warning("[SYNC] No cached playlist found")
            return None
        except json.JSONDecodeError as e:
            logging.error(f"[SYNC] Error reading cached playlist: {e}")
            return None


if __name__ == "__main__":
    # Test sync
    logging.basicConfig(level=logging.INFO)
    sync = SyncManager()
    
    print("=" * 50)
    print("Digital Signage Player - Sync Test")
    print("=" * 50)
    
    sync.sync()

