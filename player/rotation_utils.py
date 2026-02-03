import os
import subprocess
import logging
import re

class ScreenRotator:
    def __init__(self):
        self.current_orientation = "landscape"
        self.method = self._detect_method()
        
    def _detect_method(self):
        """Detect if we are on Wayland (Pi 5 / Bookworm) or X11"""
        # 1. Check Env Vars
        session_type = os.environ.get("XDG_SESSION_TYPE", "").lower()
        wayland_display = os.environ.get("WAYLAND_DISPLAY", "")
        
        if "wayland" in session_type or wayland_display:
            logging.info("[ROTATOR] Detected Wayland environment variable.")
            return "wayland"
            
        # 2. Check for Wayfire process
        try:
            res = subprocess.run(["pgrep", "-x", "wayfire"], capture_output=True)
            if res.returncode == 0:
                logging.info("[ROTATOR] Detected Wayfire process. Assuming Wayland.")
                return "wayland"
        except:
            pass
            
        logging.info("[ROTATOR] Defaulting to X11.")
        return "x11"

    def rotate(self, orientation):
        """
        Rotate screen to 'landscape', 'portrait' (left), or 'portrait-270' (right).
        """
        if orientation == self.current_orientation:
            return
            
        logging.info(f"[ROTATOR] Changing orientation: {self.current_orientation} -> {orientation}")
        
        success = False
        try:
            # Primary Method
            if self.method == "wayland":
                success = self._rotate_wayland(orientation)
            else:
                success = self._rotate_x11(orientation)
                
            # Fallback for X11 BadMatch (which often means It's actually XWayland)
            if not success and self.method == "x11":
                logging.warning("[ROTATOR] X11 method failed. Trying Wayland method as fallback...")
                success = self._rotate_wayland(orientation)
                if success:
                    logging.info("[ROTATOR] Fallback to Wayland (wlr-randr) SUCCESSFUL!")
                    self.method = "wayland" # Remember this for next time

            if success:
                self.current_orientation = orientation
            else:
                logging.error("[ROTATOR] Rotation command reported failure.")
                
        except Exception as e:
            logging.error(f"[ROTATOR] Rotation logic crash: {e}")

    def _get_connected_outputs_x11(self):
        """Parse xrandr to find connected outputs"""
        outputs = []
        try:
            # Run xrandr
            res = subprocess.run(["xrandr"], capture_output=True, text=True)
            if res.returncode != 0:
                logging.error(f"[ROTATOR] xrandr failed: {res.stderr}")
                return ["HDMI-1", "HDMI-0", "default"] # Fallback

            # Look for lines like "HDMI-1 connected..."
            for line in res.stdout.splitlines():
                if " connected" in line:
                    parts = line.split(" ")
                    outputs.append(parts[0])
            
            if not outputs:
                logging.warning("[ROTATOR] No connected outputs found via xrandr. Using fallback.")
                return ["HDMI-1", "HDMI-0"]
                
            logging.info(f"[ROTATOR] Detected X11 Outputs: {outputs}")
            return outputs
        except Exception as e:
            logging.error(f"[ROTATOR] Error detecting X11 outputs: {e}")
            return ["HDMI-1", "HDMI-0"]

    def _rotate_wayland(self, orientation):
        transform_map = {
            "landscape": "normal",
            "portrait": "90",
            "portrait-270": "270" 
        }
        val = transform_map.get(orientation, "normal")
        
        # Prepare Environment for Wayland interaction
        # Systemd services often lack these variables
        env = os.environ.copy()
        
        # 1. Fix XDG_RUNTIME_DIR
        if "XDG_RUNTIME_DIR" not in env:
            uid = os.getuid()
            candidate = f"/run/user/{uid}"
            if os.path.exists(candidate):
                env["XDG_RUNTIME_DIR"] = candidate
                logging.info(f"[ROTATOR] Auto-set XDG_RUNTIME_DIR to {candidate}")
            else:
                logging.warning(f"[ROTATOR] Could not find XDG runtime dir at {candidate}")

        # 2. Fix WAYLAND_DISPLAY (Brute-force)
        # We don't know if it's wayland-0, wayland-1, etc.
        # We will try a few likely candidates if not set.
        candidate_sockets = ["wayland-1", "wayland-0", "wayland-2"]
        if "WAYLAND_DISPLAY" in env:
            candidate_sockets = [env["WAYLAND_DISPLAY"]] + candidate_sockets

        # Simple implementation: Try predefined list or "wlr-randr" listing if needed.
        outputs = ["HDMI-A-1", "HDMI-1", "HDMI-A-2", "HDMI-2"]
        
        transform_cmd_args = ["wlr-randr", "--transform", val]
        # We need to target specific outputs, but wlr-randr might fail if we target a non-existent one.
        # Safer strategy: List outputs first? No, let's just try to rotate known outputs on valid sockets.
        
        success_final = False
        
        for socket in candidate_sockets:
            env["WAYLAND_DISPLAY"] = socket
            
            # Check if this socket allows connection by running a harmless command
            check = subprocess.run(["wlr-randr", "--help"], capture_output=True, env=env)
            # wait, help doesn't connect. We need to List.
            check = subprocess.run(["wlr-randr"], capture_output=True, text=True, env=env)
            
            if check.returncode != 0 and "failed to connect" in check.stderr:
                logging.debug(f"[ROTATOR] Socket {socket} failed to connect.")
                continue
                
            logging.info(f"[ROTATOR] Connected to Wayland via {socket}!")
            
            # Now try to rotate all potential outputs on this valid socket
            socket_success = False
            for out in outputs:
                cmd = ["wlr-randr", "--output", out, "--transform", val]
                logging.info(f"[ROTATOR] Running on {socket}: {' '.join(cmd)}")
                res = subprocess.run(cmd, capture_output=True, text=True, env=env)
                
                if res.returncode == 0:
                    logging.info(f"[ROTATOR] Success rotating {out} on {socket}")
                    socket_success = True
                else:
                    logging.warning(f"[ROTATOR] Failed {out} on {socket}: {res.stderr.strip()}")
            
            if socket_success:
                success_final = True
                break # We found the right socket and applied rotation
                
        return success_final

    def _rotate_x11(self, orientation):
        rotate_map = {
            "landscape": "normal",
            "portrait": "left",
            "portrait-270": "right"
        }
        val = rotate_map.get(orientation, "normal")
        
        outputs = self._get_connected_outputs_x11()
        
        success_any = False
        for out in outputs:
            cmd = ["xrandr", "--output", out, "--rotate", val]
            logging.info(f"[ROTATOR] Running: {' '.join(cmd)}")
            res = subprocess.run(cmd, capture_output=True, text=True)
            
            if res.returncode == 0:
                success_any = True
            else:
                logging.error(f"[ROTATOR] Output {out} failed: {res.stderr.strip()}")
                
        return success_any
