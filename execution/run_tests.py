import os
import sys
from glob import glob

from utils import get_project_root, run_command


def _to_rel(path, root):
    return os.path.relpath(path, root).replace("\\", "/")


def discover_sync_web_api_tests(web_dir):
    tests_dir = os.path.join(web_dir, "__tests__", "api")
    candidates = glob(os.path.join(tests_dir, "*.test.ts"))
    always_include = {
        "device-commands.test.ts",
        "device-heartbeat-sync.test.ts",
        "device-logs-sync.test.ts",
    }

    selected = []
    for file_path in candidates:
        name = os.path.basename(file_path)
        if name.startswith("sync-") or name in always_include:
            selected.append(_to_rel(file_path, web_dir))

    return sorted(selected)


def discover_sync_web_component_tests(web_dir):
    tests_dir = os.path.join(web_dir, "__tests__", "components")
    candidates = glob(os.path.join(tests_dir, "*.test.tsx"))

    selected = []
    for file_path in candidates:
        name = os.path.basename(file_path)
        if name.startswith("Sync"):
            selected.append(_to_rel(file_path, web_dir))

    return sorted(selected)


def discover_sync_player_tests(player_dir):
    tests_dir = os.path.join(player_dir, "tests")
    candidates = glob(os.path.join(tests_dir, "test_*.py"))

    selected = []
    for file_path in candidates:
        name = os.path.basename(file_path)
        if "sync" in name or "videowall" in name or "state_machine" in name:
            selected.append(_to_rel(file_path, player_dir))

    return sorted(selected)


def main():
    if len(sys.argv) < 2:
        print("Usage: python run_tests.py <scope> [args...]")
        print("Scopes: all, unit, e2e, qa, sync")
        sys.exit(1)

    scope = sys.argv[1]
    extra_args = sys.argv[2:]
    project_root = get_project_root()
    web_dir = os.path.join(project_root, "web")
    player_dir = os.path.join(project_root, "player")
    qa_dir = os.path.join(project_root, "qa_automation")

    cmds = []

    if scope == "unit":
        cmds.append(("Web Unit (API)", ["python", "execution/web_ops.py", "test:api"], project_root))
        cmds.append(("Web Unit (UI)", ["python", "execution/web_ops.py", "test:ui"], project_root))
    elif scope == "e2e":
        cmds.append(("Web E2E", ["python", "execution/web_ops.py", "test:e2e"], project_root))
    elif scope == "qa":
        cmds.append(("QA Suite", ["npx", "playwright", "test"], qa_dir))
    elif scope == "sync":
        web_api_tests = discover_sync_web_api_tests(web_dir)
        web_component_tests = discover_sync_web_component_tests(web_dir)
        player_tests = discover_sync_player_tests(player_dir)

        if web_api_tests:
            cmds.append(("Web Sync (API)", ["npx", "jest", *web_api_tests], web_dir))
        if web_component_tests:
            cmds.append(("Web Sync (UI)", ["npx", "vitest", "run", *web_component_tests], web_dir))
        if player_tests:
            cmds.append(("Player Sync", [sys.executable, "-m", "pytest", *player_tests], player_dir))

        if not cmds:
            print("No sync tests discovered.")
            sys.exit(1)
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
