
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
            
            new_lines = []
            changed = False
            for line in lines:
                if "show_trash=" in line:
                    new_lines.append("show_trash=0\n")
                    changed = True
                elif "show_mounts=" in line:
                    new_lines.append("show_mounts=0\n")
                    changed = True
                elif "show_documents=" in line:
                    new_lines.append("show_documents=0\n")
                    changed = True
                else:
                    new_lines.append(line)
            
            if changed:
                with open(config_path, 'w') as f:
                    f.writelines(new_lines)
                print("[WALLPAPER] Config updated. Reloading pcmanfm...")
                # Reload pcmanfm to apply config changes
                subprocess.run(["pcmanfm", "--reconfigure"], env=env, check=False)
            else:
                print("[WALLPAPER] Icons already hidden or config clean.")
        except Exception as e:
            print(f"[WALLPAPER] Failed to update config: {e}")
    else:
        print(f"[WALLPAPER] Config file not found at {config_path}. Skipping icon hiding.")

if __name__ == "__main__":
    set_wallpaper()
