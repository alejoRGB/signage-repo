from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Dict, Optional, Set


SYNC_STATE_ASSIGNED = "ASSIGNED"
SYNC_STATE_PRELOADING = "PRELOADING"
SYNC_STATE_READY = "READY"
SYNC_STATE_WARMING_UP = "WARMING_UP"
SYNC_STATE_PLAYING = "PLAYING"
SYNC_STATE_DISCONNECTED = "DISCONNECTED"
SYNC_STATE_ERRORED = "ERRORED"

SYNC_RUNTIME_STATES = {
    SYNC_STATE_ASSIGNED,
    SYNC_STATE_PRELOADING,
    SYNC_STATE_READY,
    SYNC_STATE_WARMING_UP,
    SYNC_STATE_PLAYING,
    SYNC_STATE_DISCONNECTED,
    SYNC_STATE_ERRORED,
}


@dataclass
class SyncSessionContext:
    session_id: str
    start_at_ms: int
    duration_ms: int
    local_path: str
    master_device_id: Optional[str] = None


class SyncStateMachine:
    _ALLOWED_TRANSITIONS: Dict[str, Set[str]] = {
        SYNC_STATE_ASSIGNED: {
            SYNC_STATE_PRELOADING,
            SYNC_STATE_DISCONNECTED,
            SYNC_STATE_ERRORED,
        },
        SYNC_STATE_PRELOADING: {
            SYNC_STATE_READY,
            SYNC_STATE_DISCONNECTED,
            SYNC_STATE_ERRORED,
        },
        SYNC_STATE_READY: {
            SYNC_STATE_WARMING_UP,
            SYNC_STATE_DISCONNECTED,
            SYNC_STATE_ERRORED,
        },
        SYNC_STATE_WARMING_UP: {
            SYNC_STATE_PLAYING,
            SYNC_STATE_DISCONNECTED,
            SYNC_STATE_ERRORED,
        },
        SYNC_STATE_PLAYING: {
            SYNC_STATE_WARMING_UP,
            SYNC_STATE_DISCONNECTED,
            SYNC_STATE_ERRORED,
        },
        SYNC_STATE_DISCONNECTED: {
            SYNC_STATE_WARMING_UP,
            SYNC_STATE_ERRORED,
        },
        SYNC_STATE_ERRORED: {
            SYNC_STATE_DISCONNECTED,
        },
    }

    def __init__(self):
        self._lock = RLock()
        self._state: str = SYNC_STATE_DISCONNECTED
        self._context: Optional[SyncSessionContext] = None

    def activate(self, context: SyncSessionContext) -> None:
        with self._lock:
            self._context = context
            self._state = SYNC_STATE_ASSIGNED

    def reset(self) -> None:
        with self._lock:
            self._context = None
            self._state = SYNC_STATE_DISCONNECTED

    def is_active(self) -> bool:
        with self._lock:
            return self._context is not None

    @property
    def state(self) -> str:
        with self._lock:
            return self._state

    @property
    def context(self) -> Optional[SyncSessionContext]:
        with self._lock:
            return self._context

    def can_transition(self, to_state: str) -> bool:
        with self._lock:
            if self._state == to_state:
                return True
            return to_state in self._ALLOWED_TRANSITIONS.get(self._state, set())

    def transition(self, to_state: str, force: bool = False) -> bool:
        if to_state not in SYNC_RUNTIME_STATES:
            return False

        with self._lock:
            if self._state == to_state:
                return True

            if not force and to_state not in self._ALLOWED_TRANSITIONS.get(self._state, set()):
                return False

            self._state = to_state
            return True

    def snapshot(self) -> Dict[str, Optional[str]]:
        with self._lock:
            return {
                "state": self._state,
                "session_id": self._context.session_id if self._context else None,
                "master_device_id": self._context.master_device_id if self._context else None,
                "local_path": self._context.local_path if self._context else None,
            }
