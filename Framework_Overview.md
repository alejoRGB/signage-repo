# Directive Orchestration Execution Framework

This project has been refactored to follow the 3-Layer Architecture.

## Architecture

### Layer 1: Directives (Standard Operating Procedures)
Located in `directives/`, these markdown files define the roles and "how-to" for different agents.
- **Coordinator**: `directives/agent_coordinator.md` (Route requests here)
- **Frontend**: `directives/agent_frontend.md`
- **Backend**: `directives/agent_backend.md`
- **Player**: `directives/agent_player.md`
- **QA**: `directives/agent_qa.md`

### Layer 2: Orchestration (The AI Agent)
The AI Agent (me) reads the directives and routes tasks. When you ask for a change, I load the appropriate directive to understand the context and tools available.

### Layer 3: Execution (Deterministic Scripts)
Located in `execution/`, these Python scripts provide a reliable interface for common tasks, wrapping underlying tools (npm, powershell, etc.).

#### Available Commands:
- **Web**: `python execution/web_ops.py <command>` (dev, build, lint, test, db:migrate)
- **Player**: `python execution/player_ops.py <command>` (start, deploy, test)
- **Generic**: `python execution/run_script.py <script_name>` (Execute any .ps1 or shell script)

## Legacy
Old documentation can be found in `legacy/`.
