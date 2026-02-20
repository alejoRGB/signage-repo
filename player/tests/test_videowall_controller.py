import time

from state_machine import SyncSessionContext, SyncStateMachine
from videowall_controller import VideowallController


class DummySyncManager:
    def __init__(self, command_batches, clock_health):
        self._command_batches = list(command_batches)
        self.clock_health = clock_health
        self.acks = []
        self.status_reports = []
        self.poll_count = 0
        self.device_id = "device-local"

    def poll_device_commands(self, limit=10):
        self.poll_count += 1
        if not self._command_batches:
            return []
        return self._command_batches.pop(0)

    def ack_device_command(self, command_id, status="ACKED", error=None, sync_runtime=None):
        self.acks.append(
            {
                "command_id": command_id,
                "status": status,
                "error": error,
                "sync_runtime": sync_runtime,
            }
        )
        return True

    def report_playback_state(self, **kwargs):
        self.status_reports.append(kwargs)
        return True

    def get_clock_sync_health(self, max_offset_ms=50.0):
        return self.clock_health

    def get_current_device_id(self):
        return self.device_id


class FakeLanSync:
    def __init__(self):
        self.mode = "idle"
        self.started_master = []
        self.started_follower = []
        self.stopped = 0
        self.next_target_phase = None
        self.next_age_ms = None

    def update_settings(self, **_kwargs):
        return None

    def stop(self):
        self.stopped += 1
        self.mode = "idle"

    def start_master(self, **kwargs):
        self.started_master.append(kwargs)
        self.mode = "master"
        return True

    def start_follower(self, **kwargs):
        self.started_follower.append(kwargs)
        self.mode = "follower"
        return True

    def get_follower_target_phase_ms(self, _now_ms):
        return self.next_target_phase

    def get_follower_beacon_age_ms(self, _now_ms):
        return self.next_age_ms


def test_prepare_command_acks_when_clock_is_healthy(tmp_path):
    media_file = tmp_path / "sync.mp4"
    media_file.write_bytes(b"test")

    manager = DummySyncManager(
        command_batches=[
            [
                {
                    "id": "cmd-1",
                    "type": "SYNC_PREPARE",
                    "sessionId": "session-1",
                    "payload": {
                        "session_id": "session-1",
                        "start_at_ms": int(time.time() * 1000) + 500,
                        "duration_ms": 10000,
                        "media": {"local_path": str(media_file)},
                    },
                }
            ]
        ],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 3.5,
            "health_score": 0.95,
            "throttled": False,
        },
    )

    started = {"value": False}

    controller = VideowallController(
        sync_manager=manager,
        state_machine=SyncStateMachine(),
        start_sync_playback=lambda _context: started.update({"value": True}) or True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
    )

    controller.tick()

    assert started["value"] is True
    assert manager.acks[0]["status"] == "ACKED"
    assert controller.is_active() is True


def test_prepare_command_fails_when_clock_is_critical(tmp_path):
    media_file = tmp_path / "sync.mp4"
    media_file.write_bytes(b"test")

    manager = DummySyncManager(
        command_batches=[
            [
                {
                    "id": "cmd-2",
                    "type": "SYNC_PREPARE",
                    "sessionId": "session-2",
                    "payload": {
                        "session_id": "session-2",
                        "start_at_ms": int(time.time() * 1000) + 500,
                        "duration_ms": 10000,
                        "media": {"local_path": str(media_file)},
                    },
                }
            ]
        ],
        clock_health={
            "healthy": False,
            "critical": True,
            "offset_ms": 420.0,
            "health_score": 0.1,
            "throttled": False,
        },
    )

    controller = VideowallController(
        sync_manager=manager,
        state_machine=SyncStateMachine(),
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
    )

    controller.tick()

    assert manager.acks[0]["status"] == "FAILED"
    assert "Clock unsynchronized" in (manager.acks[0]["error"] or "")


def test_stop_command_resets_active_session():
    manager = DummySyncManager(
        command_batches=[
            [
                {
                    "id": "cmd-stop",
                    "type": "SYNC_STOP",
                    "sessionId": "session-3",
                    "payload": {"session_id": "session-3"},
                }
            ]
        ],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.0,
            "health_score": 1.0,
            "throttled": False,
        },
    )

    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-3",
            start_at_ms=int(time.time() * 1000) - 1000,
            duration_ms=10000,
            local_path="/tmp/video.mp4",
        )
    )

    stopped = {"count": 0}
    controller = VideowallController(
        sync_manager=manager,
        state_machine=machine,
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: stopped.update({"count": stopped["count"] + 1}),
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
    )

    controller.tick()

    assert stopped["count"] == 1
    assert manager.acks[0]["status"] == "ACKED"
    assert controller.is_active() is False


def test_crash_recovery_rejoins_with_seek_and_resets_attempts():
    manager = DummySyncManager(
        command_batches=[],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 2.0,
            "health_score": 1.0,
            "throttled": False,
        },
    )

    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-4",
            start_at_ms=int(time.time() * 1000) - 3000,
            duration_ms=10000,
            local_path="/tmp/video.mp4",
        )
    )
    machine.transition("PRELOADING")
    machine.transition("READY")
    machine.transition("WARMING_UP")
    machine.transition("PLAYING")

    restarts = {"count": 0}
    seeks = {"count": 0}
    ticks = {"alive": False}

    controller = VideowallController(
        sync_manager=manager,
        state_machine=machine,
        start_sync_playback=lambda _context: restarts.update({"count": restarts["count"] + 1}) or True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: seeks.update({"count": seeks["count"] + 1}) or True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: ticks["alive"],
    )

    controller._restart_backoff_seconds = [0]
    controller.tick()
    controller.tick()

    assert restarts["count"] == 1
    assert seeks["count"] == 1
    assert controller._restart_attempts == 0


def test_ready_transition_aligns_phase_before_unpause(mocker):
    now_ms = 1_000_000
    manager = DummySyncManager(
        command_batches=[],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.0,
            "health_score": 1.0,
            "throttled": False,
        },
    )

    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-5",
            start_at_ms=now_ms - 900,
            duration_ms=10000,
            local_path="/tmp/video.mp4",
        )
    )
    machine.transition("PRELOADING")
    machine.transition("READY")

    seeks = []
    pause_calls = []

    controller = VideowallController(
        sync_manager=manager,
        state_machine=machine,
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda phase_ms: seeks.append(phase_ms) or True,
        set_pause=lambda paused: pause_calls.append(paused) or True,
        is_playback_alive=lambda: True,
    )

    mocker.patch("videowall_controller.time.time", return_value=now_ms / 1000.0)

    controller._advance_runtime_state()

    assert len(seeks) == 1
    assert seeks[0] == 900
    assert pause_calls == [False]
    assert machine.state == "WARMING_UP"


def test_build_sync_runtime_reports_real_drift_metrics(mocker):
    manager = DummySyncManager(
        command_batches=[],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.5,
            "health_score": 0.97,
            "throttled": False,
        },
    )

    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-6",
            start_at_ms=5_000,
            duration_ms=10_000,
            local_path="/tmp/video.mp4",
        )
    )
    machine.transition("PRELOADING")
    machine.transition("READY")
    machine.transition("WARMING_UP")
    machine.transition("PLAYING")

    playback_samples = iter([4200.0, 4700.0])
    seeks = []
    speeds = []
    controller = VideowallController(
        sync_manager=manager,
        state_machine=machine,
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda phase_ms: seeks.append(phase_ms) or True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
        set_playback_speed=lambda speed: speeds.append(speed) or True,
        get_playback_time_ms=lambda: next(playback_samples, None),
    )

    mocker.patch("videowall_controller.time.time", return_value=10.0)

    assert machine.context is not None
    controller._apply_runtime_correction(now_ms=10_000, context=machine.context)
    controller._apply_runtime_correction(now_ms=10_000, context=machine.context)
    runtime = controller._build_sync_runtime()

    assert runtime is not None
    assert abs(float(runtime["drift_ms"]) + 300.0) < 0.001
    assert abs(float(runtime["avg_drift_ms"]) - 550.0) < 0.001
    assert abs(float(runtime["max_drift_ms"]) - 800.0) < 0.001
    assert int(runtime["resync_count"]) == 1
    assert len(seeks) == 1
    assert len(speeds) >= 1


def test_build_sync_runtime_uses_last_20_seconds_for_avg_drift(mocker):
    manager = DummySyncManager(
        command_batches=[],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.5,
            "health_score": 0.97,
            "throttled": False,
        },
    )

    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-7",
            start_at_ms=0,
            duration_ms=10_000,
            local_path="/tmp/video.mp4",
        )
    )
    machine.transition("PRELOADING")
    machine.transition("READY")
    machine.transition("WARMING_UP")
    machine.transition("PLAYING")

    # At now_ms=10_000 target phase is 0 -> abs drift = 1000ms
    # At now_ms=35_000 target phase is 5000 -> abs drift = 100ms
    playback_samples = iter([1000.0, 5100.0])
    controller = VideowallController(
        sync_manager=manager,
        state_machine=machine,
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
        set_playback_speed=lambda _speed: True,
        get_playback_time_ms=lambda: next(playback_samples, None),
    )

    assert machine.context is not None
    controller._apply_runtime_correction(now_ms=10_000, context=machine.context)
    controller._apply_runtime_correction(now_ms=35_000, context=machine.context)

    mocker.patch("videowall_controller.time.time", return_value=35.0)
    runtime = controller._build_sync_runtime()

    assert runtime is not None
    assert abs(float(runtime["avg_drift_ms"]) - 100.0) < 0.001


def test_tick_uses_idle_command_poll_interval_when_no_active_session(mocker):
    manager = DummySyncManager(
        command_batches=[[], []],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.0,
            "health_score": 1.0,
            "throttled": False,
        },
    )

    controller = VideowallController(
        sync_manager=manager,
        state_machine=SyncStateMachine(),
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
    )

    controller.command_poll_idle_interval_s = 10.0
    controller._last_poll_ts = -100.0
    controller._advance_runtime_state = lambda: None

    mocker.patch("videowall_controller.time.time", side_effect=[0.0, 5.0, 10.1])

    controller.tick()
    controller.tick()
    controller.tick()

    assert manager.poll_count == 2


def test_tick_uses_slower_status_interval_in_playing_state(mocker):
    manager = DummySyncManager(
        command_batches=[],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.0,
            "health_score": 1.0,
            "throttled": False,
        },
    )

    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-8",
            start_at_ms=0,
            duration_ms=10_000,
            local_path="/tmp/video.mp4",
        )
    )
    machine.transition("PRELOADING")
    machine.transition("READY")
    machine.transition("WARMING_UP")
    machine.transition("PLAYING")

    controller = VideowallController(
        sync_manager=manager,
        state_machine=machine,
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
    )

    controller.status_interval_playing_s = 5.0
    controller._last_status_ts = -100.0
    controller._poll_commands = lambda: None
    controller._advance_runtime_state = lambda: None
    controller._report_status = lambda: manager.status_reports.append({"ok": True})

    mocker.patch("videowall_controller.time.time", side_effect=[0.0, 1.0, 4.9, 5.1])

    controller.tick()
    controller.tick()
    controller.tick()
    controller.tick()

    assert len(manager.status_reports) == 2


def test_prepare_configures_lan_master_role_when_device_is_master(tmp_path):
    media_file = tmp_path / "sync.mp4"
    media_file.write_bytes(b"test")

    manager = DummySyncManager(
        command_batches=[
            [
                {
                    "id": "cmd-lan-master",
                    "type": "SYNC_PREPARE",
                    "sessionId": "session-lan",
                    "payload": {
                        "session_id": "session-lan",
                        "start_at_ms": int(time.time() * 1000) + 500,
                        "duration_ms": 10000,
                        "master_device_id": "device-local",
                        "target_device_id": "device-local",
                        "sync_config": {"lan": {"enabled": True}},
                        "media": {"local_path": str(media_file)},
                    },
                }
            ]
        ],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.0,
            "health_score": 1.0,
            "throttled": False,
        },
    )

    fake_lan = FakeLanSync()
    controller = VideowallController(
        sync_manager=manager,
        state_machine=SyncStateMachine(),
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
        lan_sync=fake_lan,
    )

    controller.tick()

    assert controller._lan_mode == "master"
    assert len(fake_lan.started_master) == 1
    assert fake_lan.started_master[0]["master_device_id"] == "device-local"


def test_runtime_correction_prefers_lan_target_phase_for_follower():
    manager = DummySyncManager(
        command_batches=[],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.0,
            "health_score": 1.0,
            "throttled": False,
        },
    )

    fake_lan = FakeLanSync()
    fake_lan.next_target_phase = 280.0
    fake_lan.next_age_ms = 40

    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-follow",
            start_at_ms=0,
            duration_ms=10_000,
            local_path="/tmp/video.mp4",
            master_device_id="device-master",
            device_id="device-local",
        )
    )
    machine.transition("PRELOADING")
    machine.transition("READY")
    machine.transition("WARMING_UP")
    machine.transition("PLAYING")

    controller = VideowallController(
        sync_manager=manager,
        state_machine=machine,
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
        set_playback_speed=lambda _speed: True,
        get_playback_time_ms=lambda: 300.0,
        lan_sync=fake_lan,
    )
    controller.lan_enabled = True
    controller.lan_sync.update_settings(enabled=True)
    controller._lan_mode = "follower"

    assert machine.context is not None
    controller._apply_runtime_correction(now_ms=10_000, context=machine.context)

    # Cloud target at now=10000/start=0 would be 0ms (drift ~=300ms),
    # but LAN target is 280ms, so sampled drift should stay near 20ms.
    assert controller._last_drift_ms is not None
    assert abs(controller._last_drift_ms - 20.0) < 0.001
    assert controller._lan_mode == "follower"


def test_runtime_correction_falls_back_to_cloud_when_lan_beacon_missing():
    manager = DummySyncManager(
        command_batches=[],
        clock_health={
            "healthy": True,
            "critical": False,
            "offset_ms": 1.0,
            "health_score": 1.0,
            "throttled": False,
        },
    )

    fake_lan = FakeLanSync()
    fake_lan.next_target_phase = None
    fake_lan.next_age_ms = 2500

    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-fallback",
            start_at_ms=0,
            duration_ms=10_000,
            local_path="/tmp/video.mp4",
            master_device_id="device-master",
            device_id="device-local",
        )
    )
    machine.transition("PRELOADING")
    machine.transition("READY")
    machine.transition("WARMING_UP")
    machine.transition("PLAYING")

    controller = VideowallController(
        sync_manager=manager,
        state_machine=machine,
        start_sync_playback=lambda _context: True,
        stop_playback=lambda: None,
        seek_to_phase_ms=lambda _phase_ms: True,
        set_pause=lambda _paused: True,
        is_playback_alive=lambda: True,
        set_playback_speed=lambda _speed: True,
        get_playback_time_ms=lambda: 300.0,
        lan_sync=fake_lan,
    )
    controller.lan_enabled = True
    controller.lan_sync.update_settings(enabled=True)
    controller._lan_mode = "follower"

    assert machine.context is not None
    controller._apply_runtime_correction(now_ms=10_000, context=machine.context)

    assert controller._lan_mode == "cloud_fallback"
