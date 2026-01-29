
import logging
import threading
import time
import requests
import queue
from datetime import datetime
from typing import List, Dict, Optional

class LoggerService(logging.Handler):
    def __init__(self, sync_manager):
        super().__init__()
        self.sync_manager = sync_manager
        self.log_queue = queue.Queue()
        self.buffer_size = 50
        self.flush_interval = 10  # seconds (Reduced for better responsiveness)
        self.last_flush = time.time()
        self.running = True
        
        # Start background flusher thread
        self.flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self.flush_thread.start()

    def emit(self, record):
        try:
            log_entry = {
                "level": record.levelname.lower(),
                "message": self.format(record),
                "timestamp": datetime.fromtimestamp(record.created).isoformat()
            }
            self.log_queue.put(log_entry)
            
            # REMOVED: Do not flush synchronously from the main thread
            # if self.log_queue.qsize() >= self.buffer_size:
            #     self.flush_logs()
                
        except Exception:
            self.handleError(record)

    def _flush_loop(self):
        while self.running:
            # Check more frequently (every 1s)
            time.sleep(1)
            
            # Flush if interval passed OR buffer is full
            time_since_flush = time.time() - self.last_flush
            buffer_full = self.log_queue.qsize() >= self.buffer_size
            
            if time_since_flush > self.flush_interval or buffer_full:
                self.flush_logs()

    def flush_logs(self):
        if self.log_queue.empty():
            return

        # Get device token
        if not self.sync_manager.device_token:
            return

        logs_to_send = []
        try:
            while not self.log_queue.empty() and len(logs_to_send) < self.buffer_size:
                logs_to_send.append(self.log_queue.get_nowait())
        except queue.Empty:
            pass

        if not logs_to_send:
            return

        try:
            url = f"{self.sync_manager.server_url}/api/device/logs"
            payload = {
                "device_token": self.sync_manager.device_token,
                "logs": logs_to_send
            }
            
            response = requests.post(url, json=payload, timeout=5)
            if response.status_code != 200:
                print(f"[LOGGER] Failed to upload logs: {response.status_code}")
                # Put back into queue if failed? For now, just drop to avoid memory leak loops
            else:
                self.last_flush = time.time()
                
        except Exception as e:
            print(f"[LOGGER] Error uploading logs: {e}")

    def stop(self):
        self.running = False
        self.flush_logs()
