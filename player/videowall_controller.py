from __future__ import annotations

from collections import deque
import logging
import os
import time
from typing import Callable, Dict, Optional

from lan_sync import LanSyncService
from logger_service import log_sync_event
from state_machine import (
    SYNC_STATE_ERRORED,
    SYNC_STATE_PLAYING,
    SYNC_STATE_PRELOADING,
    SYNC_STATE_READY,
    SYNC_STATE_WARMING_UP,
    SyncSessionContext,
    SyncStateMachine,
)
from videowall_drift import (
    compute_target_phase_ms,
    compute_wrapped_drift_ms,
    decide_correction,
    round_to_frame,
)


class VideowallController:
    DRIFT_AVG_WINDOW_MS = 20_000

    def __init__(
        self,
        sync_manager,
        state_machine: SyncStateMachine,
        start_sync_playback: Callable[[SyncSessionContext], bool],
        stop_playback: Callable[[], None],
        seek_to_phase_ms: Callable[[int], bool],
        set_pause: Callable[[bool], bool],
        is_playback_alive: Callable[[], bool],
        set_playback_speed: Optional[Callable[[float], bool]] = None,
        get_playback_time_ms: Optional[Callable[[], Optional[float]]] = None,
        get_playback_duration_ms: Optional[Callable[[], Optional[float]]] = None,
        lan_sync: Optional[LanSyncService] = None,
    ):
        self.sync_manager = sync_manager
        self.state_machine = state_machine
        self.start_sync_playback = start_sync_playback
        self.stop_playback = stop_playback
        self.seek_to_phase_ms = seek_to_phase_ms
        self.set_pause = set_pause
        self.is_playback_alive = is_playback_alive
        self.set_playback_speed = set_playback_speed or (lambda _speed: True)
        self.get_playback_time_ms = get_playback_time_ms or (lambda: None)
        self.get_playback_duration_ms = get_playback_duration_ms or (lambda: None)

        # Runtime tuning defaults (P0 efficiency): slower idle polling, faster warm-up status.
        self.command_poll_idle_interval_s = self._resolve_interval_env("SYNC_COMMAND_POLL_IDLE_S", 10.0)
        self.command_poll_active_interval_s = self._resolve_interval_env("SYNC_COMMAND_POLL_ACTIVE_S", 2.0)
        self.command_poll_critical_interval_s = self._resolve_interval_env("SYNC_COMMAND_POLL_CRITICAL_S", 1.0)
        self.status_interval_critical_s = self._resolve_interval_env("SYNC_STATUS_INTERVAL_CRITICAL_S", 2.0)
        self.status_interval_playing_s = self._resolve_interval_env("SYNC_STATUS_INTERVAL_PLAYING_S", 5.0)
        self.hard_resync_threshold_ms = self._resolve_int_env("SYNC_HARD_RESYNC_THRESHOLD_MS", 500, 25)
        self.clock_check_interval_s = 10.0
        self.clock_max_offset_ms = 50.0
        self.lan_enabled = self._resolve_bool_env("SYNC_LAN_ENABLED", False)
        self.lan_beacon_hz = self._resolve_interval_env("SYNC_LAN_BEACON_HZ", 20.0, 1.0)
        self.lan_beacon_port = self._resolve_int_env("SYNC_LAN_BEACON_PORT", 39051, 1024)
        self.lan_timeout_ms = self._resolve_int_env("SYNC_LAN_TIMEOUT_MS", 1500, 250)
        self.lan_fallback_to_cloud = self._resolve_bool_env("SYNC_LAN_FALLBACK_TO_CLOUD", True)
        self.lan_bind_host = os.getenv("SYNC_LAN_BIND_HOST", "0.0.0.0")
        self.lan_broadcast_addr = os.getenv("SYNC_LAN_BROADCAST_ADDR", "255.255.255.255")
        self.status_interval_playing_lan_s = self._resolve_interval_env("SYNC_STATUS_INTERVAL_PLAYING_LAN_S", 10.0, 1.0)
        self.command_poll_playing_lan_s = self._resolve_interval_env("SYNC_COMMAND_POLL_PLAYING_LAN_S", 5.0, 1.0)
        self.lan_sync = lan_sync or LanSyncService(
            enabled=self.lan_enabled,
            beacon_hz=self.lan_beacon_hz,
            beacon_port=self.lan_beacon_port,
            timeout_ms=self.lan_timeout_ms,
            broadcast_addr=self.lan_broadcast_addr,
            bind_host=self.lan_bind_host,
        )

        self._last_poll_ts = 0.0
        self._last_status_ts = 0.0
        self._last_clock_check_ts = 0.0
        self._warmup_until_ms: Optional[int] = None
        self._resync_count = 0
        self._last_thermal_log_ts = 0.0
        self._restart_attempts = 0
        self._max_restart_attempts = 5
        self._restart_backoff_seconds = [2, 4, 8, 16, 30]
        self._next_restart_at_ms: Optional[int] = None
        self._drift_sample_count = 0
        self._drift_abs_sum_ms = 0.0
        self._drift_max_abs_ms = 0.0
        self._last_drift_ms: Optional[float] = None
        self._drift_window_samples: deque[tuple[int, float]] = deque()
        self._last_applied_speed = 1.0
        self._last_soft_correction_log_ts = 0.0
        self._local_device_id: Optional[str] = None
        self._lan_mode = "disabled"
        self._lan_last_beacon_age_ms: Optional[int] = None
        self._last_clock_health: Dict[str, object] = {
            "healthy": False,
            "critical": True,
            "offset_ms": None,
            "throttled": False,
            "health_score": 0.0,
        }

    @staticmethod
    def _resolve_interval_env(name: str, default_value: float, minimum: float = 0.2) -> float:
        raw = os.getenv(name)
        if raw is None:
            return default_value
        try:
            parsed = float(raw)
        except ValueError:
            return default_value
        return max(minimum, parsed)

    @staticmethod
    def _resolve_int_env(name: str, default_value: int, minimum: int) -> int:
        raw = os.getenv(name)
        if raw is None:
            return default_value
        try:
            parsed = int(raw)
        except ValueError:
            return default_value
        return max(minimum, parsed)

    @staticmethod
    def _resolve_bool_env(name: str, default_value: bool) -> bool:
        raw = os.getenv(name)
        if raw is None:
            return default_value
        return raw.strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _coerce_bool(value: object, default: bool) -> bool:
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"1", "true", "yes", "on"}:
                return True
            if lowered in {"0", "false", "no", "off"}:
                return False
        return default

    def _current_command_poll_interval_s(self) -> float:
        if not self.state_machine.is_active():
            return self.command_poll_idle_interval_s

        state = self.state_machine.state
        if state in {SYNC_STATE_PRELOADING, SYNC_STATE_READY, SYNC_STATE_WARMING_UP}:
            return self.command_poll_critical_interval_s
        if state == SYNC_STATE_PLAYING:
            if self._lan_mode == "follower":
                return max(self.command_poll_active_interval_s, self.command_poll_playing_lan_s)
            return self.command_poll_active_interval_s
        return self.command_poll_idle_interval_s

    def _current_status_interval_s(self) -> float:
        state = self.state_machine.state
        if state in {SYNC_STATE_READY, SYNC_STATE_WARMING_UP}:
            return self.status_interval_critical_s
        if state == SYNC_STATE_PLAYING:
            if self._lan_mode == "follower":
                return max(self.status_interval_playing_s, self.status_interval_playing_lan_s)
            return self.status_interval_playing_s
        return self.status_interval_critical_s

    def _reset_runtime_metrics(self) -> None:
        self._resync_count = 0
        self._drift_sample_count = 0
        self._drift_abs_sum_ms = 0.0
        self._drift_max_abs_ms = 0.0
        self._last_drift_ms = None
        self._drift_window_samples.clear()
        self._last_applied_speed = 1.0
        self._last_soft_correction_log_ts = 0.0

    def _prune_drift_window(self, now_ms: int) -> None:
        cutoff_ms = now_ms - self.DRIFT_AVG_WINDOW_MS
        while self._drift_window_samples and self._drift_window_samples[0][0] < cutoff_ms:
            self._drift_window_samples.popleft()

    def _resolve_prepare_local_path(self, raw_local_path: str) -> Optional[str]:
        """
        Resolve media path from sync.prepare payload in a player-portable way.
        Accept absolute paths when valid, otherwise fallback to media_dir + basename.
        """
        local_path = str(raw_local_path)
        if os.path.isabs(local_path) and os.path.exists(local_path):
            return local_path

        media_dir = getattr(self.sync_manager, "media_dir", None)
        basename = os.path.basename(local_path)
        if media_dir and basename:
            candidate = os.path.join(str(media_dir), basename)
            if os.path.exists(candidate):
                if candidate != local_path:
                    logging.info(
                        "[VIDEOWALL] Resolved prepare path '%s' -> '%s'",
                        local_path,
                        candidate,
                    )
                return candidate

        if os.path.exists(local_path):
            return local_path

        return None

    def _resolve_local_device_id(self) -> Optional[str]:
        if self._local_device_id:
            return self._local_device_id
        getter = getattr(self.sync_manager, "get_current_device_id", None)
        if callable(getter):
            resolved = getter()
            if isinstance(resolved, str) and resolved:
                self._local_device_id = resolved
                return self._local_device_id
        return None

    def _apply_prepare_sync_config(self, payload: Dict) -> None:
        sync_config = payload.get("sync_config") or payload.get("syncConfig")
        if not isinstance(sync_config, dict):
            return

        hard_resync = sync_config.get("hard_resync_threshold_ms")
        if hard_resync is not None:
            try:
                self.hard_resync_threshold_ms = max(25, int(hard_resync))
            except (TypeError, ValueError):
                pass

        lan = sync_config.get("lan")
        if not isinstance(lan, dict):
            return

        enabled = lan.get("enabled")
        if enabled is not None:
            self.lan_enabled = self._coerce_bool(enabled, self.lan_enabled)

        beacon_hz = lan.get("beacon_hz") or lan.get("beaconHz")
        if beacon_hz is not None:
            try:
                self.lan_beacon_hz = max(1.0, float(beacon_hz))
            except (TypeError, ValueError):
                pass

        beacon_port = lan.get("beacon_port") or lan.get("beaconPort")
        if beacon_port is not None:
            try:
                self.lan_beacon_port = max(1024, int(beacon_port))
            except (TypeError, ValueError):
                pass

        timeout_ms = lan.get("timeout_ms") or lan.get("timeoutMs")
        if timeout_ms is not None:
            try:
                self.lan_timeout_ms = max(250, int(timeout_ms))
            except (TypeError, ValueError):
                pass

        fallback = lan.get("fallback_to_cloud") if "fallback_to_cloud" in lan else lan.get("fallbackToCloud")
        if fallback is not None:
            self.lan_fallback_to_cloud = self._coerce_bool(fallback, self.lan_fallback_to_cloud)

        bind_host = lan.get("bind_host") or lan.get("bindHost")
        if isinstance(bind_host, str) and bind_host:
            self.lan_bind_host = bind_host

        broadcast_addr = lan.get("broadcast_addr") or lan.get("broadcastAddr")
        if isinstance(broadcast_addr, str) and broadcast_addr:
            self.lan_broadcast_addr = broadcast_addr

        self.lan_sync.update_settings(
            enabled=self.lan_enabled,
            beacon_hz=self.lan_beacon_hz,
            beacon_port=self.lan_beacon_port,
            timeout_ms=self.lan_timeout_ms,
            bind_host=self.lan_bind_host,
            broadcast_addr=self.lan_broadcast_addr,
        )

    def _configure_lan_role(self, context: SyncSessionContext) -> None:
        if not self.lan_enabled:
            self.lan_sync.stop()
            self._lan_mode = "disabled"
            self._lan_last_beacon_age_ms = None
            return

        local_device_id = context.device_id or self._resolve_local_device_id()
        if not local_device_id:
            self.lan_sync.stop()
            self._lan_mode = "cloud_fallback"
            self._lan_last_beacon_age_ms = None
            return

        if context.master_device_id and local_device_id == context.master_device_id:
            if self.lan_sync.start_master(
                session_id=context.session_id,
                master_device_id=local_device_id,
                duration_ms=context.duration_ms,
                get_phase_ms=self.get_playback_time_ms,
                get_speed=lambda: self._last_applied_speed,
            ):
                self._lan_mode = "master"
                self._lan_last_beacon_age_ms = None
            else:
                self._lan_mode = "cloud_fallback"
            return

        if context.master_device_id:
            if self.lan_sync.start_follower(
                session_id=context.session_id,
                master_device_id=context.master_device_id,
                duration_ms=context.duration_ms,
            ):
                self._lan_mode = "follower"
                self._lan_last_beacon_age_ms = None
            else:
                self._lan_mode = "cloud_fallback"
            return

        self.lan_sync.stop()
        self._lan_mode = "cloud_fallback"
        self._lan_last_beacon_age_ms = None

    def _resolve_target_phase_ms(self, now_ms: int, context: SyncSessionContext) -> Optional[int]:
        cloud_target = compute_target_phase_ms(now_ms, context.start_at_ms, context.duration_ms)
        if cloud_target is None:
            return None

        if self._lan_mode not in {"follower", "cloud_fallback"}:
            self._lan_last_beacon_age_ms = None
            return int(cloud_target)

        lan_target = self.lan_sync.get_follower_target_phase_ms(now_ms)
        beacon_age_ms = self.lan_sync.get_follower_beacon_age_ms(now_ms)
        self._lan_last_beacon_age_ms = beacon_age_ms

        if lan_target is not None:
            self._lan_mode = "follower"
            return int(round(lan_target))

        if self.lan_fallback_to_cloud:
            self._lan_mode = "cloud_fallback"
            return int(cloud_target)

        return None

    def _read_runtime_duration_ms(self, expected_duration_ms: int) -> int:
        """
        Use MPV-reported media duration when available to avoid drift caused by
        preset duration rounding (e.g. nominal 10000ms vs real 9643ms).
        """
        for _ in range(15):
            actual_duration_ms = self.get_playback_duration_ms()
            if actual_duration_ms is not None and actual_duration_ms > 0:
                resolved_duration_ms = max(1, int(round(actual_duration_ms)))
                if abs(resolved_duration_ms - expected_duration_ms) >= 5:
                    logging.info(
                        "[VIDEOWALL] Using runtime media duration %sms (payload=%sms)",
                        resolved_duration_ms,
                        expected_duration_ms,
                    )
                return resolved_duration_ms
            time.sleep(0.1)
        return expected_duration_ms

    def is_active(self) -> bool:
        return self.state_machine.is_active()

    def tick(self) -> None:
        now_ts = time.time()

        if now_ts - self._last_poll_ts >= self._current_command_poll_interval_s():
            self._last_poll_ts = now_ts
            self._poll_commands()

        self._advance_runtime_state()

        if self.state_machine.is_active() and now_ts - self._last_status_ts >= self._current_status_interval_s():
            self._last_status_ts = now_ts
            self._report_status()

    def _poll_commands(self) -> None:
        commands = self.sync_manager.poll_device_commands(limit=20)
        for command in commands:
            command_id = command.get("id")
            command_type = command.get("type")
            payload = command.get("payload") or {}
            default_session_id = command.get("sessionId") or command.get("session_id")

            if not command_id or not command_type:
                continue

            if command_type == "SYNC_PREPARE":
                ok, error = self._handle_prepare(payload, default_session_id)
            elif command_type == "SYNC_STOP":
                ok, error = self._handle_stop(payload, default_session_id)
            else:
                ok, error = False, f"Unsupported command type: {command_type}"

            sync_runtime = self._build_sync_runtime()
            self.sync_manager.ack_device_command(
                command_id=command_id,
                status="ACKED" if ok else "FAILED",
                error=error,
                sync_runtime=sync_runtime,
            )

    def _extract_session_id(self, payload: Dict, fallback: Optional[str]) -> Optional[str]:
        return (
            payload.get("session_id")
            or payload.get("sessionId")
            or fallback
        )

    def _handle_prepare(self, payload: Dict, fallback_session_id: Optional[str]):
        session_id = self._extract_session_id(payload, fallback_session_id)
        if not session_id:
            return False, "Missing session_id in sync.prepare"
        self._apply_prepare_sync_config(payload)

        media = payload.get("media") or {}
        local_path = media.get("local_path") or media.get("localPath")
        if not local_path:
            return False, "Missing media.local_path in sync.prepare"
        media_id = media.get("media_id") or media.get("mediaId")
        resolved_local_path = self._resolve_prepare_local_path(str(local_path))
        if (
            not resolved_local_path
            and hasattr(self.sync_manager, "ensure_sync_media_available")
        ):
            downloaded_local_path = self.sync_manager.ensure_sync_media_available(
                str(media_id) if media_id is not None else None,
                str(local_path),
            )
            if downloaded_local_path:
                resolved_local_path = self._resolve_prepare_local_path(downloaded_local_path)

        if not resolved_local_path:
            return False, f"Local media not found: {local_path}"

        start_at_ms = payload.get("start_at_ms") or payload.get("startAtMs")
        duration_ms = payload.get("duration_ms") or payload.get("durationMs")
        master_device_id = payload.get("master_device_id") or payload.get("masterDeviceId")
        local_device_id = (
            payload.get("target_device_id")
            or payload.get("targetDeviceId")
            or payload.get("device_id")
            or payload.get("deviceId")
            or self._resolve_local_device_id()
        )
        if isinstance(local_device_id, str) and local_device_id:
            self._local_device_id = local_device_id

        if start_at_ms is None or duration_ms is None:
            return False, "Missing start_at_ms or duration_ms in sync.prepare"

        try:
            start_at_ms = int(start_at_ms)
            duration_ms = int(duration_ms)
        except (TypeError, ValueError):
            return False, "Invalid start_at_ms or duration_ms in sync.prepare"

        existing_context = self.state_machine.context
        if existing_context and existing_context.session_id == session_id:
            existing_context.start_at_ms = start_at_ms
            existing_context.duration_ms = duration_ms
            existing_context.local_path = resolved_local_path
            existing_context.master_device_id = master_device_id
            existing_context.device_id = local_device_id
            # No need to restart if already running and process is healthy.
            if self.state_machine.state in {SYNC_STATE_READY, SYNC_STATE_WARMING_UP, SYNC_STATE_PLAYING}:
                if self.is_playback_alive():
                    self._configure_lan_role(existing_context)
                    return True, None

        if self.state_machine.is_active() and (
            not existing_context or existing_context.session_id != session_id
        ):
            self._stop_active_session()

        self._reset_runtime_metrics()

        self.state_machine.activate(
            SyncSessionContext(
                session_id=session_id,
                start_at_ms=start_at_ms,
                duration_ms=duration_ms,
                local_path=resolved_local_path,
                master_device_id=master_device_id,
                device_id=local_device_id,
            )
        )

        if not self.state_machine.transition(SYNC_STATE_PRELOADING):
            return False, "Invalid transition to PRELOADING"

        clock_health = self._get_clock_health(force_refresh=True)
        if bool(clock_health.get("critical", True)):
            self.state_machine.transition(SYNC_STATE_ERRORED, force=True)
            return (
                False,
                f"Clock unsynchronized (offset_ms={clock_health.get('offset_ms')}, healthy={clock_health.get('healthy')})",
            )

        context = self.state_machine.context
        if not context:
            self.state_machine.transition(SYNC_STATE_ERRORED, force=True)
            return False, "Missing session context after activation"

        if not self.start_sync_playback(context):
            self.state_machine.transition(SYNC_STATE_ERRORED, force=True)
            return False, "Failed to start MPV in sync mode"

        context.duration_ms = self._read_runtime_duration_ms(context.duration_ms)
        duration_ms = context.duration_ms

        if not self.state_machine.transition(SYNC_STATE_READY):
            self.state_machine.transition(SYNC_STATE_ERRORED, force=True)
            return False, "Invalid transition to READY"

        log_sync_event(
            "READY",
            session_id=session_id,
            data={
                "local_path": local_path,
                "resolved_local_path": resolved_local_path,
                "start_at_ms": start_at_ms,
                "duration_ms": duration_ms,
                "master_device_id": master_device_id,
            },
        )
        self._restart_attempts = 0
        self._next_restart_at_ms = None
        self._configure_lan_role(context)

        return True, None

    def _handle_stop(self, payload: Dict, fallback_session_id: Optional[str]):
        session_id = self._extract_session_id(payload, fallback_session_id)
        context = self.state_machine.context

        if context and session_id and context.session_id != session_id:
            return True, None

        self._stop_active_session()
        return True, None

    def _stop_active_session(self) -> None:
        self.stop_playback()
        self.lan_sync.stop()
        if self.state_machine.is_active():
            self.state_machine.transition("DISCONNECTED", force=True)
        self.state_machine.reset()
        self._reset_runtime_metrics()
        self._warmup_until_ms = None
        self._restart_attempts = 0
        self._next_restart_at_ms = None
        self._lan_mode = "disabled"
        self._lan_last_beacon_age_ms = None

    def _enter_warmup(self, now_ms: int, *, rejoin: bool = False) -> None:
        context = self.state_machine.context
        if not context:
            return

        warmup_loops = 2
        warmup_ms = max(2000, min(12000, context.duration_ms * warmup_loops))
        self._warmup_until_ms = now_ms + warmup_ms
        if rejoin:
            logging.info(
                "[VIDEOWALL] Session %s rejoin warm-up (%sms)",
                context.session_id,
                warmup_ms,
            )
        else:
            logging.info(
                "[VIDEOWALL] Session %s entered warm-up (%sms)",
                context.session_id,
                warmup_ms,
            )

    def _sample_current_drift(self, now_ms: int, context: SyncSessionContext) -> Optional[tuple[float, int]]:
        target_phase = self._resolve_target_phase_ms(now_ms, context)
        if target_phase is None or context.duration_ms <= 0:
            return None

        playback_time_ms = self.get_playback_time_ms()
        if playback_time_ms is None:
            return None

        actual_phase_ms = float(playback_time_ms) % context.duration_ms
        drift_ms = compute_wrapped_drift_ms(
            actual_phase_ms=actual_phase_ms,
            target_phase_ms=float(target_phase),
            duration_ms=context.duration_ms,
        )

        abs_drift = abs(drift_ms)
        self._last_drift_ms = drift_ms
        self._drift_sample_count += 1
        self._drift_abs_sum_ms += abs_drift
        self._drift_window_samples.append((now_ms, abs_drift))
        self._prune_drift_window(now_ms)
        if abs_drift > self._drift_max_abs_ms:
            self._drift_max_abs_ms = abs_drift

        return drift_ms, int(target_phase)

    def _apply_runtime_correction(self, now_ms: int, context: SyncSessionContext) -> None:
        sampled = self._sample_current_drift(now_ms, context)
        if not sampled:
            return

        drift_ms, target_phase_ms = sampled
        in_warmup = self.state_machine.state == SYNC_STATE_WARMING_UP
        decision = decide_correction(
            drift_ms=drift_ms,
            target_phase_ms=target_phase_ms,
            in_warmup=in_warmup,
            hard_resync_threshold_ms=self.hard_resync_threshold_ms,
        )

        if decision.action == "hard" and decision.seek_to_ms is not None:
            if self.seek_to_phase_ms(decision.seek_to_ms):
                self._resync_count += 1
                self.set_playback_speed(1.0)
                self._last_applied_speed = 1.0
                log_sync_event(
                    "HARD_RESYNC",
                    session_id=context.session_id,
                    data={
                        "reason": "runtime_drift",
                        "drift_ms": drift_ms,
                        "seek_to_ms": decision.seek_to_ms,
                        "warmup": in_warmup,
                    },
                )
            return

        target_speed = decision.target_speed
        if decision.action == "none":
            target_speed = 1.0

        if abs(target_speed - self._last_applied_speed) < 0.002:
            return

        if self.set_playback_speed(target_speed):
            self._last_applied_speed = target_speed
            if decision.action == "soft":
                now_ts = time.time()
                if now_ts - self._last_soft_correction_log_ts >= 5:
                    self._last_soft_correction_log_ts = now_ts
                    log_sync_event(
                        "SOFT_CORRECTION",
                        session_id=context.session_id,
                        data={
                            "drift_ms": drift_ms,
                            "speed": target_speed,
                            "warmup": in_warmup,
                        },
                    )

    def _handle_playback_failure(self, now_ms: int) -> None:
        context = self.state_machine.context
        if not context:
            return

        if self._restart_attempts >= self._max_restart_attempts:
            self.state_machine.transition(SYNC_STATE_ERRORED, force=True)
            logging.error(
                "[VIDEOWALL] Session %s exceeded restart attempts (%s)",
                context.session_id,
                self._max_restart_attempts,
            )
            return

        if self._next_restart_at_ms is None:
            delay_seconds = self._restart_backoff_seconds[
                min(self._restart_attempts, len(self._restart_backoff_seconds) - 1)
            ]
            self._next_restart_at_ms = now_ms + (delay_seconds * 1000)
            logging.error(
                "[VIDEOWALL] MPV crash detected in session %s. Restarting in %ss (attempt %s/%s)",
                context.session_id,
                delay_seconds,
                self._restart_attempts + 1,
                self._max_restart_attempts,
            )
            log_sync_event(
                "MPV_CRASH",
                session_id=context.session_id,
                level=logging.ERROR,
                data={
                    "restart_in_s": delay_seconds,
                    "attempt": self._restart_attempts + 1,
                    "max_attempts": self._max_restart_attempts,
                },
            )
            return

        if now_ms < self._next_restart_at_ms:
            return

        self._restart_attempts += 1
        self._next_restart_at_ms = None

        if not self.start_sync_playback(context):
            if self._restart_attempts >= self._max_restart_attempts:
                self.state_machine.transition(SYNC_STATE_ERRORED, force=True)
                logging.error(
                    "[VIDEOWALL] MPV restart failed permanently for session %s",
                    context.session_id,
                )
            return

        target_phase = compute_target_phase_ms(now_ms, context.start_at_ms, context.duration_ms)
        if target_phase is None:
            target_phase = 0

        seek_to_ms = round_to_frame(target_phase)
        self.seek_to_phase_ms(seek_to_ms)
        self._resync_count += 1
        self.set_playback_speed(1.0)
        self._last_applied_speed = 1.0
        self.set_pause(False)
        self.state_machine.transition(SYNC_STATE_WARMING_UP, force=True)
        self._enter_warmup(now_ms, rejoin=True)

        logging.info(
            "[VIDEOWALL] REJOIN session=%s seek_to_ms=%s restart_attempts=%s",
            context.session_id,
            seek_to_ms,
            self._restart_attempts,
        )
        log_sync_event(
            "HARD_RESYNC",
            session_id=context.session_id,
            data={
                "reason": "rejoin_after_mpv_crash",
                "seek_to_ms": seek_to_ms,
                "restart_attempts": self._restart_attempts,
            },
        )
        log_sync_event(
            "REJOIN",
            session_id=context.session_id,
            data={
                "seek_to_ms": seek_to_ms,
                "restart_attempts": self._restart_attempts,
            },
        )

        self._restart_attempts = 0

    def _advance_runtime_state(self) -> None:
        context = self.state_machine.context
        if not context:
            return

        now_ms = int(time.time() * 1000)
        state = self.state_machine.state

        if state in {SYNC_STATE_READY, SYNC_STATE_WARMING_UP, SYNC_STATE_PLAYING} and not self.is_playback_alive():
            self._handle_playback_failure(now_ms)
            return

        if self.state_machine.state == SYNC_STATE_READY and now_ms >= context.start_at_ms:
            target_phase = compute_target_phase_ms(now_ms, context.start_at_ms, context.duration_ms)
            seek_to_ms = None
            if target_phase is not None:
                seek_to_ms = round_to_frame(target_phase)
                if not self.seek_to_phase_ms(seek_to_ms):
                    logging.warning(
                        "[VIDEOWALL] Initial phase alignment failed for session %s (seek_to_ms=%s)",
                        context.session_id,
                            seek_to_ms,
                        )

            self.set_playback_speed(1.0)
            self._last_applied_speed = 1.0
            self.set_pause(False)
            if self.state_machine.transition(SYNC_STATE_WARMING_UP):
                self._enter_warmup(now_ms, rejoin=False)
                log_sync_event(
                    "STARTED",
                    session_id=context.session_id,
                    data={
                        "start_at_ms": context.start_at_ms,
                        "started_at_ms": now_ms,
                        "start_delay_ms": now_ms - context.start_at_ms,
                        "seek_to_ms": seek_to_ms,
                    },
                )

        if self.state_machine.state in {SYNC_STATE_WARMING_UP, SYNC_STATE_PLAYING}:
            self._apply_runtime_correction(now_ms, context)

        if self.state_machine.state == SYNC_STATE_WARMING_UP:
            if self._warmup_until_ms is not None and now_ms >= self._warmup_until_ms:
                if self.state_machine.transition(SYNC_STATE_PLAYING):
                    logging.info("[VIDEOWALL] Session %s is now PLAYING", context.session_id)

    def _get_clock_health(self, force_refresh: bool = False) -> Dict[str, object]:
        now_ts = time.time()
        if (
            not force_refresh
            and now_ts - self._last_clock_check_ts < self.clock_check_interval_s
        ):
            return self._last_clock_health

        self._last_clock_check_ts = now_ts
        self._last_clock_health = self.sync_manager.get_clock_sync_health(
            max_offset_ms=self.clock_max_offset_ms
        )
        return self._last_clock_health

    def _build_sync_runtime(self) -> Optional[Dict[str, object]]:
        context = self.state_machine.context
        if not context:
            return None

        now_ms = int(time.time() * 1000)
        self._prune_drift_window(now_ms)
        avg_drift_ms = (
            sum(sample[1] for sample in self._drift_window_samples) / len(self._drift_window_samples)
            if self._drift_window_samples
            else 0.0
        )
        elapsed_minutes = max(0.0, (now_ms - context.start_at_ms) / 60000.0)
        resync_rate = self._resync_count / elapsed_minutes if elapsed_minutes > 0 else 0.0
        clock_health = self._get_clock_health(force_refresh=False)
        status = self.state_machine.state
        return {
            "session_id": context.session_id,
            "status": status,
            "drift_ms": self._last_drift_ms if self._last_drift_ms is not None else 0.0,
            "resync_count": self._resync_count,
            "clock_offset_ms": clock_health.get("offset_ms"),
            "throttled": bool(clock_health.get("throttled", False)),
            "health_score": clock_health.get("health_score"),
            "avg_drift_ms": avg_drift_ms,
            "max_drift_ms": self._drift_max_abs_ms,
            "resync_rate": resync_rate,
            "lan_mode": self._lan_mode,
            "lan_beacon_age_ms": self._lan_last_beacon_age_ms,
        }

    def _report_status(self) -> None:
        runtime = self._build_sync_runtime()
        if not runtime:
            return

        if runtime.get("throttled"):
            now_ts = time.time()
            if now_ts - self._last_thermal_log_ts >= 30:
                self._last_thermal_log_ts = now_ts
                log_sync_event(
                    "THERMAL_THROTTLE",
                    session_id=str(runtime.get("session_id")),
                    level=logging.WARNING,
                    data={
                        "clock_offset_ms": runtime.get("clock_offset_ms"),
                        "health_score": runtime.get("health_score"),
                    },
                )

        self.sync_manager.report_playback_state(
            playing_playlist_id=None,
            current_content_name=os.path.basename(str(self.state_machine.context.local_path)),
            preview_path=None,
            sync_runtime=runtime,
        )
