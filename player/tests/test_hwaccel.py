from types import SimpleNamespace

import hwaccel


def test_parse_mpv_hwdec_help_deduplicates_values():
    output = """
Valid values (with alternative full names):
  v4l2m2m (h264_v4l2m2m-v4l2m2m)
  v4l2m2m (hevc_v4l2m2m-v4l2m2m)
  v4l2m2m-copy (h264_v4l2m2m-v4l2m2m-copy)
  auto (yes '')
  auto-safe
  no
"""
    values = hwaccel.parse_mpv_hwdec_help(output)
    assert "v4l2m2m" in values
    assert "v4l2m2m-copy" in values
    assert "auto-safe" in values
    assert "no" in values


def test_select_hwdec_prefers_v4l2m2m_copy_when_video_nodes_available():
    selected = hwaccel.select_hwdec_backend(
        {"auto-safe", "v4l2m2m", "v4l2m2m-copy", "no"},
        has_video_nodes=True,
    )
    assert selected == "v4l2m2m-copy"


def test_select_hwdec_falls_back_to_auto_safe_without_video_nodes():
    selected = hwaccel.select_hwdec_backend(
        {"auto-copy-safe", "auto-safe", "v4l2m2m-copy", "no"},
        has_video_nodes=False,
    )
    assert selected == "auto-copy-safe"


def test_probe_and_select_handles_mpv_probe_failure(monkeypatch):
    monkeypatch.setattr(hwaccel.glob, "glob", lambda pattern: [])
    monkeypatch.setattr(hwaccel.os.path, "exists", lambda path: False)
    monkeypatch.setattr(hwaccel.os, "access", lambda path, mode: False)

    def fake_run(*args, **kwargs):
        raise FileNotFoundError("mpv not found")

    profile = hwaccel.probe_and_select_mpv_hwaccel(run=fake_run)

    assert profile.selected_hwdec == "auto-safe"
    assert profile.has_video_nodes is False
    assert profile.supported_hwdecs == []
    assert profile.error and "FileNotFoundError" in profile.error
    assert profile.mpv_flags() == ["--gpu-context=auto", "--hwdec=auto-safe"]


def test_probe_and_select_uses_v4l2_when_mpv_supports_it(monkeypatch):
    def fake_glob(pattern):
        if pattern == "/dev/video*":
            return ["/dev/video10"]
        if pattern == "/dev/dri/renderD*":
            return ["/dev/dri/renderD128"]
        return []

    monkeypatch.setattr(hwaccel.glob, "glob", fake_glob)
    monkeypatch.setattr(hwaccel.os.path, "exists", lambda path: True)
    monkeypatch.setattr(hwaccel.os, "access", lambda path, mode: True)

    def fake_run(*args, **kwargs):
        return SimpleNamespace(
            returncode=0,
            stdout="  v4l2m2m-copy (h264_v4l2m2m-v4l2m2m-copy)\n  auto-safe\n  no\n",
            stderr="",
        )

    profile = hwaccel.probe_and_select_mpv_hwaccel(run=fake_run)

    assert profile.selected_hwdec == "v4l2m2m-copy"
    assert profile.has_video_nodes is True
    assert profile.has_render_node is True
    assert profile.reason == "v4l2_mem2mem_available"
