## Issue Log

- 2026-02-14: Closed - Devices tab showed persistent "Syncing..." under playlist selector.
  - Root cause: UI state depended on stale/partial sync signals.
  - Resolution: Added direct `/api/devices` polling in Devices manager and adjusted sync-label logic to require reported playback mismatch.
  - Validation: Local unit, e2e, and QA test suites passed.

## Schedules Redesign Rollout Checklist

- [ ] Scope freeze from approved sandbox:
  - [ ] 30-minute grid.
  - [ ] Click + drag painting.
  - [ ] Explicit eraser mode.
  - [ ] No overlaps (replacement on paint).
  - [ ] Deterministic playlist colors across sessions.
  - [ ] Manual save.
  - [ ] Desktop compact full-week view.
  - [ ] Mobile day-by-day view.
  - [ ] Visible range 00:00 to 23:30 (with 24:00 boundary marker).
- [ ] Add production-safe rollout switch (`SCHEDULES_REDESIGN_ENABLED`) with fallback to legacy editor.
- [ ] Integrate redesigned editor into `/dashboard/schedules/[scheduleId]` behind flag.
- [ ] Keep schedule list page behavior unchanged.
- [ ] Verify API payload compatibility (`PATCH /api/schedules/[scheduleId]`).
- [ ] QA:
  - [ ] Paint and erase by drag across multiple days.
  - [ ] Replacement behavior in occupied slots.
  - [ ] Save, reload, and consistency check.
  - [ ] Mobile day selector flow.
  - [ ] Hour labels visible through late-day slots (e.g. 16:30, 17:30, 23:30).
- [ ] Run TypeScript validation.
- [ ] Staging verification.
- [ ] Production activation via feature flag.
- [ ] Post-deploy monitor and decide legacy cleanup.
