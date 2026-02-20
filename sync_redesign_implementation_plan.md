# Sync Redesign Implementation Plan

## Scope
- Sync sessions must use only video media.
- All videos in a session must have exactly the same `durationMs`.
- Users can reuse the same video across multiple devices.
- Step 1 must allow selecting offline devices, but require at least 2 selected devices.
- Online validation must run in Step 3 (`Review & Start`) before session start.
- Users must be able to save and edit sync configurations.

## Delivery Phases

### Phase 1 - Validation and Session Start Guardrails
- [x] Raise minimum devices from 1 to 2 in Sync preset validation (UI + backend).
- [x] Keep offline devices selectable while building preset/session.
- [x] Add preflight online check in sync session start endpoint.
- [x] Return actionable start errors listing offline devices.
- [x] Add/update tests for min-device and preflight-online behavior.

### Phase 2 - Sync Wizard UX (3 steps)
- [x] Step 1: Devices selection (>=2 required, online/offline allowed).
- [x] Step 2: Video assignment only.
- [x] Step 2: First selected video defines `targetDurationMs`.
- [x] Step 2: Restrict selectors to videos with matching `targetDurationMs`.
- [x] Step 3: Review assignments and statuses before start.
- [x] Step 3: Show blocking list when devices are offline.

### Phase 3 - Saved Sessions (using existing presets)
- [x] Reuse `SyncPreset` as editable saved sync configuration.
- [x] Improve preset list UX for open/edit/save/delete.
- [x] Add explicit "Start from saved preset" flow from Step 3.
- [x] Ensure snapshot behavior remains traceable via `SyncSession`.

### Phase 4 - QA Automation and Regression Safety
- [x] Update unit/API tests for new validation rules.
- [x] Add Playwright cases for wizard flow and offline start blocking.
- [x] Add Playwright cases for equal-duration filtering and repeated-video assignment.
- [x] Validate Session Health still updates (`heartbeat`, `drift avg/max`, `resync`).

### Phase 5 - Rollout
- [x] Web deploy to `master`.
- [x] Verify Vercel production deployment reaches `Ready`.
- [x] Run smoke checks on Sync tab in production.
- [x] Confirm no regressions in Schedules tab behavior.

## Rollout Evidence (2026-02-20)
- Deployment validated in Vercel as `Ready`:
  - `https://signage-repo-dc5s-1wu5frwm2-alejos-projects-7a73f1be.vercel.app`
- Production smoke (Playwright) executed against:
  - `https://signage-repo-dc5s.vercel.app`
- Auth smoke passed (`/dashboard` login flow + logout flow).
- Sync smoke:
  - Sync panel loads and renders correctly.
  - Current test account/environment has `0` available devices, so Step 1->3 wizard progression could not be exercised in production data for this run.
- Schedules smoke:
  - `/dashboard/schedules` loads successfully after login.
  - No crash/regression observed in Schedules navigation.

## Acceptance Criteria
- [ ] User cannot proceed from Step 1 with fewer than 2 selected devices.
- [ ] User can include offline devices while preparing a sync session.
- [ ] User cannot start session if any selected device is offline in Step 3.
- [ ] Only videos are assignable in Sync.
- [ ] All assigned videos must share exact `durationMs`.
- [ ] Same video can be assigned to multiple devices.
- [ ] Saved sync configurations can be reopened and edited.
