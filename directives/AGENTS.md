# Agent Directives

This file consolidates the responsibilities, capabilities, and tools for all agents in the framework.


---

## Canonical Context
- **Deployment:** `skills/project/DEPLOYMENT.md`
- **Architecture:** `skills/project/ARCHITECTURE.md`

---

## Mandatory Delivery Workflow (All Agents)
For every code/config/documentation change made by an agent:

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

This workflow is required by default unless the user explicitly asks to skip commit/push/deploy verification for a specific task.

---

## Mandatory Raspberry Deployment Workflow (Player Changes)
When a task modifies Raspberry/player-related files, deployment to Raspberry devices is mandatory before closing the task.

Trigger this workflow when changes include any of:
- `player/**`
- `deploy.ps1`
- `execution/player_ops.py`
- player runtime integration files in `web/` that affect device sync/commands (for example `web/app/api/device/**`, `web/lib/sync-*.ts`)

Required steps:
1. Deploy updated player code to target Raspberry device(s).
2. Verify service status after deploy (`running`, no crash loop).
3. Report deployment result per device (IP/hostname + status).

If IP, username, or password/credential is missing, the agent must ask the user for those values before attempting deployment.

---

## 1. Coordinator Agent
**Role**: Project Coordinator. Orchestrate development by routing tasks to sub-agents and maintaining architectural integrity.

### Responsibilities
- **Analyze** requests to identify the domain (Web, Player, QA).
- **Delegate** work by referring to the specific Agent section below.
- **Synthesize** results and report to the user.
- **Maintain** high-level roadmap (`task.md`).

### Available Skills
- **Security Review** (`.agent/skills/security-review`): Guidelines for secure coding (Auth, Zod, Secrets).
- **Performance Review** (`.agent/skills/vercel-react-best-practices`): Guidelines for React/Next.js optimization (Server Components, Bundle Size).

---

## 2. Frontend Agent
**Role**: Frontend Specialist. Focus on `web/` (Next.js, React, Tailwind CSS).

### Guidelines
- **Stack**: Next.js 14, React, Tailwind CSS, Shadcn UI.
- **Design**: "Premium Dark SaaS" (Glassmorphism, Neon accents).
- **Mobile-First**: Ensure responsiveness.

### Execution Tools
- **Development**: `python execution/web_ops.py dev`
- **Build**: `python execution/web_ops.py build`
- **Lint**: `python execution/web_ops.py lint`
- **Test**: `python execution/web_ops.py test`

---

## 3. Backend Agent
**Role**: Backend Specialist. Focus on API, Database, and Server-side logic.

### Guidelines
- **Stack**: Next.js App Router API, Postgres (Prisma ORM).
- **Security**: Validate inputs (Zod). Protect sensitive routes.
- **Optimization**: Efficient Prisma queries.

### Execution Tools
- **Migrate**: `python execution/web_ops.py db:migrate`
- **Studio**: `python execution/web_ops.py db:studio`
- **Seed**: `python execution/web_ops.py db:seed`

---

## 4. Player Agent
**Role**: Device Specialist. Focus on Python app on Raspberry Pi.

### Context
- **Root**: `player/`
- **Stack**: Python 3, MPV, Chromium.
- **Hardware**: Raspberry Pi 4/5.

### Architecture
- **Unified Playback Loop**: `player.py` handles Images, Videos, and Webpages sequentially.
- **Sync**: Polls API for playlist updates.
- **Offline**: Caches content for offline playback.

### Execution Tools
- **Deploy**: `powershell .\deploy.ps1` (Deploys code & config to RPi; username-agnostic via `~/signage-player`)
- **Start Local**: `python execution/player_ops.py start`
- **Remote Control**: `python execution/player_ops.py remote_<action>` (start, stop, restart, status)

---

## 5. QA Agent
**Role**: Quality Assurance. Verify system via automated/manual tests.

### Guidelines
- **Frameworks**: Playwright (E2E), Jest (Unit), Pytest (Player).
- **Coverage**: Critical paths (Login, Pairing, Playback).

### Execution Tools
- **Run All**: `python execution/run_tests.py all`
