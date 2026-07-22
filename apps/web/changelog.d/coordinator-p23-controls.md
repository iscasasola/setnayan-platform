## 2026-07-21 · refactor(coordinator): move P2/P3 scheduling activation onto the admin control board

Completes the "whole coordinator suite activates from one admin page" move —
P2 (filtered run-of-show) and P3 (day-of broadcast + call-times) now flip from
`/admin/data-privacy` alongside the consent/money + prep-release controls,
instead of `NEXT_PUBLIC_*` env flags.

- Migration `20270903120000` seeds `coordinator_run_of_show` +
  `coordinator_day_of_broadcast` (status inactive) + mirror catalog entries.
  **Both are labelled "activation only — not privacy-sensitive"** in category +
  risk note, so the RA 10173 audit trail stays truthful (they carry no privacy
  exposure — the board is just the de-facto dark-feature activation surface).
- **Client-safety (the trap):** `lib/schedule-ros.ts` and
  `lib/coordinator-broadcasts.ts` are PURE cores pulled into client bundles (the
  day-of-mode cards), so they must NOT import the server-only control. The flag
  functions moved OUT of them:
  - P2: `isScheduleRosP2Enabled` deleted; the one server caller
    (`schedule/page.tsx`) reads `isDataPrivacyControlActive('coordinator_run_of_show')`.
  - P3: `isCoordinatorP3Enabled` moved from the pure `coordinator-broadcasts.ts`
    to the server-only `coordinator-broadcasts-server.ts` (async, reads the
    control); the two server call sites (`dashboard/[eventId]/page.tsx`,
    `_actions/day-of-broadcast.ts`) import it from there and `await`.
- Env vars retired; inactive control = byte-identical to today.

Verified: `tsc` + `next lint` clean; coordinator/schedule/broadcast unit tests
49/49 pass (2 unrelated pre-existing failures — `papic-pool-metering`,
`vendor-deep-search` — untouched by this change).

SPEC IMPACT: Coordinator activation. The full coordinator suite (consent/money,
prep-release, run-of-show, broadcast) now activates from `/admin/data-privacy`.
Logged at the bottom of `DECISION_LOG.md`.
