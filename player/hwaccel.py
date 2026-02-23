import glob
import logging
import os
import subprocess
from dataclasses import dataclass
from typing import Callable, List, Optional, Sequence, Set


DEFAULT_HWDEC_FALLBACK = "auto-safe"
HWDEC_PRIORITY = (
    "v4l2m2m-copy",
    "v4l2m2m",
    "auto-copy-safe",
    "auto-safe",
    "auto",
    "no",
)


@dataclass
class MpvHwAccelProfile:
    selected_hwdec: str
    supported_hwdecs: List[str]
    has_video_nodes: bool
    has_render_node: bool
    video_nodes: List[str]
    render_nodes: List[str]
    reason: str
    error: Optional[str] = None
    probe_source: str = "runtime"

    def mpv_flags(self) -> List[str]:
        # gpu-context=auto is a stable default on Raspberry Pi builds.
        return ["--gpu-context=auto", f"--hwdec={self.selected_hwdec}"]


def parse_mpv_hwdec_help(help_text: str) -> Set[str]:
    """Parse `mpv --hwdec=help` and return the supported hwdec values."""
    values: Set[str] = set()
    for raw_line in (help_text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.lower().startswith("valid values"):
            continue
        token = line.split()[0]
        if token.startswith("("):
            continue
        values.add(token)
    return values


def select_hwdec_backend(supported_hwdecs: Set[str], has_video_nodes: bool) -> str:
    """Choose the best hwdec backend based on actual runtime capabilities."""
    if has_video_nodes:
        for candidate in HWDEC_PRIORITY:
            if candidate in supported_hwdecs:
                return candidate
    for candidate in ("auto-copy-safe", "auto-safe", "auto", "no"):
        if candidate in supported_hwdecs:
            return candidate
    return DEFAULT_HWDEC_FALLBACK


def probe_and_select_mpv_hwaccel(
    mpv_bin: str = "mpv",
    run: Callable[..., subprocess.CompletedProcess] = subprocess.run,
) -> MpvHwAccelProfile:
    """
    Probe mpv/device capabilities and select a model-agnostic hwdec backend.

    Selection intentionally depends on runtime capabilities (mpv build + device access),
    not Raspberry Pi model strings.
    """
    video_nodes = _readable_writable_nodes(glob.glob("/dev/video*"))
    render_nodes = _readable_writable_nodes(glob.glob("/dev/dri/renderD*"))
    has_video_nodes = bool(video_nodes)
    has_render_node = bool(render_nodes)

    help_text = ""
    error: Optional[str] = None
    try:
        completed = run(
            [mpv_bin, "--hwdec=help"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        help_text = (completed.stdout or "") + ("\n" + completed.stderr if completed.stderr else "")
        if completed.returncode not in (0, None) and not help_text.strip():
            error = f"mpv --hwdec=help exit={completed.returncode}"
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"

    supported_hwdecs = parse_mpv_hwdec_help(help_text)
    selected = select_hwdec_backend(supported_hwdecs, has_video_nodes)

    if error and not supported_hwdecs:
        reason = "mpv_probe_failed_fallback"
    elif has_video_nodes and ("v4l2m2m-copy" in supported_hwdecs or "v4l2m2m" in supported_hwdecs):
        reason = "v4l2_mem2mem_available"
    elif not has_video_nodes:
        reason = "no_accessible_v4l2_nodes"
    else:
        reason = "auto_safe_fallback"

    profile = MpvHwAccelProfile(
        selected_hwdec=selected,
        supported_hwdecs=sorted(supported_hwdecs),
        has_video_nodes=has_video_nodes,
        has_render_node=has_render_node,
        video_nodes=video_nodes,
        render_nodes=render_nodes,
        reason=reason,
        error=error,
    )

    _log_profile(profile)
    return profile


def _readable_writable_nodes(nodes: Sequence[str]) -> List[str]:
    result: List[str] = []
    for node in sorted(nodes):
        if os.path.exists(node) and os.access(node, os.R_OK | os.W_OK):
            result.append(node)
    return result


def _log_profile(profile: MpvHwAccelProfile) -> None:
    logging.info(
        "[HWACCEL] selected=%s reason=%s video_nodes=%s render_node=%s supported=%s",
        profile.selected_hwdec,
        profile.reason,
        "yes" if profile.has_video_nodes else "no",
        "yes" if profile.has_render_node else "no",
        ",".join(profile.supported_hwdecs) if profile.supported_hwdecs else "unknown",
    )
    if profile.error:
        logging.warning("[HWACCEL] probe error: %s", profile.error)
