import sys
import os
from utils import run_command, get_project_root



def parse_ssh_args(args):
    """
    Rudimentary arg parser for -PlayerIp and -PlayerUser
    """
    player_ip = None
    player_user = None
    
    for i, arg in enumerate(args):
        if arg == "-PlayerIp" and i + 1 < len(args):
            player_ip = args[i+1]
        elif arg == "-PlayerUser" and i + 1 < len(args):
            player_user = args[i+1]
            
    # Default fallback prompt if not provided? 
    # For now, let's assume they are provided or we prompt
    if not player_ip:
        player_ip = input("Enter Player IP: ")
    if not player_user:
        player_user = input("Enter Player User: ")
        
    return player_user, player_ip

def exec_remote_systemctl(action, args):
    user, ip = parse_ssh_args(args)
    cmd = ["ssh", f"{user}@{ip}", f"sudo systemctl {action} signage-player"]
    print(f"Executing remote {action} on {user}@{ip}...")
    # Using run_command which allows interaction (password prompts)
    return run_command(cmd)

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ["--help", "-h"]:
        print("Usage: python player_ops.py <command> [args...]")
        print("Commands: start, deploy, test, remote_start, remote_stop, remote_restart, remote_status")
        sys.exit(0)

    command = sys.argv[1]
    extra_args = sys.argv[2:]
    project_root = get_project_root()
    player_dir = os.path.join(project_root, "player")

    if command == "start":
        # Run the python player locally
        # Assuming main entry point is player.py
        cmd = ["python", "player.py"] + extra_args
        sys.exit(run_command(cmd, cwd=player_dir))

    elif command == "test":
        cmd = ["pytest"] + extra_args
        sys.exit(run_command(cmd, cwd=player_dir))

    elif command == "deploy":
        # Call the legacy deploy script
        # Check for deploy_player.ps1 in root or legacy folder
        legacy_script = os.path.join(project_root, "deploy.ps1")
        if os.path.exists(legacy_script):
             print(f"Delegating to legacy script: {legacy_script}")
             cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", legacy_script] + extra_args
             sys.exit(run_command(cmd, cwd=project_root))
        else:
            print("Error: deploy.ps1 not found in project root.")
            sys.exit(1)
            
    elif command in ["remote_start", "remote_stop", "remote_restart", "remote_status"]:
        action = command.replace("remote_", "")
        sys.exit(exec_remote_systemctl(action, extra_args))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
