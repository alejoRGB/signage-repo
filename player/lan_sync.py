from __future__ import annotations

import json
import logging
import socket
import threading
import time
from typing import Callable, Optional


class LanSyncService:
    def __init__(
        self,
        *,
        enabled: bool,
        beacon_hz: float,
        beacon_port: int,
        timeout_ms: int,
        broadcast_addr: str = "255.255.255.255",
        bind_host: str = "0.0.0.0",
    ):
        self.enabled = bool(enabled)
        self.beacon_hz = max(1.0, float(beacon_hz))
        self.beacon_port = int(beacon_port)
        self.timeout_ms = max(250, int(timeout_ms))
        self.broadcast_addr = broadcast_addr
        self.bind_host = bind_host

        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._socket: Optional[socket.socket] = None
        self._role: str = "idle"

        self._session_id: Optional[str] = None
        self._master_device_id: Optional[str] = None
        self._duration_ms: int = 0
        self._seq = 0
        self._get_phase_ms: Optional[Callable[[], Optional[float]]] = None
        self._get_speed: Optional[Callable[[], float]] = None
        self._last_beacon: Optional[dict] = None
        self._last_receive_at_ms: Optional[int] = None

    def update_settings(
        self,
        *,
        enabled: Optional[bool] = None,
        beacon_hz: Optional[float] = None,
        beacon_port: Optional[int] = None,
        timeout_ms: Optional[int] = None,
        broadcast_addr: Optional[str] = None,
        bind_host: Optional[str] = None,
    ) -> None:
        with self._lock:
            if enabled is not None:
                self.enabled = bool(enabled)
            if beacon_hz is not None:
                self.beacon_hz = max(1.0, float(beacon_hz))
            if beacon_port is not None:
                self.beacon_port = int(beacon_port)
            if timeout_ms is not None:
                self.timeout_ms = max(250, int(timeout_ms))
            if broadcast_addr is not None:
                self.broadcast_addr = str(broadcast_addr)
            if bind_host is not None:
                self.bind_host = str(bind_host)

    def stop(self) -> None:
        self._stop_event.set()
        sock = self._socket
        if sock is not None:
            try:
                sock.close()
            except OSError:
                pass
        thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=1.0)

        with self._lock:
            self._socket = None
            self._thread = None
            self._role = "idle"
            self._session_id = None
            self._master_device_id = None
            self._duration_ms = 0
            self._get_phase_ms = None
            self._get_speed = None
            self._last_beacon = None
            self._last_receive_at_ms = None

    def start_master(
        self,
        *,
        session_id: str,
        master_device_id: str,
        duration_ms: int,
        get_phase_ms: Callable[[], Optional[float]],
        get_speed: Callable[[], float],
    ) -> bool:
        self.stop()
        if not self.enabled:
            return False

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        except OSError as error:
            logging.warning("[LAN_SYNC] Failed to initialize master socket: %s", error)
            return False

        with self._lock:
            self._socket = sock
            self._role = "master"
            self._session_id = session_id
            self._master_device_id = master_device_id
            self._duration_ms = max(1, int(duration_ms))
            self._get_phase_ms = get_phase_ms
            self._get_speed = get_speed
            self._seq = 0
            self._last_beacon = None
            self._last_receive_at_ms = None
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._master_loop, daemon=True)
            self._thread.start()

        return True

    def start_follower(
        self,
        *,
        session_id: str,
        master_device_id: str,
        duration_ms: int,
    ) -> bool:
        self.stop()
        if not self.enabled:
            return False

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((self.bind_host, self.beacon_port))
            sock.settimeout(0.5)
        except OSError as error:
            logging.warning("[LAN_SYNC] Failed to initialize follower socket: %s", error)
            return False

        with self._lock:
            self._socket = sock
            self._role = "follower"
            self._session_id = session_id
            self._master_device_id = master_device_id
            self._duration_ms = max(1, int(duration_ms))
            self._get_phase_ms = None
            self._get_speed = None
            self._seq = 0
            self._last_beacon = None
            self._last_receive_at_ms = None
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._follower_loop, daemon=True)
            self._thread.start()

        return True

    def role(self) -> str:
        with self._lock:
            return self._role

    def get_follower_target_phase_ms(self, now_ms: int) -> Optional[float]:
        with self._lock:
            if self._role != "follower":
                return None
            beacon = self._last_beacon
            if not beacon or self._last_receive_at_ms is None:
                return None
            if now_ms - self._last_receive_at_ms > self.timeout_ms:
                return None

            duration_ms = int(beacon.get("duration_ms") or self._duration_ms or 0)
            if duration_ms <= 0:
                return None

            sent_at_ms = int(beacon.get("sent_at_ms") or now_ms)
            phase_ms = float(beacon.get("phase_ms") or 0.0)
            speed = float(beacon.get("playback_speed") or 1.0)
            elapsed_ms = max(0, now_ms - sent_at_ms)
            return float((phase_ms + (elapsed_ms * speed)) % duration_ms)

    def get_follower_beacon_age_ms(self, now_ms: int) -> Optional[int]:
        with self._lock:
            if self._role != "follower" or self._last_receive_at_ms is None:
                return None
            return max(0, int(now_ms - self._last_receive_at_ms))

    def _master_loop(self) -> None:
        interval_s = 1.0 / max(1.0, self.beacon_hz)
        next_tick = time.monotonic()

        while not self._stop_event.is_set():
            with self._lock:
                sock = self._socket
                session_id = self._session_id
                master_device_id = self._master_device_id
                duration_ms = self._duration_ms
                get_phase_ms = self._get_phase_ms
                get_speed = self._get_speed
                seq = self._seq
                self._seq += 1

            if (
                sock is not None
                and session_id
                and master_device_id
                and duration_ms > 0
                and get_phase_ms is not None
                and get_speed is not None
            ):
                try:
                    phase = get_phase_ms()
                    if phase is not None:
                        payload = {
                            "v": 1,
                            "session_id": session_id,
                            "master_device_id": master_device_id,
                            "seq": seq,
                            "sent_at_ms": int(time.time() * 1000),
                            "phase_ms": float(phase) % duration_ms,
                            "duration_ms": duration_ms,
                            "playback_speed": float(get_speed()),
                        }
                        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
                        sock.sendto(raw, (self.broadcast_addr, self.beacon_port))
                except OSError:
                    pass
                except Exception as error:
                    logging.debug("[LAN_SYNC] Master beacon send error: %s", error)

            next_tick += interval_s
            sleep_for = max(0.0, next_tick - time.monotonic())
            self._stop_event.wait(sleep_for)

    def _follower_loop(self) -> None:
        while not self._stop_event.is_set():
            with self._lock:
                sock = self._socket
                session_id = self._session_id
                master_device_id = self._master_device_id

            if sock is None or not session_id or not master_device_id:
                self._stop_event.wait(0.2)
                continue

            try:
                packet, _addr = sock.recvfrom(4096)
            except socket.timeout:
                continue
            except OSError:
                if self._stop_event.is_set():
                    break
                continue
            except Exception as error:
                logging.debug("[LAN_SYNC] Follower recv error: %s", error)
                continue

            try:
                beacon = json.loads(packet.decode("utf-8"))
            except Exception:
                continue

            if not isinstance(beacon, dict):
                continue
            if str(beacon.get("session_id") or "") != session_id:
                continue
            if str(beacon.get("master_device_id") or "") != master_device_id:
                continue

            received_at_ms = int(time.time() * 1000)
            with self._lock:
                self._last_beacon = beacon
                self._last_receive_at_ms = received_at_ms

