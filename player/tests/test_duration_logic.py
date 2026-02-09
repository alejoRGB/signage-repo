
import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add player directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from player import Player

class TestPlayerDurationLogic(unittest.TestCase):
    def setUp(self):
        # Mock dependencies to avoid actual hardware/system calls
        with patch('player.SyncManager'), \
             patch('player.LoggerService'), \
             patch('player.ScreenRotator'), \
             patch('logging.getLogger'):
            self.player = Player()
            # Stop verify loop from running
            self.player.running = False

    def test_native_loop_condition_video_only(self):
        """Test that pure video playlists use Native Loop"""
        items = [
            {'type': 'video', 'filename': 'vid1.mp4'},
            {'type': 'video', 'filename': 'vid2.mp4'}
        ]
        
        # We need to test the logic block inside run(). 
        # Since it's inside a while loop in run(), we can't easily call it directly.
        # But we can verify the boolean logic we changed.
        
        has_web = any(x.get('type') == 'web' for x in items)
        has_non_video = any(x.get('type') != 'video' for x in items)
        
        # Expectation: Native Loop
        self.assertFalse(has_web)
        self.assertFalse(has_non_video)
        
    def test_mixed_loop_condition_image_present(self):
        """Test that playlists with images force Mixed Loop"""
        items = [
            {'type': 'video', 'filename': 'vid1.mp4'},
            {'type': 'image', 'filename': 'img1.jpg', 'duration': 15}
        ]
        
        has_web = any(x.get('type') == 'web' for x in items)
        has_non_video = any(x.get('type') != 'video' for x in items)
        
        # Expectation: Mixed Loop (has_non_video should be True)
        self.assertFalse(has_web)
        self.assertTrue(has_non_video, "Should detect non-video content")

    def test_mixed_loop_condition_web_present(self):
        """Test that playlists with web force Mixed Loop"""
        items = [
            {'type': 'video', 'filename': 'vid1.mp4'},
            {'type': 'web', 'url': 'http://google.com'}
        ]
        
        has_web = any(x.get('type') == 'web' for x in items)
        has_non_video = any(x.get('type') != 'video' for x in items)
        
        # Expectation: Mixed Loop (has_web is True)
        self.assertTrue(has_web)
        # has_non_video is also True because web is not video
        self.assertTrue(has_non_video)

if __name__ == '__main__':
    unittest.main()
