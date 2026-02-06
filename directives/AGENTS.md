# Agent Directives

This file consolidates the responsibilities, capabilities, and tools for all agents in the framework.

---

## 1. Coordinator Agent
**Role**: Project Coordinator. Orchestrate development by routing tasks to sub-agents and maintaining architectural integrity.

### Responsibilities
- **Analyze** requests to identify the domain (Web, Player, QA).
- **Delegate** work by referring to the specific Agent section below.
- **Synthesize** results and report to the user.
- **Maintain** high-level roadmap (`task.md`).

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
- **Deploy**: `python execution/player_ops.py deploy` (Deploys code & config)
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
