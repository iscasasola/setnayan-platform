## 2026-07-27 · feat(vendor): the emcee's activity catalogue — the data layer and the bridge onto the timeline

Owner: *"emcees will list all his activities that the hosts can pick from ... so
strategically plan this so it will be faster for them to build a script for that
day."* This is the foundation for that — schema + the placement logic. The
authoring and picking surfaces follow.

**The speed comes from the bridge, not a better editor.** Building a wedding
timeline is slow because the couple types every moment from nothing. It gets fast
when the person who runs those moments for a living has already written them
down — with their real lengths — and the couple just picks. So the load-bearing
function is `planPicksOntoTimeline`: picked activities → schedule blocks.

### Why NOT `vendor_package_items`

That table is this project's own worked example of "the catalogue picker you were
about to build already exists" (CLAUDE.md Rule 0 §3), so it was the first thing
checked. It is the wrong vessel, for three reasons that are properties of the
table rather than preferences:

1. **It is a money object.** `replacement_value_centavos` refunds into the
   consumable pool when a host unchecks a line. Un-picking "the shoe game" must
   not move money.
2. **It carries no time.** An activity's whole use is knowing how long it takes,
   so a picked one can become a block.
3. **It freezes.** `editScopeForPackage(activeBookingCount)` drops a package to
   metadata-only once any booking exists — right for a priced package, fatal for
   a repertoire that must keep improving across customers.

### What this IS — the second instance of a shipped pattern

Structurally identical to the band's repertoire, which already ships and already
feeds a day-of specialization:

| the band | the emcee |
|---|---|
| `vendor_songs` | `vendor_activities` |
| `event_song_picks` | `event_activity_picks` |

Same RLS idioms (`current_vendor_ids()` to author, `current_event_ids()` to
pick). Nothing here is a new pattern; it is an existing one applied to a second
trade.

### The owner's persistence split, enforced by the schema

*"stays per wedding. but his questionaire can be saved as his template. to use
for succeeding customers."* The **catalogue** is the emcee's craft and travels
with him; the **picks** belong to one event and die with it. `vendor_activities`
has no `event_id` and `ActivityPick` carries no couple's words, so nothing
personal to one wedding can ride along to the next.

### The lane the song desk needed later, built in now

`event_song_picks` shipped host-scoped only, so a booked vendor could not read
the couple's picks at all — which is why the song desk needed a further migration
before it could exist. `event_activity_picks_booked_vendor_select` is included
from the start, scoped twice over: the vendor must be **booked on the event**
AND the activity must be **one of theirs**. A booked vendor still cannot read
another vendor's picks on the same event.

`REVOKE ALL` on both tables — every new table in `public` ships open, and RLS
does not undo a table-level GRANT.

### Placement rule: append, never reflow

Picked activities land in a run **after everything already scheduled**,
back-to-back in the emcee's own order, gap-10 `sort_order`. Nothing existing
moves and nothing overlaps — the same reasoning that makes `loadScheduleTemplate`
refuse a non-empty schedule outright: a tool that reflows a hand-built day is one
people stop trusting. Idempotent: a pick already carrying a `scheduled_block_id`
is never planned twice, so adding one more activity plans only the new one.

Skips are **named, never silent** — a deleted or retired activity comes back in
`unavailable`. A malformed fallback plans zero blocks rather than rows whose
`start_at` is "Invalid Date".

**Guards proven by neutralisation** (run, observed, reverted; in the test
header): removing the idempotency early-continue fails exactly the 2 idempotency
tests; starting the cursor at the timeline's earliest start instead of its tail
fails exactly the 2 that protect the couple's authored day.

Verified: `tsc --noEmit` clean · 4647/4647 unit tests (16 new) · migration
prefix guard + doctor clean · production build green.

⚠ **Not yet applied to prod.** `supabase db push` is an owner action.

SPEC IMPACT: Two new tables (`vendor_activities`, `event_activity_picks`) — the
`vendor_songs` / `event_song_picks` pattern applied to host/MC. Logged in
`DECISION_LOG.md` 2026-07-27. No pricing change: activities carry time, not money.
