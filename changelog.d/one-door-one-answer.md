## 2026-09-03 · fix(entrance): one door, one answer — the wayfinding entrance folds into the canonical store

There were **two independent answers to "where is the door"**, each with its own
editor, and neither wrote the other:

| | Store | Editor | Read by |
|---|---|---|---|
| A | `events.venue_entrance_x/y` | Indoor Blueprint studio | `/[slug]/find-my-table`, the seating tour |
| B | `event_floor_plan.entrance_x/y` | seating lab floor markers | the lab, the **public venue walk**, `plan3d-scene`, `venue-decor` |

Both guest-facing. A couple who moved the door in one editor left the other
pointing at the old one — the guest wayfinding arrow could aim at a door the 3D
room didn't draw. They agreed only because both defaulted to bottom-centre.

**`event_floor_plan` is canonical** (owner call, 2026-09-03): it also carries
`entrance_enabled`, a service entrance, and door-vs-walk-through geometry, and
four surfaces already read it.

- `fetchEntrance` now reads the floor plan first, falling back to the legacy
  columns **only** as a transition so no existing blueprint choice is lost
  before the backfill lands, then to `DEFAULT_ENTRANCE` — which is also what
  every 3D surface walks in at when no doorway is enabled.
- The Blueprint editor now upserts `event_floor_plan` and sets
  `entrance_enabled = true`. That flag is deliberate: **every 3D surface ignores
  a stored position while the doorway is disabled**, so writing a coordinate
  without enabling it saves a value nothing will use — the same silent
  disagreement one field along. It also revalidates the seating paths, or the
  unification stays invisible until a hard reload.

**Migration `20271199899381` backfills every blueprint-placed door — and never
moves a door somebody can already see.** The `DO UPDATE` is guarded on
`entrance_enabled = FALSE`, so an event whose lab doorway is ENABLED keeps it:
that is the door currently drawn in the 3D room and walked through by guests.
Only events with no enabled doorway inherit the blueprint position. Where the
two disagreed, **the visible one wins.**

`events.venue_entrance_x/y` are **not dropped** — they are commented DEPRECATED
and still read as a fallback, so the migration and the app deploy cannot race.
Retire them in a follow-up once prod is verified.

**Guards.** `tests/db/one-door-one-answer.db.test.ts` reads the migration **off
disk and executes it**, so it cannot drift from what deploys — a hand-typed
restatement would pass while the real SQL did something else. Re-executing is
also the idempotency proof. `lib/one-door-one-answer.test.ts` pins the reader
order and the writer target, both invisible to a behavioural test because the
defect was never a wrong value — it was the wrong *place*. Five sabotages
verified red across the two.

SPEC IMPACT: `event_floor_plan` is now the single source of truth for the venue
entrance; `events.venue_entrance_*` is deprecated. Corpus DECISION_LOG entry to
follow.
