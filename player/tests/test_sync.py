import os
import json
import pytest
from sync import SyncManager

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
