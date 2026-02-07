import sys
import os
from utils import run_command, get_project_root

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_tests.py <scope> [args...]")
        print("Scopes: all, unit, e2e, qa")
        sys.exit(1)

    scope = sys.argv[1]
    extra_args = sys.argv[2:]
    project_root = get_project_root()
    web_dir = os.path.join(project_root, "web")
    qa_dir = os.path.join(project_root, "qa_automation")

    # Command mappings
    cmds = []
    
    if scope == "unit":
        # Run API and UI unit tests
        cmds.append(("Web Unit (API)", ["python", "execution/web_ops.py", "test:api"], project_root))
        cmds.append(("Web Unit (UI)", ["python", "execution/web_ops.py", "test:ui"], project_root))
    
    elif scope == "e2e":
        # Run Web E2E tests
        cmds.append(("Web E2E", ["python", "execution/web_ops.py", "test:e2e"], project_root))
        
    elif scope == "qa":
        # Run standalone QA automation suite
        # We use npx playwright test directly here
        cmds.append(("QA Suite", ["npx", "playwright", "test"], qa_dir))

    elif scope == "all":
        # Run everything
        cmds.append(("Web Unit (API)", ["python", "execution/web_ops.py", "test:api"], project_root))
        cmds.append(("Web Unit (UI)", ["python", "execution/web_ops.py", "test:ui"], project_root))
        cmds.append(("Web E2E", ["python", "execution/web_ops.py", "test:e2e"], project_root))
        cmds.append(("QA Suite", ["npx", "playwright", "test"], qa_dir))
    
    else:
        print(f"Unknown scope: {scope}")
        sys.exit(1)

    # Execution Loop
    failed = False
    for name, cmd, cwd in cmds:
        full_cmd = cmd + extra_args
        print(f"\n--- Running {name} ---")
        print(f"Command: {' '.join(full_cmd)}")
        
        exit_code = run_command(full_cmd, cwd=cwd, shell=True)
        
        if exit_code != 0:
            print(f"❌ {name} FAILED with exit code {exit_code}")
            failed = True
            # Optional: Decide whether to stop on first failure or continue.
            # For now, we continue to see all failures.
        else:
            print(f"✅ {name} PASSED")

    if failed:
        sys.exit(1)
    else:
        print("\n🎉 All tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()
