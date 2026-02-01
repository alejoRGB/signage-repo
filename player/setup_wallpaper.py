
import os
import subprocess
from PIL import Image

def set_wallpaper():
    home = os.path.expanduser("~")
    app_dir = os.path.join(home, "signage-player")
    bg_path = os.path.join(app_dir, "black_bg.png")

    # 1. Generate Black Image
    print("[WALLPAPER] Generating black background...")
    img = Image.new('RGB', (1920, 1080), color='black')
    img.save(bg_path)
    print(f"[WALLPAPER] Saved to {bg_path}")

    # 2. Apply Wallpaper using pcmanfm
    print("[WALLPAPER] Applying wallpaper...")
    try:
        # DISPLAY=:0 is needed if running from SSH
        env = os.environ.copy()
        env["DISPLAY"] = ":0"
        subprocess.run(["pcmanfm", "--set-wallpaper", bg_path], env=env, check=True)
        # Also set wallpaper mode to 'stretch' or 'fit' just in case
        subprocess.run(["pcmanfm", "--wallpaper-mode", "stretch"], env=env, check=False)
        print("[WALLPAPER] Applied successfully.")
    except Exception as e:
        print(f"[WALLPAPER] Failed to set wallpaper via pcmanfm: {e}")

    # 3. Hide Desktop Icons
    print("[WALLPAPER] Hiding desktop icons...")
    config_path = os.path.join(home, ".config/pcmanfm/LXDE-pi/desktop-items-0.conf")
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                lines = f.readlines()
            
            # Parse existing config
            config_dict = {}
            for line in lines:
                if "=" in line:
                    key, val = line.strip().split("=", 1)
                    config_dict[key] = val

            # Force specific values
            updates = {
                "show_trash": "0",
                "show_mounts": "0",
                "show_documents": "0",
                "wallpaper_mode": "stretch" # Ensure stretch
            }
            
            # Reconstruct file content
            new_lines = []
            # Keep header/comments
            header_kept = False
            for line in lines:
                if line.strip().startswith("[") or line.strip().startswith("#"):
                    new_lines.append(line)
                    header_kept = True
                elif "=" in line:
                    key = line.split("=")[0].strip()
                    if key in updates:
                        continue # Skip, we will add later
                    else:
                        new_lines.append(line) # Keep other settings
            
            # Ensure header if missing (rare)
            if not header_kept:
                new_lines.insert(0, "[*]\n")

            # Append forced updates
            for key, val in updates.items():
                new_lines.append(f"{key}={val}\n")

            with open(config_path, 'w') as f:
                f.writelines(new_lines)
                
            print("[WALLPAPER] Config updated (forced). Reloading pcmanfm...")
            # Reload pcmanfm to apply config changes
            subprocess.run(["pcmanfm", "--reconfigure"], env=env, check=False)
        except Exception as e:
            print(f"[WALLPAPER] Failed to update config: {e}")
    else:
        print(f"[WALLPAPER] Config file not found at {config_path}. Skipping icon hiding.")

if __name__ == "__main__":
    set_wallpaper()
