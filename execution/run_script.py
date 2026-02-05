import sys
import os
from utils import run_command, get_project_root

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ["--help", "-h"]:
        print("Usage: python run_script.py <script_name> [args...]")
        sys.exit(0)

    script_name = sys.argv[1]
    args = sys.argv[2:]
    project_root = get_project_root()
    
    # Check if it's a PS1 script in the root or deployment_scripts
    ps1_path = os.path.join(project_root, script_name)
    if not os.path.exists(ps1_path):
        # Check standard locations if not found directly
        ps1_path = os.path.join(project_root, "deployment_scripts", script_name)
    
    if script_name.endswith(".ps1"):
        if os.path.exists(ps1_path):
            print(f"Executing PowerShell script: {ps1_path}")
            # Use PowerShell to run the script
            # Bypass execution policy to ensure it runs
            cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", ps1_path] + args
            sys.exit(run_command(cmd, cwd=project_root))
        else:
            print(f"Error: Script {script_name} not found.")
            sys.exit(1)
            
    else:
        # Fallback for other shell commands
        print(f"Executing command: {script_name} {' '.join(args)}")
        cmd = [script_name] + args
        sys.exit(run_command(cmd, cwd=project_root, shell=True))

if __name__ == "__main__":
    main()
