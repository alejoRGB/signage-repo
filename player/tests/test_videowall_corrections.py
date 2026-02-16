from videowall_drift import decide_correction


def test_deadband_returns_no_correction():
    decision = decide_correction(
        drift_ms=10,
        target_phase_ms=5000,
        in_warmup=False,
    )
    assert decision.action == "none"
    assert decision.target_speed == 1.0


def test_soft_correction_returns_speed_adjustment():
    decision = decide_correction(
        drift_ms=120,
        target_phase_ms=5000,
        in_warmup=False,
    )
    assert decision.action == "soft"
    assert decision.seek_to_ms is None
    assert 0.99 <= decision.target_speed <= 1.01


def test_hard_correction_when_drift_above_threshold():
    decision = decide_correction(
        drift_ms=700,
        target_phase_ms=5123,
        in_warmup=False,
    )
    assert decision.action == "hard"
    assert decision.seek_to_ms is not None
    assert decision.target_speed == 1.0


def test_warmup_uses_lower_hard_threshold():
    decision = decide_correction(
        drift_ms=320,
        target_phase_ms=2000,
        in_warmup=True,
    )
    assert decision.action == "hard"
