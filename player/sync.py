import logging
import json
import os
import re
import subprocess
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

            if playing_playlist_id is not None:
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

    def report_playback_state(
        self,
        playing_playlist_id: Optional[str] = None,
        current_content_name: Optional[str] = None,
        preview_path: Optional[str] = None,
        sync_runtime: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Report current playback metadata and optional preview JPEG."""
        if not self.device_token:
            return False

        try:
            url = f"{self.server_url}/api/device/heartbeat"
            data: Dict[str, str] = {
                "device_token": self.device_token,
                "playing_playlist_id": playing_playlist_id or "",
                "current_content_name": current_content_name or "",
            }
            if sync_runtime:
                data["sync_session_id"] = str(sync_runtime.get("session_id", ""))
                data["sync_status"] = str(sync_runtime.get("status", ""))
                if sync_runtime.get("drift_ms") is not None:
                    data["sync_drift_ms"] = str(sync_runtime.get("drift_ms"))
                if sync_runtime.get("resync_count") is not None:
                    data["sync_resync_count"] = str(sync_runtime.get("resync_count"))
                if sync_runtime.get("clock_offset_ms") is not None:
                    data["sync_clock_offset_ms"] = str(sync_runtime.get("clock_offset_ms"))
                if sync_runtime.get("cpu_temp") is not None:
                    data["sync_cpu_temp"] = str(sync_runtime.get("cpu_temp"))
                if sync_runtime.get("throttled") is not None:
                    data["sync_throttled"] = "true" if bool(sync_runtime.get("throttled")) else "false"
                if sync_runtime.get("health_score") is not None:
                    data["sync_health_score"] = str(sync_runtime.get("health_score"))
                if sync_runtime.get("avg_drift_ms") is not None:
                    data["sync_avg_drift_ms"] = str(sync_runtime.get("avg_drift_ms"))
                if sync_runtime.get("max_drift_ms") is not None:
                    data["sync_max_drift_ms"] = str(sync_runtime.get("max_drift_ms"))
                if sync_runtime.get("resync_rate") is not None:
                    data["sync_resync_rate"] = str(sync_runtime.get("resync_rate"))

            files = None
            if preview_path and os.path.exists(preview_path):
                files = {
                    "preview": ("latest.jpg", open(preview_path, "rb"), "image/jpeg")
                }

            try:
                response = requests.post(url, data=data, files=files, timeout=10)
            finally:
                if files and files["preview"][1]:
                    files["preview"][1].close()

            if response.status_code == 200:
                return True

            logging.warning(
                f"[SYNC] Preview report failed: {response.status_code} - {response.text[:120]}"
            )
            return False
        except requests.exceptions.RequestException as e:
            logging.warning(f"[SYNC] Preview report connection error: {e}")
            return False

    def poll_device_commands(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Poll queued device commands from backend."""
        if not self.device_token:
            return []

        try:
            url = f"{self.server_url}/api/device/commands"
            params = {
                "device_token": self.device_token,
                "limit": str(limit),
            }
            response = requests.get(url, params=params, timeout=10)
            if response.status_code != 200:
                logging.debug(
                    "[SYNC] Command poll failed: %s %s",
                    response.status_code,
                    response.text[:120],
                )
                return []

            payload = response.json()
            commands = payload.get("commands")
            if not isinstance(commands, list):
                return []

            return commands
        except requests.exceptions.RequestException as error:
            logging.debug("[SYNC] Command poll connection error: %s", error)
            return []
        except ValueError as error:
            logging.warning("[SYNC] Invalid JSON from command poll: %s", error)
            return []

    def ack_device_command(
        self,
        command_id: str,
        status: str = "ACKED",
        error: Optional[str] = None,
        sync_runtime: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Acknowledge command execution result to backend."""
        if not self.device_token:
            return False

        try:
            url = f"{self.server_url}/api/device/ack"
            payload: Dict[str, Any] = {
                "device_token": self.device_token,
                "command_id": command_id,
                "status": status,
            }
            if error:
                payload["error"] = error[:1000]
            if sync_runtime:
                runtime_payload = {
                    "session_id": sync_runtime.get("session_id"),
                    "status": sync_runtime.get("status"),
                    "drift_ms": sync_runtime.get("drift_ms"),
                    "resync_count": sync_runtime.get("resync_count"),
                    "clock_offset_ms": sync_runtime.get("clock_offset_ms"),
                    "cpu_temp": sync_runtime.get("cpu_temp"),
                    "throttled": sync_runtime.get("throttled"),
                    "health_score": sync_runtime.get("health_score"),
                    "avg_drift_ms": sync_runtime.get("avg_drift_ms"),
                    "max_drift_ms": sync_runtime.get("max_drift_ms"),
                    "resync_rate": sync_runtime.get("resync_rate"),
                }
                payload["sync_runtime"] = {
                    key: value for key, value in runtime_payload.items() if value is not None
                }

            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                return True

            logging.warning(
                "[SYNC] Command ack failed: %s %s",
                response.status_code,
                response.text[:160],
            )
            return False
        except requests.exceptions.RequestException as error:
            logging.warning("[SYNC] Command ack connection error: %s", error)
            return False

    @staticmethod
    def _parse_seconds_to_ms(raw_value: str) -> Optional[float]:
        match = re.search(r"([-+]?\d+(?:\.\d+)?)", raw_value)
        if not match:
            return None

        try:
            seconds_value = float(match.group(1))
        except ValueError:
            return None

        return seconds_value * 1000.0

    def get_clock_sync_health(self, max_offset_ms: float = 50.0) -> Dict[str, Any]:
        """
        Check local clock sync quality via chronyc tracking.
        Returns a dict with healthy/critical booleans and current offset in ms.
        """
        try:
            result = subprocess.run(
                ["chronyc", "tracking"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )

            if result.returncode != 0:
                return {
                    "healthy": False,
                    "critical": True,
                    "offset_ms": None,
                    "raw": result.stdout + result.stderr,
                    "throttled": False,
                    "health_score": 0.0,
                }

            tracking_output = result.stdout
            leap_status = None
            offset_ms = None

            for line in tracking_output.splitlines():
                if ":" not in line:
                    continue
                key, value = [part.strip() for part in line.split(":", 1)]
                normalized_key = re.sub(r"\s+", " ", key).strip().lower()
                if normalized_key == "leap status":
                    leap_status = value
                elif normalized_key in {"last offset", "rms offset", "system time"}:
                    parsed = self._parse_seconds_to_ms(value)
                    if parsed is not None:
                        offset_ms = parsed
                        if normalized_key == "last offset":
                            break

            # Fallback parser for environments where key spacing/characters vary.
            if leap_status is None:
                leap_match = re.search(r"leap\s+status\s*:\s*(.+)", tracking_output, flags=re.IGNORECASE)
                if leap_match:
                    leap_status = leap_match.group(1).strip()

            throttled = False
            try:
                throttled_result = subprocess.run(
                    ["vcgencmd", "get_throttled"],
                    capture_output=True,
                    text=True,
                    timeout=2,
                    check=False,
                )
                if throttled_result.returncode == 0 and "=" in throttled_result.stdout:
                    raw_hex = throttled_result.stdout.split("=", 1)[1].strip()
                    throttled_value = int(raw_hex, 16)
                    throttled = bool(throttled_value & 0x4)
            except Exception:
                throttled = False

            healthy_leap = (leap_status or "").strip().lower() == "normal"
            healthy_offset = offset_ms is not None and abs(offset_ms) <= max_offset_ms
            healthy = healthy_leap and healthy_offset and not throttled

            health_score = 0.2
            if healthy_leap:
                health_score += 0.4
            if offset_ms is not None:
                if abs(offset_ms) <= max_offset_ms:
                    health_score += 0.4
                elif abs(offset_ms) <= max_offset_ms * 2:
                    health_score += 0.2
            if throttled:
                health_score -= 0.3

            return {
                "healthy": healthy,
                "critical": not healthy,
                "offset_ms": offset_ms,
                "leap_status": leap_status,
                "raw": tracking_output,
                "throttled": throttled,
                "health_score": round(min(max(health_score, 0.0), 1.0), 3),
            }
        except Exception as error:
            logging.warning("[SYNC] Failed to run chronyc tracking: %s", error)
            return {
                "healthy": False,
                "critical": True,
                "offset_ms": None,
                "error": str(error),
                "throttled": False,
                "health_score": 0.0,
            }
    
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

