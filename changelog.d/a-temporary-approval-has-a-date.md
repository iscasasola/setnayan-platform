## 2026-09-22 · feat(privacy): a temporary approval carries the date it must be revisited

Owner, 2026-09-22, asked how to record what he had already decided: the data-privacy controls are
approved **temporarily**, to be looked at again in January. Measured the same day,
`data_privacy_controls` could not express that — its columns are status / approved_by /
approved_at / note / risk_note and **nothing that says "until when"**.

🔑 So a temporary approval and a permanent one were the same row. A provisional decision stored as
an unconditional one does not expire; it quietly becomes the permanent answer, and the review date
passes with nothing on any screen.

Context that makes it matter, measured 2026-09-22: **all 20 controls are `active` in production
while all 15 `npc_filing_tasks` are `not_started`** — including the tier-0 blocker "Route the full
packet to external PH counsel".

- Migration `20271238899699` adds `review_by date` and stamps every already-active control with
  **2027-01-31**, the January the owner named. Idempotent, and it asserts the stamp landed.
- `lib/provisional-approval.ts` — the pure resolver (`inactive` / `settled` / `provisional` /
  `overdue`), Manila-dated, with 12 executed unit tests. An unreadable date reads as **overdue**,
  never settled.
- `/admin/data-privacy` grows a banner and a per-card stamp, red once a date has passed.

⚠ **This gates nothing.** `isDataPrivacyControlActive` still reads `status` and only `status` — an
overdue review must never switch a live feature off on a date nobody was watching. It makes the
deadline visible and leaves the switch with the owner.

SPEC IMPACT: `DECISION_LOG.md` row added 2026-09-22 recording the temporary approval, its January
date, and that the controls being on is a dated position rather than a settled one.
