## 2026-07-21 · refactor(coordinator): move consent/money + prep-release gates onto the admin Data Privacy control board

The two DPO-gated coordinator features now activate from `/admin/data-privacy`
(the recorded RA 10173 approval), not a Vercel env flag — so the owner/DPO
approves in-app and the feature goes live the instant it's approved, no
redeploy, no engineer in the loop.

- Seeds two controls into `data_privacy_controls` (migration `20270902120000`),
  **status inactive** (fail-closed) + the mirror entries in
  `lib/data-privacy-controls.ts`:
  - `coordinator_consent_money` ← was `NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED`
  - `coordinator_prep_release`  ← was `NEXT_PUBLIC_COORDINATOR_PREP_RELEASE_ENABLED`
- `isCoordinatorConsentGateEnabled()` / `isCoordinatorPrepReleaseEnabled()` now
  read `isDataPrivacyControlActive(key)` (async, server-only) instead of
  `process.env`. All ~9 call sites now `await`.
- **Client-safety:** `lib/schedule.ts` is pulled into a client component
  (`schedule-widget`), so it must NOT import the server-only control.
  `fetchPublicScheduleBlocks` now takes an `excludeStaged` boolean and
  `fetchScheduleVisibility` is caller-gated; the two guest pages
  (`[slug]/page`, `[slug]/hub/page`) compute the control and pass it in.
- The env vars are retired (reading them no longer does anything). Since they
  were never `true` in prod, behavior is unchanged: inactive control = today.
- **P2 (run-of-show) and P3 (broadcast) stay ordinary flags** — not
  privacy-sensitive, so they don't belong on the DPO board.
- `coordinatorMoneyScopeAllowed` split into a thin control wrapper + a gate-free
  `coordinatorMoneyScopeGranted` core, so the unit test exercises the scope
  logic without the DB-backed control (the env-flag mock it used is retired).
  All 9 money-scope tests pass.

Net: inactive (default) = byte-identical to today. To activate, an admin
approves the control at `/admin/data-privacy` — recorded as the permanent RA
10173 audit trail (`approved_by`/`approved_at`).

SPEC IMPACT: Coordinator role activation mechanism. Corpus
`Coordinator_Role_Feature_Spec_2026-07-18.md` §3a/§4 — activation is now an
in-app admin approval, not a Vercel env flip. Logged at the bottom of
`DECISION_LOG.md`.
