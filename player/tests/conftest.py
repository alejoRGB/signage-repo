import sys
import os
import pytest
from unittest.mock import MagicMock

# Add player directory to sys.path so we can import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def mock_requests(mocker):
    return mocker.patch('requests.post')

@pytest.fixture
def mock_get(mocker):
    return mocker.patch('requests.get')
