# Agent Directives

This file consolidates the responsibilities, capabilities, and tools for all agents in the framework.


---

## Canonical Context
- **Project:** `agent_directives/context/project/PROJECT.md`
- **Deployment:** `agent_directives/context/project/DEPLOYMENT.md`
- **Architecture:** `agent_directives/context/project/ARCHITECTURE.md`

---

## Mandatory Scope Classification (All Agents)
Before executing delivery/deployment steps, classify the change scope:

1. **Web-only change**: impacts `web/**` (or backend/API used by web) and does not impact Raspberry runtime files.
2. **Player-only change**: impacts Raspberry runtime/deploy files (`player/**`, `deploy.ps1`, `execution/player_ops.py`) and does not impact web behavior.
3. **Mixed change**: impacts both web and player domains.

This classification is mandatory and drives which deployment workflow must run.

---

## Mandatory Web Delivery Workflow (Web-only or Mixed)
Run this workflow only when scope includes web impact (`Web-only` or `Mixed`):

1. **Commit** the change in git with a clear message.
2. **Push** to `origin/master` so Vercel can trigger a deployment.
3. **Verify** the latest production deployment status in Vercel.
4. If deployment is `Error`, the agent must:
   - inspect build/runtime logs,
   - apply a fix,
   - commit + push again,
   - re-check Vercel until deployment is `Ready`.
5. Report back with:
   - commit hash,
   - deployment URL,
   - deployment status confirmation (`Ready`).

For `Player-only` changes, this workflow is **not required** unless explicitly requested by the user.

---

## Mandatory Raspberry Deployment Workflow (Player-only or Mixed)
When a task modifies Raspberry/player-related files, deployment to Raspberry devices is mandatory before closing the task.

Trigger this workflow when changes include any of:
- `player/**`
- `deploy.ps1`
- `execution/player_ops.py`
- player runtime integration files in `web/` that affect device sync/commands (for example `web/app/api/device/**`, `web/lib/sync-*.ts`)

Required steps:
1. Deploy updated player code to target Raspberry device(s).
2. Verify service status after deploy (`running`, no crash loop).
3. If service is not active, inspect `journalctl -u signage-player` and identify the root cause before closing the task.
4. Report deployment result per device (IP/hostname + status).

If IP, username, or password/credential is missing, the agent must ask the user for those values before attempting deployment.

### Non-Interactive Deployment Policy (Preferred / Current-State Aware)
Prefer non-interactive Raspberry deployment flows to avoid blocked sessions.
Note: current project tooling (`deploy.ps1`, `execution/player_ops.py`) can still prompt in some paths.

1. Prefer commands that do not wait for terminal prompts (password, host-key acceptance, `Read-Host`, sudo prompt).
2. Prefer `plink`/`pscp` with `-batch`, `-pw`, and pinned `-hostkey` for Windows environments.
3. If using OpenSSH, prefer equivalent non-interactive flags (for example `BatchMode=yes` and explicit host-key strategy) and pass all required parameters up front.
4. When using `deploy.ps1`, provide `-PlayerIp` and `-PlayerUser` explicitly to minimize prompts (the script may still prompt for some choices depending on path).
5. `execution/player_ops.py remote_*` currently uses `ssh` and may prompt unless SSH keys/sudo are already configured.
6. If a command blocks or waits for input unexpectedly, abort that path and switch to a safer scripted sequence.

For `Web-only` changes, Raspberry deployment is **not required** unless explicitly requested by the user.

---

## Agent Role Directives (Canonicalized)
Detailed role-specific directives were moved to avoid overlap with this file:

- **Coordinator / Master rules:** this file (`agent_directives/AGENTS.md`)
- **Frontend Agent:** `agent_directives/roles/web-Front-End.md`
- **Backend Agent:** `agent_directives/roles/web-Back-End.md`
- **Player Agent:** `agent_directives/roles/Player.md`
- **QA Workflow:** `agent_directives/auto_qa.md`

### Shared Execution Entry Points
- Web ops: `python execution/web_ops.py <command>`
- Player ops: `python execution/player_ops.py <command>`
- Test orchestration: `python execution/run_tests.py <scope>`

### Skills (Coordinator may apply as needed)
- `.agents/skills/security-review`
- `.agents/skills/vercel-react-best-practices`
