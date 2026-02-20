from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional


CorrectionAction = Literal["none", "soft", "hard"]


@dataclass
class CorrectionDecision:
    action: CorrectionAction
    target_speed: float
    seek_to_ms: Optional[int] = None


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def round_to_frame(phase_ms: float, frame_ms: float = 16.6667) -> int:
    if frame_ms <= 0:
        return int(round(phase_ms))
    return int(round(phase_ms / frame_ms) * frame_ms)


def compute_target_phase_ms(now_ms: int, start_at_ms: int, duration_ms: int) -> Optional[int]:
    if duration_ms <= 0:
        return None
    if now_ms < start_at_ms:
        return None
    return int((now_ms - start_at_ms) % duration_ms)


def compute_wrapped_drift_ms(actual_phase_ms: float, target_phase_ms: float, duration_ms: int) -> float:
    if duration_ms <= 0:
        return 0.0
    raw = actual_phase_ms - target_phase_ms
    half = duration_ms / 2.0
    if raw > half:
        raw -= duration_ms
    elif raw < -half:
        raw += duration_ms
    return raw


def decide_correction(
    drift_ms: float,
    target_phase_ms: int,
    *,
    in_warmup: bool,
    deadband_ms: int = 25,
    hard_resync_threshold_ms: int = 500,
    soft_min_ms: int = 25,
    max_speed_delta_normal: float = 0.01,
    max_speed_delta_warmup: float = 0.03,
    k_base: float = 0.0003,
    frame_ms: float = 16.6667,
) -> CorrectionDecision:
    abs_drift = abs(drift_ms)
    hard_threshold = min(300, hard_resync_threshold_ms) if in_warmup else hard_resync_threshold_ms
    max_speed_delta = max_speed_delta_warmup if in_warmup else max_speed_delta_normal

    if abs_drift >= hard_threshold:
        return CorrectionDecision(
            action="hard",
            target_speed=1.0,
            seek_to_ms=round_to_frame(target_phase_ms, frame_ms=frame_ms),
        )

    if abs_drift < max(deadband_ms, soft_min_ms):
        return CorrectionDecision(action="none", target_speed=1.0)

    if abs_drift > 200:
        gain = k_base * 1.5
    elif abs_drift < 50:
        gain = k_base * 0.7
    else:
        gain = k_base

    speed_adjustment = -gain * drift_ms
    target_speed = 1.0 + clamp(speed_adjustment, -max_speed_delta, max_speed_delta)
    return CorrectionDecision(action="soft", target_speed=target_speed)
