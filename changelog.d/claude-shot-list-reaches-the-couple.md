## 2026-09-18 · feat(day-of): the shot list reaches the couple (DAY-10)

The photographer/videographer shot list on the On the Day console was
localStorage-only; PR #5502 had removed the heading that falsely claimed it
"syncs to the couple", but the sync itself was never built (the register
sweep caught a prior "DONE" tag that cited that PR).

- **New table `event_shot_list_items`** (migration `20271234188149`) — one row
  per shot, per (event, supplier). RLS at CREATE TABLE: the booked supplier
  (owner or team) manages their own list on events they are booked on; the
  event side reads every supplier's list via `current_event_ids()`; anon holds
  nothing. INSERT/UPDATE are column grants, so an UPDATE can never re-point a
  row at another event or supplier.
- **Console** (`on-the-day/_components/shot-list.tsx`) now saves through
  `on-the-day/shot-list-actions.ts`. localStorage stays as an offline cache. A
  status line always says which state the list is in — saved (the couple sees
  it), not shared yet, or couldn't reach Setnayan — so a phone-only list never
  looks shared. A pre-sync device list is kept and uploaded on first save,
  never replaced by the seed.
- **Couple** — a read-only "Shot list" card on the vendor workspace, with what
  has been captured and when. A refused read says so; it never renders as
  "hasn't shared one yet".
- Guard `the-console-claims-only-what-it-does.test.ts` flipped as its own
  docblock instructed: the heading may speak about the couple only while both
  the writer and the couple's reader exist (sabotage-checked both halves).
  New `lib/shot-list.test.ts` (pure logic, executed) and
  `tests/db/shot-list-items.db.test.ts` (RLS boundaries; sabotage-checked).
- `supabase/security/exposure-surface.baseline.txt` regenerated: +1 table,
  anon=nothing.

SPEC IMPACT: new table `event_shot_list_items`; DAY-10 closed. Corpus
`DECISION_LOG.md` row added (2026-09-18 · DAY-10).
