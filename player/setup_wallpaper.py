
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

    # 3. Hide Desktop Icons (Recursive Search)
    print("[WALLPAPER] Hiding desktop icons (Searching all profiles)...")
    base_config_dir = os.path.join(home, ".config/pcmanfm")
    
    configs_found = []
    if os.path.exists(base_config_dir):
        for root, dirs, files in os.walk(base_config_dir):
            for file in files:
                if file.startswith("desktop-items") and file.endswith(".conf"):
                    configs_found.append(os.path.join(root, file))
    
    if not configs_found:
        print("[WALLPAPER] No desktop-items config files found! Creating default for LXDE-pi...")
        # Create default path if missing
        default_dir = os.path.join(base_config_dir, "LXDE-pi")
        os.makedirs(default_dir, exist_ok=True)
        configs_found.append(os.path.join(default_dir, "desktop-items-0.conf"))

    for config_path in configs_found:
        print(f"[WALLPAPER] Updating {config_path}...")
        try:
            lines = []
            if os.path.exists(config_path):
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
                "wallpaper_mode": "stretch",
                "wallpaper": bg_path,  # FORCE wallpaper path directly in config
                "desktop_bg": "#000000",
                "desktop_fg": "#ffffff",
                "desktop_shadow": "#000000",
            }
            
            new_lines = []
            header_kept = False
            for line in lines:
                if line.strip().startswith("[") or line.strip().startswith("#"):
                    new_lines.append(line)
                    header_kept = True
                elif "=" in line:
                    key = line.split("=")[0].strip()
                    if key in updates:
                        continue # Skip existing keys we want to overwrite
                    else:
                        new_lines.append(line)
            
            if not header_kept:
                new_lines.insert(0, "[*]\n")

            for key, val in updates.items():
                new_lines.append(f"{key}={val}\n")

            with open(config_path, 'w') as f:
                f.writelines(new_lines)
                
        except Exception as e:
            print(f"[WALLPAPER] Failed to update {config_path}: {e}")

    print("[WALLPAPER] Reloading pcmanfm...")
    subprocess.run(["pcmanfm", "--reconfigure"], env=env, check=False)

if __name__ == "__main__":
    set_wallpaper()
