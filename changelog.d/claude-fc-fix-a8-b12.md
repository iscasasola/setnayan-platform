## 2026-11-27 · fix(admin): final check area 8, batch 12: the Papic storage jobs ask first

Final check, area 8, checker 8-1, batch 12 (lane A only, no screen shape change):

- **A8·P-B-22**: Admin › Insights › Papic storage. "Fill in missing Memory lane copies" is now "Make Memory lane copies", and its press opens the house confirm box ("This starts as soon as you confirm…") before the job runs. "Make small copies of old photos" asks the same way. Both presses are the shared `ActionButton`. The tile job's per-press number now has one home (`lib/papic-tile-backfill.ts`), read by the action, the section note and the confirm box.

Guard: `apps/web/app/admin/papic-storage-jobs-ask-first.test.ts` (fails with the old sources).

SPEC IMPACT: None. How an existing admin press asks; no rule, price or plan changes.
