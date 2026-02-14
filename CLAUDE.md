# Agent Instructions

This repository uses a 3-layer workflow to keep execution reliable.

## Layer 1: Directives (What to do)
- SOPs live in `directives/`.
- Start with `directives/AGENTS.md`, then apply directive-specific docs like `directives/auto_qa.md` and `directives/workflow_git.md`.

## Layer 2: Orchestration (Decision making)
- Classify each request by domain: `web/`, `player/`, or QA.
- Route work to the correct scripts in `execution/`.
- If something fails, diagnose, fix, rerun, and capture learnings back into directives when requested.

## Layer 3: Execution (Doing the work)
- Prefer deterministic scripts in `execution/` over ad-hoc manual steps.
- Key entry points:
  - `python execution/web_ops.py <command>`
  - `python execution/player_ops.py <command>`
  - `python execution/run_tests.py <scope>`

## Operating Principles
1. Check existing tools first before creating new scripts.
2. Keep docs aligned with canonical project context:
   - `skills/project/ARCHITECTURE.md`
   - `skills/project/DEPLOYMENT.md`
   - `skills/project/PROJECT.md`
3. Never commit secrets or local environment files.
4. Use `master` as the main branch and follow `directives/workflow_git.md` for deploy flow.

## Scope Note
This file is intentionally project-specific. Do not include generic webhook/cloud-automation instructions unless explicitly added to this repository.
