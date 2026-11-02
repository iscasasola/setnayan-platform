## 2026-08-17 · fix(guards): the gate-with-no-handle guard now enumerates the schema

`lib/gates-have-handles.test.ts` existed to stop a switch shipping with nothing
able to flip it — and checked FIVE HAND-TYPED columns. A new switch was covered
only if whoever added it remembered to register it, which is the memory the
guard exists to replace. The record shows it does not hold: instances 3, 4 and 5
were each registered only AFTER shipping broken (`is_founder` three months
after, `live_photo_wall_visibility` nine months after).

**The candidate set is now DERIVED from the catalog** — every boolean/enum
column carrying a DEFAULT, 265 today — in a new
`tests/db/gates-have-handles.db.test.ts`, with reasoned exclusions in
`tests/db/gates-have-handles.baseline.txt` (51 lines). Same shape as
`anon-rpc-surface.baseline.txt`: adding a line is allowed, adding one silently
is not.

**The detector was measurably too narrow and is fixed** (extracted to
`lib/gate-writers.ts`, now shared by both guards so they cannot drift). The old
`.update({ column: ... })` pattern missed four spellings this codebase actually
uses, and called 16 working controls missing:

- ES6 shorthand — `.update({ ..., faceblock_enabled, ... })`, no colon. The
  guest privacy opt-out looked uncontrolled while a checkbox rendered for it.
- A write funnelled through a helper (`writeControlStateAdmin({ director_mode })`).
- An update object longer than the pattern's 600-character window
  (`users.marketing_opt_in`).
- A payload assembled into a variable first — the documented blind spot, and the
  most common shape in the admin tree.

Writes through database functions are now detected from `pg_proc` bodies, so the
hand-maintained `writtenViaRpcParam` mapping is no longer load-bearing.

**Four findings surfaced by the enumeration**, recorded in the baseline, not
silently excused — most notably `papic_photos.consent_to_public`, whose own
comment calls it the guest consent gate for the public Alaala showcase and which
nothing writes, so no clip can ever enter that showcase.

Mutation-tested five ways with occurrence counts printed before and after; one
sabotage initially stayed GREEN because a second branch in the same function
carried it, and was redone against the whole detector.

SPEC IMPACT: None.
