from __future__ import annotations

from collections import deque
import logging
import os
import time
from typing import Callable, Dict, Optional

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

        # Runtime tuning defaults (P0 efficiency): slower idle polling, faster warm-up status.
        self.command_poll_idle_interval_s = self._resolve_interval_env("SYNC_COMMAND_POLL_IDLE_S", 10.0)
        self.command_poll_active_interval_s = self._resolve_interval_env("SYNC_COMMAND_POLL_ACTIVE_S", 2.0)
        self.command_poll_critical_interval_s = self._resolve_interval_env("SYNC_COMMAND_POLL_CRITICAL_S", 1.0)
        self.status_interval_critical_s = self._resolve_interval_env("SYNC_STATUS_INTERVAL_CRITICAL_S", 2.0)
        self.status_interval_playing_s = self._resolve_interval_env("SYNC_STATUS_INTERVAL_PLAYING_S", 5.0)
        self.clock_check_interval_s = 10.0
        self.clock_max_offset_ms = 50.0

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

    def _current_command_poll_interval_s(self) -> float:
        if not self.state_machine.is_active():
            return self.command_poll_idle_interval_s

        state = self.state_machine.state
        if state in {SYNC_STATE_PRELOADING, SYNC_STATE_READY, SYNC_STATE_WARMING_UP}:
            return self.command_poll_critical_interval_s
        if state == SYNC_STATE_PLAYING:
            return self.command_poll_active_interval_s
        return self.command_poll_idle_interval_s

    def _current_status_interval_s(self) -> float:
        state = self.state_machine.state
        if state in {SYNC_STATE_READY, SYNC_STATE_WARMING_UP}:
            return self.status_interval_critical_s
        if state == SYNC_STATE_PLAYING:
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

        media = payload.get("media") or {}
        local_path = media.get("local_path") or media.get("localPath")
        if not local_path:
            return False, "Missing media.local_path in sync.prepare"
        resolved_local_path = self._resolve_prepare_local_path(str(local_path))
        if not resolved_local_path:
            return False, f"Local media not found: {local_path}"

        start_at_ms = payload.get("start_at_ms") or payload.get("startAtMs")
        duration_ms = payload.get("duration_ms") or payload.get("durationMs")
        master_device_id = payload.get("master_device_id") or payload.get("masterDeviceId")

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
            # No need to restart if already running and process is healthy.
            if self.state_machine.state in {SYNC_STATE_READY, SYNC_STATE_WARMING_UP, SYNC_STATE_PLAYING}:
                if self.is_playback_alive():
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
        if self.state_machine.is_active():
            self.state_machine.transition("DISCONNECTED", force=True)
        self.state_machine.reset()
        self._reset_runtime_metrics()
        self._warmup_until_ms = None
        self._restart_attempts = 0
        self._next_restart_at_ms = None

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
        target_phase = compute_target_phase_ms(now_ms, context.start_at_ms, context.duration_ms)
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
