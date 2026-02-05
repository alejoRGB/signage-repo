import sys
import os
from utils import run_command, get_project_root

def main():
    print("Verifying Execution Layer...")
    project_root = get_project_root()
    execution_dir = os.path.join(project_root, "execution")

    checks = [
        ("Web Ops Help", ["python", "web_ops.py", "--help"]),
        ("Player Ops Help", ["python", "player_ops.py", "--help"]),
        ("Run Script Help", ["python", "run_script.py", "--help"]),
    ]

    all_passed = True

    for name, cmd in checks:
        print(f"Checking: {name}")
        ret = run_command(cmd, cwd=execution_dir)
        if ret == 0:
            print(f"✅ {name} Passed")
        else:
            print(f"❌ {name} Failed")
            all_passed = False

    if all_passed:
        print("\nAll execution wrappers verify successfully.")
        sys.exit(0)
    else:
        print("\nSome checks failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
