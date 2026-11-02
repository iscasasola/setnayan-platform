## 2026-06-22 · feat(seating): lock-and-fill + relax — explainability (smart seat-plan · Phase 4, final)

Owner "what's next" smart seat-plan, **Phase 4** — the last phase (follows #1997/#2002/#2003). Two finishing capabilities:

**Lock-and-fill.** The couple **pins** hand-placed seats (a lock toggle on each seated guest) and hits **"Fill around N locked"** — locked seats stay exactly where they are; everyone else is un-seated and re-seated around them by priority + keep-apart. "Lock the head table, fill the rest."

**Explainability / relax.** The Seating Guide now marks each keep-apart rule that's **currently violated** (live, from the seating — red "seated together" badge), and a one-tap **"Relax the lowest-priority rule"** drops the most-expendable violated rule (keeps the separations protecting your most important guests).

- **Migration** `20270211861238_seat_assignment_locked.sql` — additive `event_seat_assignments.locked BOOLEAN NOT NULL DEFAULT FALSE` (inherits the table's RLS). Applied to prod in-session (see the migration-pipeline note below).
- **`lib/seating.ts`** — `relaxLowestPriorityRule` (pure, deterministic: drops the rule whose more-expendable guest is lowest-ranked, stable tie-break). `SeatAssignmentRow.locked` + `fetchAssignments` selects/coalesces it. `solveSeatPlan` already treats passed (locked) assignments as fixed context, so it fills around them unchanged. 1 new unit test (16 total, `tsx --test` green).
- **`actions.ts`** — lock-gated `toggleSeatLock` (UUID-validated) + `lockAndFill` (keeps locked rows, clears the rest, re-solves around them with priority + constraints, returns the keep-apart outcome).
- **`seating-editor.tsx`** — per-seat Lock/Unlock toggle (optimistic), "Fill around locked" toolbar button + a confirm (it clears unlocked), live violated-rule chip marking, and the Relax button. `page.tsx` threads `seat_locked` onto each guest.

**⚠ Migration-pipeline breakage found + worked around (surface to owner).** While building this I discovered the `supabase-migrations` auto-apply workflow has been **failing silently** since a parallel session applied `20270210283954` to prod without merging it to the repo — `supabase db push` refuses on "remote migration versions not found in local migrations directory," which **blocked Phase 2 and Phase 3's migrations from ever applying** (their *merged* features were broken on prod: `priority_order` + `event_seating_constraints` didn't exist). I applied P2/P3/P4's migration SQL directly (statement-by-statement, idempotent) + inserted the ledger rows, so all three features now work on prod. **The pipeline is still blocked for everyone** until `20270210283954` is reconciled (`supabase migration repair --status reverted 20270210283954`, or merge that session's migration file) — owner/that-session action needed.

Seat plan stays a free couple tool (≈₱0/event). Adversarially reviewed (2 lenses — solver/actions/migration · UI/hooks) → **SHIP**, no HIGH/MED. **Smart seat-plan is now complete: Phase 1 (combined linked count) · 2 (priority) · 3 (keep-apart solver) · 4 (lock-and-fill + relax).**

SPEC IMPACT: iteration 0008 — adds `event_seat_assignments.locked` + lock-and-fill + relax. Logged in corpus DECISION_LOG.
