from videowall_drift import (
    compute_target_phase_ms,
    compute_wrapped_drift_ms,
    round_to_frame,
)


def test_compute_target_phase_before_start_returns_none():
    assert compute_target_phase_ms(now_ms=1000, start_at_ms=2000, duration_ms=10000) is None


def test_compute_target_phase_wraps_duration():
    assert compute_target_phase_ms(now_ms=12500, start_at_ms=1000, duration_ms=10000) == 1500


def test_compute_wrapped_drift_handles_wraparound_positive():
    drift = compute_wrapped_drift_ms(actual_phase_ms=100, target_phase_ms=9900, duration_ms=10000)
    assert drift == 200


def test_compute_wrapped_drift_handles_wraparound_negative():
    drift = compute_wrapped_drift_ms(actual_phase_ms=9900, target_phase_ms=100, duration_ms=10000)
    assert drift == -200


def test_round_to_frame_60hz():
    # 16.6667ms per frame at 60Hz
    assert round_to_frame(33.0, frame_ms=16.6667) in (33, 34)
