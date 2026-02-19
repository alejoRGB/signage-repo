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
    mocker.patch("subprocess.run", side_effect=[mock_chronyc, mock_throttled])

    health = manager.get_clock_sync_health(max_offset_ms=50.0)

    assert health["leap_status"] == "Normal"
    assert health["offset_ms"] == pytest.approx(0.33443, rel=1e-6)
    assert health["healthy"] is True
    assert health["critical"] is False
