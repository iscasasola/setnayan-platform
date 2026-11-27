## 2026-11-27 · fix(admin): L7 — a fresh Problems count, one tap to a list's page, whole row titles, an honest Catalogue head, every admin screen named once

Lane OLD-L7 (Master Plan Batch 5, D1–D5; walkthrough of 27 Nov, items 9, 10 and 24).

- **D1 · The Work count was stale** ("Problems · 204 waiting", "219 things need you", against a real 24 and 39). Only the Problems page ran the self-closing rule (`close_quiet_fault_issues`: an issue closes once a newer build is live and it has been quiet for 48 h). Work counted every quiet issue until someone opened Problems. Both now call one function first (`closeQuietProblems` in `lib/telemetry/problem-merge.ts`), so the count, the Focus total, the Work landing and the nav badges stand on the rows the page lists. The live build's commit has one home (`lib/telemetry/build-sha.ts`). No migration.
- **D2 · Problems took three hops** (a card saying "Nothing to press here" → "Open in page ›" → Work's "Open Problems"). A Focus row for a list worked on its own page now goes there in one tap (a › chevron, no card). Rows with real request cards still open in place.
- **D3 · "… added a new payment link to be paid on"** read as a row that had lost its date. The title now ends where it should: "… added a payment link". No request-card title ends on a preposition (guarded).
- **D4 · Catalogue head:** Oldest is the service requests' own age, never Studio's Social queue ("OLDEST 163d · Social queue"). "Real Stories (retired)" reads "Real Stories": only the public hub retired, and featuring still feeds the front door (owner, 27 Nov).
- **D5 · Admin titles:** five pages had no title (Fees owed, Payouts, Team help, Entity map, a Demo inquiry). Fifteen named themselves one way in the browser tab and another in the page heading; each heading now says the tab's name. A new guard (`app/admin/every-admin-page-has-its-title.test.ts`) holds both at zero.

No seat-plan files. No social code. Nothing in Studio › Social queue was pressed.

SPEC IMPACT: None. These are fixes to drawn screens. The Focus list rule ("a list worked on its own page opens that page in one tap") was confirmed by the owner on 27 Nov ("start" on the L7 plan).
