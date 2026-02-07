import sys
import os
from utils import run_command, get_project_root

def main():
    if len(sys.argv) < 2:
        print("Usage: python web_ops.py <command> [args...]")
        print("Commands: dev, build, start, lint, test, db:migrate, db:studio")
        sys.exit(1)

    command = sys.argv[1]
    extra_args = sys.argv[2:]
    project_root = get_project_root()
    web_dir = os.path.join(project_root, "web")

    npm_cmd = ["npm", "run"]
    
    start_cmd = []

    if command == "dev":
        start_cmd = npm_cmd + ["dev"]
    elif command == "build":
        start_cmd = npm_cmd + ["build"]
    elif command == "start":
        start_cmd = npm_cmd + ["start"]
    elif command == "lint":
        start_cmd = npm_cmd + ["lint"]
    elif command == "test":
        # Default to all if just 'test' is passed, but package.json doesn't have 'test' script
        # So we'll run all of them sequentially or error out.
        # For now, let's default to unit tests (test:api) if no specific one is given
        print("Running all web tests...")
        run_command(npm_cmd + ["test:api"], cwd=web_dir, shell=True)
        run_command(npm_cmd + ["test:ui"], cwd=web_dir, shell=True)
        sys.exit(0)
    elif command in ["test:api", "test:ui", "test:e2e"]:
        start_cmd = npm_cmd + [command]
    elif command == "db:migrate":
        # Direct npx call for clarity or usage of package.json script
        start_cmd = ["npx", "prisma", "migrate", "dev"]
    elif command == "db:studio":
        start_cmd = ["npx", "prisma", "studio"]
    elif command == "db:seed":
        start_cmd = ["npx", "prisma", "db", "seed"]
    else:
        print(f"Unknown command or custom script: {command}")
        # Allow pass-through
        start_cmd = ["npm", "run", command]

    full_cmd = start_cmd + extra_args
    print(f"Executing Web Command: {' '.join(full_cmd)}")
    sys.exit(run_command(full_cmd, cwd=web_dir, shell=True))

if __name__ == "__main__":
    main()
