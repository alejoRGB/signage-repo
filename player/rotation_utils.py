import os
import subprocess
import logging

class ScreenRotator:
    def __init__(self):
        self.current_orientation = "landscape"
        self.method = self._detect_method()
        
    def _detect_method(self):
        """Detect if we are on Wayland (Pi 5) or X11"""
        # Simple check: Wayfire is the default compositor on Pi OS Bookworm (Wayland)
        # But we can also check XDG_SESSION_TYPE
        session_type = os.environ.get("XDG_SESSION_TYPE", "").lower()
        if "wayland" in session_type:
            return "wayland"
        return "x11"

    def rotate(self, orientation):
        """
        Rotate screen to 'landscape', 'portrait' (left), or 'portrait-270' (right).
        orientation: str from DB
        """
        if orientation == self.current_orientation:
            return
            
        logging.info(f"[ROTATOR] Changing orientation: {self.current_orientation} -> {orientation}")
        
        try:
            if self.method == "wayland":
                self._rotate_wayland(orientation)
            else:
                self._rotate_x11(orientation)
                
            self.current_orientation = orientation
        except Exception as e:
            logging.error(f"[ROTATOR] Rotation failed: {e}")

    def _rotate_wayland(self, orientation):
        # Using wlr-randr
        # HDMI-A-1 or HDMI-A-2 usually. We might need to detect outputs, but let's assume primary.
        # transform: normal, 90, 180, 270, etc.
        
        transform_map = {
            "landscape": "normal",
            "portrait": "90",      # 90 deg counter-clockwise usually? or clockwise?
                                   # wlr-randr "90" is usually 90 degrees counter-clockwise (Left)
            "portrait-270": "270"  # Right
        }
        
        val = transform_map.get(orientation, "normal")
        
        # We need to find the output name first? 
        # For simplicity, we can try to rotate *all* connected outputs or just guess HDMI-A-1
        # Better: run wlr-randr without args to find output name? 
        # Let's try a generic command targeting the active output if possible, 
        # or iterate common names.
        
        outputs = ["HDMI-A-1", "HDMI-1"]
        for out in outputs:
            cmd = ["wlr-randr", "--output", out, "--transform", val]
            subprocess.run(cmd, check=False)


    def _rotate_x11(self, orientation):
        # Using xrandr
        # rotate: normal, left, right, inverted
        
        rotate_map = {
            "landscape": "normal",
            "portrait": "left",
            "portrait-270": "right"
        }
        
        val = rotate_map.get(orientation, "normal")
        
        outputs = ["HDMI-1", "HDMI-0", "default"]
        for out in outputs:
             cmd = ["xrandr", "--output", out, "--rotate", val]
             subprocess.run(cmd, check=False)
