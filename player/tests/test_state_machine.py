from state_machine import (
    SYNC_STATE_ASSIGNED,
    SYNC_STATE_PLAYING,
    SYNC_STATE_PRELOADING,
    SYNC_STATE_READY,
    SYNC_STATE_WARMING_UP,
    SyncSessionContext,
    SyncStateMachine,
)


def test_state_machine_happy_path_transitions():
    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-1",
            start_at_ms=1000,
            duration_ms=10000,
            local_path="/tmp/video.mp4",
        )
    )

    assert machine.state == SYNC_STATE_ASSIGNED
    assert machine.transition(SYNC_STATE_PRELOADING)
    assert machine.transition(SYNC_STATE_READY)
    assert machine.transition(SYNC_STATE_WARMING_UP)
    assert machine.transition(SYNC_STATE_PLAYING)


def test_state_machine_invalid_transition_is_rejected():
    machine = SyncStateMachine()
    machine.activate(
        SyncSessionContext(
            session_id="session-2",
            start_at_ms=1000,
            duration_ms=10000,
            local_path="/tmp/video.mp4",
        )
    )

    assert machine.state == SYNC_STATE_ASSIGNED
    assert not machine.transition(SYNC_STATE_PLAYING)
    assert machine.state == SYNC_STATE_ASSIGNED
