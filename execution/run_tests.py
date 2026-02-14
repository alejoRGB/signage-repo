import os
import sys

from utils import get_project_root, run_command


def main():
    if len(sys.argv) < 2:
        print("Usage: python run_tests.py <scope> [args...]")
        print("Scopes: all, unit, e2e, qa")
        sys.exit(1)

    scope = sys.argv[1]
    extra_args = sys.argv[2:]
    project_root = get_project_root()
    qa_dir = os.path.join(project_root, "qa_automation")

    cmds = []

    if scope == "unit":
        cmds.append(("Web Unit (API)", ["python", "execution/web_ops.py", "test:api"], project_root))
        cmds.append(("Web Unit (UI)", ["python", "execution/web_ops.py", "test:ui"], project_root))
    elif scope == "e2e":
        cmds.append(("Web E2E", ["python", "execution/web_ops.py", "test:e2e"], project_root))
    elif scope == "qa":
        cmds.append(("QA Suite", ["npx", "playwright", "test"], qa_dir))
    elif scope == "all":
        cmds.append(("Web Unit (API)", ["python", "execution/web_ops.py", "test:api"], project_root))
        cmds.append(("Web Unit (UI)", ["python", "execution/web_ops.py", "test:ui"], project_root))
        cmds.append(("Web E2E", ["python", "execution/web_ops.py", "test:e2e"], project_root))
        cmds.append(("QA Suite", ["npx", "playwright", "test"], qa_dir))
    else:
        print(f"Unknown scope: {scope}")
        sys.exit(1)

    failed = False
    for name, cmd, cwd in cmds:
        full_cmd = cmd + extra_args
        print(f"\n--- Running {name} ---")
        print(f"Command: {' '.join(full_cmd)}")

        exit_code = run_command(full_cmd, cwd=cwd, shell=True)
        if exit_code != 0:
            print(f"[FAIL] {name} FAILED with exit code {exit_code}")
            failed = True
        else:
            print(f"[PASS] {name} PASSED")

    if failed:
        sys.exit(1)

    print("\nAll tests passed successfully!")
    sys.exit(0)


if __name__ == "__main__":
    main()
