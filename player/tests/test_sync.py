import os
import json
import pytest
from sync import SyncManager
from unittest.mock import Mock

def test_load_config(tmp_path):
    """Test loading configuration from a file"""
    config_file = tmp_path / "config.json"
    config_data = {
        "server_url": "http://test-server.com",
        "device_token": "test-token"
    }
    config_file.write_text(json.dumps(config_data))
    
    # Mock os.path.dirname inside SyncManager indirectly by ensuring folders exist
    # Actually SyncManager uses standard open, so passing absolute path works.
    # It attempts to create media dir relative to config.
    media_dir = tmp_path / "media"
    
    manager = SyncManager(config_path=str(config_file))
    
    assert manager.server_url == "http://test-server.com"
    assert manager.device_token == "test-token"
    assert os.path.exists(str(media_dir))

def test_register_success(tmp_path, mock_requests):
    """Test successful device registration"""
    # Setup Config
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps({"server_url": "http://test.com"}))
    
    manager = SyncManager(config_path=str(config_file))
    
    # Mock Response
    mock_response = mock_requests.return_value
    mock_response.status_code = 200
    mock_response.json.return_value = {"pairing_code": "123456", "device_token": "new-token"}
    
    result = manager.register()
    
    assert result["pairing_code"] == "123456"
    assert result["device_token"] == "new-token"
    mock_requests.assert_called_once()


def test_poll_status_uses_device_token_header(tmp_path, mock_get):
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps({"server_url": "http://test.com"}))
    manager = SyncManager(config_path=str(config_file))

    mock_response = mock_get.return_value
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "paired"}

    status = manager.poll_status("token-abc")

    assert status == "paired"
    mock_get.assert_called_once_with(
        "http://test.com/api/device/status",
        headers={"X-Device-Token": "token-abc"},
        timeout=5,
    )


def test_clock_sync_health_parses_leap_status_and_marks_healthy(tmp_path, mocker):
    """Clock health should be healthy when leap status is Normal and offset is within threshold."""
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps({"server_url": "http://test.com"}))
    manager = SyncManager(config_path=str(config_file))

    chronyc_output = (
        "Reference ID    : 12345678 (pool.example)\n"
        "System time     : 0.000470897 seconds fast of NTP time\n"
        "Last offset     : +0.000334430 seconds\n"
        "RMS offset      : 0.000403282 seconds\n"
        "Leap status     : Normal\n"
    )

    mock_chronyc = Mock(returncode=0, stdout=chronyc_output, stderr="")
    mock_throttled = Mock(returncode=0, stdout="throttled=0x0\n", stderr="")
    mock_temp = Mock(returncode=0, stdout="temp=61.4'C\n", stderr="")
    mocker.patch("subprocess.run", side_effect=[mock_chronyc, mock_throttled, mock_temp])

    health = manager.get_clock_sync_health(max_offset_ms=50.0)

    assert health["leap_status"] == "Normal"
    assert health["offset_ms"] == pytest.approx(0.33443, rel=1e-6)
    assert health["cpu_temp"] == pytest.approx(61.4, rel=1e-6)
    assert health["healthy"] is True
    assert health["critical"] is False


def test_get_current_device_id_from_cached_playlist(tmp_path):
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps({"server_url": "http://test.com", "device_token": "token"}))

    manager = SyncManager(config_path=str(config_file))
    manager.device_id = None

    cache_payload = {"device_id": "device-cache-1"}
    (tmp_path / "playlist.json").write_text(json.dumps(cache_payload))

    assert manager.get_current_device_id() == "device-cache-1"


def test_ensure_sync_media_available_waits_without_read_timeout(tmp_path, mocker):
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps({
        "server_url": "http://test.com",
        "device_token": "token-1",
    }))
    manager = SyncManager(config_path=str(config_file))

    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.iter_content.return_value = [b"abc", b"def"]
    mock_get = mocker.patch("requests.get", return_value=mock_response)

    resolved = manager.ensure_sync_media_available("media-1", "video-new.mp4")

    assert resolved is not None
    assert resolved.endswith("video-new.mp4")
    assert os.path.exists(resolved)
    with open(resolved, "rb") as fh:
        assert fh.read() == b"abcdef"

    mock_get.assert_called_once_with(
        "http://test.com/api/media/download/media-1",
        stream=True,
        headers={"X-Device-Token": "token-1"},
        timeout=(manager.sync_media_download_connect_timeout_s, None),
    )


def test_download_media_rejects_path_traversal_filename(tmp_path, mocker):
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps({"server_url": "http://test.com"}))
    manager = SyncManager(config_path=str(config_file))

    mock_get = mocker.patch("requests.get")

    ok = manager.download_media({
        "filename": "../escape.mp4",
        "url": "http://test.com/file.mp4",
        "type": "video",
    })

    assert ok is False
    mock_get.assert_not_called()
    assert not (tmp_path / "escape.mp4").exists()


def test_ensure_sync_media_available_rejects_absolute_path_outside_media_dir(tmp_path):
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps({
        "server_url": "http://test.com",
        "device_token": "token-1",
    }))
    manager = SyncManager(config_path=str(config_file))

    external_file = tmp_path / "outside.mp4"
    external_file.write_bytes(b"evil")

    resolved = manager.ensure_sync_media_available("media-1", str(external_file))
    assert resolved is None
