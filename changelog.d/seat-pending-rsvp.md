## 2026-06-22 · feat(seating): hold a seat for pending guests too (seating follows RSVPs)

Owner caught it on the live plan: Auto Arrange said *"everyone attending is already seated"* and left the not-yet-replied guests with no spot. But a couple plans the whole room before every RSVP is in, so **pending/maybe guests should get a held seat** — only **declined** guests should be left out.

- **`lib/seating.ts`** — `computeAutoSeat` now seats everyone **not declined** (was attending-only), matching `recommendTableSet`, which already sized the floor for all non-declined guests. So the seater finally fills the tables the floor was built for. `solveSeatPlan` inherits this (keep-apart still works on the wider set). New unit test (17 total, `tsx --test` green).
- **`actions.ts`** — the manual "seat this role tier here" action (`seatRoleAtTable`) likewise seats non-declined.
- **`seating-editor.tsx`** — seated guests who haven't confirmed show a subtle **"held"** badge so they're never mistaken for confirmed; the role-tier count + Auto Arrange / confirm copy updated to say pending replies get a held seat (and the count no longer disables the button when a tier's only unseated members are pending).
- **`…/seating/caterer` report** — adds a **tentative (pending) headcount** next to the confirmed count; meal totals stay on **confirmed** guests only (you don't cook for maybes).

No schema change. Adversarially reviewed → one HIGH (role-tier count still gated on attending) + a stale comment, both fixed; declined never seated on any path, caterer meal totals not inflated, "held" badge only ever on pending/maybe. Seat plan stays free.

SPEC IMPACT: iteration 0008 — the auto-seater now holds seats for non-declined (pending) guests, not just confirmed. Logged in corpus DECISION_LOG.
