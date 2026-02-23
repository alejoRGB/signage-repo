# Agent Directives Index

Canonical agent directive files live in this directory.

## Entry Points
- `AGENTS.md`: master directive for scope classification, deployment obligations, and agent roles.
- `auto_qa.md`: QA automation workflow (run, diagnose, fix, rerun).
- `workflow_git.md`: Git/versioning workflow and deployment verification commands.
- `shared_bootstrap.md`: shared bootstrap used by agent-specific wrappers.
- `roles/`: role-specific directives (`Frontend`, `Backend`, `Player`).
- `context/project/`: canonical project/architecture/deployment/MPV context consumed by agents.

## Agent-Specific Wrappers
- `CLAUDE.md`
- `GEMINI.md`

These wrappers intentionally avoid duplicating the shared bootstrap content.
