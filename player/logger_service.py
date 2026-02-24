
import logging
import threading
import time
import requests
import queue
import re
from datetime import datetime
from typing import Dict, Optional

SYNC_LOG_EVENTS = {
    "READY",
    "STARTED",
    "SOFT_CORRECTION",
    "HARD_RESYNC",
    "REJOIN",
    "MPV_CRASH",
    "THERMAL_THROTTLE",
}


def log_sync_event(
    event: str,
    *,
    session_id: Optional[str] = None,
    data: Optional[Dict[str, object]] = None,
    level: int = logging.INFO,
):
    normalized_event = (event or "").strip().upper()
    if normalized_event not in SYNC_LOG_EVENTS:
        logging.getLogger(__name__).warning("Ignoring unknown sync log event: %s", event)
        return

    message = f"[SYNC_EVENT] {normalized_event}"
    logging.getLogger().log(
        level,
        message,
        extra={
            "sync_event": normalized_event,
            "sync_session_id": session_id,
            "sync_data": data or {},
        },
    )

class LoggerService(logging.Handler):
    def __init__(self, sync_manager):
        super().__init__()
        self.sync_manager = sync_manager
        self.max_queue_size = 500
        self.log_queue = queue.Queue(maxsize=self.max_queue_size)
        self.buffer_size = 50
        self.flush_interval = 10  # seconds (Reduced for better responsiveness)
        self.last_flush = time.time()
        self.running = True
        self._dropped_logs = 0
        
        # Start background flusher thread
        self.flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self.flush_thread.start()

    @staticmethod
    def _sanitize_message(message: str) -> str:
        # Prevent control-character log injection and avoid leaking pairing/device tokens remotely.
        sanitized = re.sub(r"[\r\n\t\x00-\x1f\x7f]+", " ", message)
        sanitized = re.sub(r"(PAIRING CODE:\s*)([A-Za-z0-9_-]+)", r"\1REDACTED", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"(device_token['\"=: ]+)([A-Za-z0-9_-]{6,})", r"\1REDACTED", sanitized, flags=re.IGNORECASE)
        return sanitized.strip()[:4000]

    def _enqueue_log(self, log_entry):
        try:
            self.log_queue.put_nowait(log_entry)
            return
        except queue.Full:
            self._dropped_logs += 1
            try:
                self.log_queue.get_nowait()
            except queue.Empty:
                pass
            try:
                self.log_queue.put_nowait(log_entry)
            except queue.Full:
                self._dropped_logs += 1

    def emit(self, record):
        try:
            if not self.sync_manager.device_token:
                # Avoid unbounded pre-pairing backlog and uploading historical sensitive logs later.
                return

            sync_event = getattr(record, "sync_event", None)
            sync_session_id = getattr(record, "sync_session_id", None)
            sync_data = getattr(record, "sync_data", None)

            log_entry = {
                "level": record.levelname.lower(),
                "message": self._sanitize_message(self.format(record)),
                "timestamp": datetime.fromtimestamp(record.created).isoformat()
            }

            if isinstance(sync_event, str) and sync_event.strip().upper() in SYNC_LOG_EVENTS:
                log_entry["event"] = sync_event.strip().upper()

            if isinstance(sync_session_id, str) and sync_session_id.strip():
                log_entry["session_id"] = sync_session_id.strip()

            if isinstance(sync_data, dict) and sync_data:
                log_entry["data"] = sync_data

            self._enqueue_log(log_entry)
            
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
                for entry in reversed(logs_to_send):
                    self._enqueue_log(entry)
            else:
                self.last_flush = time.time()
                
        except Exception as e:
            print(f"[LOGGER] Error uploading logs: {e}")
            for entry in reversed(logs_to_send):
                self._enqueue_log(entry)

    def stop(self):
        self.running = False
        self.flush_logs()
