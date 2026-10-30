## 2026-10-30 · feat(guests): a swap in Seats asks first — why each sits there, and what else it moves (slice 6a)

Owner 2026-10-29, Guests prototype v13 (`assess` / `requestMove`): *"Drop a face on a taken seat → 'Swap … ?' with why
each sits there and tickable side effects (+1, household)."* Until now a picked guest dropped on a face traded chairs at
once, with no Undo.

- In Guests › Seats (2D and List), a SWAP always asks: **"Swap Ana (Table 2) with Ben (Table 5)?"** — each person with
  their table and WHY they sit there ("You placed Ana here · yesterday" · "Auto arrange placed Ben here · today", from
  `placed_by` — built on the who-placed-each-seat slice; a seat nobody recorded says nothing).
- A MOVE to a free seat asks only when there is something to say; otherwise it goes as before.
- **Also** (tickable, Yes/No): the mover's +1 who sits with them now comes along into a free seat of the new table
  (ticked by default).
- **Warnings** (plain): the new table has no seat left for that +1 · a +1 leaves the guest who brings them · two people
  the couple keeps apart would share a table · a closest-tier guest leaves their tier's table. Three lines at most, side
  effects first. Names only — no pronoun is guessed.
- Done → one line with **Undo** in the Seats toast ("Swapped Ana and Ben" — Undo swaps back; "Ana → Table 5 · seat 8
  (was Table 2) · moved Jun too" — Undo puts everyone back).
- Pure rules + words: `lib/seat-move-assess.ts`. Guard `lib/a-swap-says-why.test.ts`.
- ⚠ Stacked on the who-placed-each-seat PR (it reads `seat_placed_by`). Merge after it.

SPEC IMPACT: None — builds the approved prototype's swap confirm.
