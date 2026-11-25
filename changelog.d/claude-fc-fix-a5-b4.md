## 2026-11-25 · fix(supplier): final check area 5, batch 4

- Today says "You're done for today" once: the cover heading, not again in the all-done block (B5-27).
- The Bundle Maker's ✕ returns to Your packages when it was opened from there (`?from=packages`, a closed list);
  otherwise it goes to Shop, as before (A5-G6-04).
- A refused read of a service card says "Couldn't load this card" with Try again, never "page not found" (A5-G3-01).
- A refused team read says "Couldn't load your team" on Team, Roles and Who gets new inquiries, never a role lock or a
  silent bounce home (`readTeamManagerContext`; actions keep the fail-closed reader) (A5-G5-07).
- Creators: a refused creators or offers read is said, never "No creators match yet" or an empty Sent list (A5-G2-05).
- Deep Search is named "Deep Search" and says "Unused searches don't carry over" once (B5-12).
- Team's Roles row counts its roles, Roles reads the free Helper from its constant, and Your page and Theft Watch name
  their plans from the plan table (both read Plus there, where the screens had typed "Pro") (A5-G5-10).
- Creators: the Send sheet and the refusal on Send name one plan (every paid plan, from Plus, from the table), and the
  sheet carries a See plans door (A5-G2-04, partly: the catalogue price on the lock is left for the lock drawing).
- Guard: `lib/supplier-batch4-holds.test.ts`.

SPEC IMPACT: None.
