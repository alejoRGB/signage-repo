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
- [ ] Update unit/API tests for new validation rules.
- [ ] Add Playwright cases for wizard flow and offline start blocking.
- [ ] Add Playwright cases for equal-duration filtering and repeated-video assignment.
- [ ] Validate Session Health still updates (`heartbeat`, `drift avg/max`, `resync`).

### Phase 5 - Rollout
- [ ] Web deploy to `master`.
- [ ] Verify Vercel production deployment reaches `Ready`.
- [ ] Run smoke checks on Sync tab in production.
- [ ] Confirm no regressions in Schedules tab behavior.

## Acceptance Criteria
- [ ] User cannot proceed from Step 1 with fewer than 2 selected devices.
- [ ] User can include offline devices while preparing a sync session.
- [ ] User cannot start session if any selected device is offline in Step 3.
- [ ] Only videos are assignable in Sync.
- [ ] All assigned videos must share exact `durationMs`.
- [ ] Same video can be assigned to multiple devices.
- [ ] Saved sync configurations can be reopened and edited.
