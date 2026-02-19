from __future__ import annotations

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
from videowall_drift import compute_target_phase_ms, round_to_frame


class VideowallController:
    def __init__(
        self,
        sync_manager,
        state_machine: SyncStateMachine,
        start_sync_playback: Callable[[SyncSessionContext], bool],
        stop_playback: Callable[[], None],
        seek_to_phase_ms: Callable[[int], bool],
        set_pause: Callable[[bool], bool],
        is_playback_alive: Callable[[], bool],
    ):
        self.sync_manager = sync_manager
        self.state_machine = state_machine
        self.start_sync_playback = start_sync_playback
        self.stop_playback = stop_playback
        self.seek_to_phase_ms = seek_to_phase_ms
        self.set_pause = set_pause
        self.is_playback_alive = is_playback_alive

        self.poll_interval_s = 1.0
        self.status_interval_s = 2.0
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
        self._last_clock_health: Dict[str, object] = {
            "healthy": False,
            "critical": True,
            "offset_ms": None,
            "throttled": False,
            "health_score": 0.0,
        }

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

        if now_ts - self._last_poll_ts >= self.poll_interval_s:
            self._last_poll_ts = now_ts
            self._poll_commands()

        self._advance_runtime_state()

        if self.state_machine.is_active() and now_ts - self._last_status_ts >= self.status_interval_s:
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

        clock_health = self._get_clock_health(force_refresh=False)
        status = self.state_machine.state
        return {
            "session_id": context.session_id,
            "status": status,
            "drift_ms": 0,
            "resync_count": self._resync_count,
            "clock_offset_ms": clock_health.get("offset_ms"),
            "throttled": bool(clock_health.get("throttled", False)),
            "health_score": clock_health.get("health_score"),
            "avg_drift_ms": 0,
            "max_drift_ms": 0,
            "resync_rate": 0,
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
