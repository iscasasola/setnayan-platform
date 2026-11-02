## 2026-09-11 · fix(papic): a typed "everyone else" number is at most the fair share

The couple's sheet and the database were two copies of one rule and disagreed.
`splitTheRest` shows a number the couple TYPES for "everyone you have not named"
capped at the equal share (`Math.min(everyoneElse, derived)`); the resolver
`papic_guest_spend_ceiling` returned it RAW. A couple who typed 500 on a pot that
divides to 14 was told "14 credits each" while every guest could spend 500 (×3 for
a principal sponsor since 20271220526938).

**The sheet was right.** No owner ruling covers the typed number itself
(DECISION_LOG searched), but a raw typed number breaks two that do: "capping
everyone IS the guarantee" (2026-08-28) and 7c "a named guest's shots stay hers,
protected all night" — un-named guests at 500 each could spend a named guest's
share before she arrived.

- **Migration `20271221350945`** re-creates `papic_guest_spend_ceiling` from
  production's live body (post-#5418). The equal share is now computed first and
  the typed number becomes `LEAST(typed, share)`; a sponsor takes her weight in
  that. Where no share exists (no pot, nobody left to divide among) the typed
  number stands alone, as before. A top-up lifts every guest toward the typed
  number and never past it. The migration refuses to apply if any arm is lost
  **or** if the old raw early return is still present. Inert on merge: 0
  celebrations have the switch on or a typed number (measured in prod).
- **The sheet** now says why when the two differ: *"Your celebration holds enough
  for 14 credits each right now, so that is what each guest gets. Add credits and
  it rises on its own, up to your 500."*
- The unit test whose comment claimed the database enforced the cap (it did not)
  now records that the claim is true as of this migration and where it is proved.

Guard `tests/db/papic-the-typed-number-is-at-most.db.test.ts` (7): the headline
shoots on a real pool event (pot 60, 10 heads, typed 50) and is refused at the 7th
credit; a named guest's shots stay unreachable; the sheet's `splitTheRest` equals
the resolver above and below the share. Sabotage, before → after: typed binds raw
with the assertion needle neutralised (2 → 0) → 5 red · same with the assertion
intact (2 → 1) → migration refuses, 7 red · the old early return restored (1 → 2)
→ migration refuses ("still returns the typed number raw"), 7 red. Unchanged and
green: sponsor share (12), spend ceiling (23), own credits (15), raisable cap (4),
ugat ×2, anon-rpc-surface, exposure-freeze; unit allotments (22), ceiling display
(10), quota mirrors SQL (11).

SPEC IMPACT: `WHATS_NEXT_Shots_Per_Guest_2026-08-28.md` § 2 — the typed number is
an "at most"; `DECISION_LOG.md` row.
