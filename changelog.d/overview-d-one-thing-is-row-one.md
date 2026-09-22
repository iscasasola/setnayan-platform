## 2026-09-22 · feat(overview): today's one thing is row ①, not a second card

**PR 4 of the Overview redesign** (owner-approved 2026-09-22).

The Overview rendered the resolver's #1 pick **twice** — as a gold-hairlined *"Today's one thing"*
card below the top grid, and again as a row on the Decisions board. Measured live on event
`044f7e64`, that made *"Lock your coordinator"* the **third** rendering of one task on one page
(the digest was the first, removed in PR 2).

They are the same task **by construction, not coincidence**: `buildCockpitModel` receives
`topPriorityTask` and builds its `start` decision straight from it —
`` id: `start:${topPriorityTask.id}` ``.

**The card folds into the row.** The row keeps the name (*"Today's one thing"* as its eyebrow) and
takes the page's one filled action; the card no longer renders.

### 🔑 Except when the board does not carry it
Two cockpit branches leave the resolver's pick with no row of its own:

- the group already has saved options, so it surfaces as `pick:<id>` instead of `start:<id>` —
  same group, different framing; and
- the group has an **outstanding ask** (the couple asked, the supplier has not answered). That
  branch adds the group to `decidedGroupIds` and **pushes no decision at all**.

Folding unconditionally would, in that second case, **delete today's one thing from the page**. So
the row is resolved first — `findTodaysOneThingRowId` in `lib/todays-one-thing-is-row-one.ts`, pure
and matching only `start:` / `pick:` so a `pay:` or `role:` row sharing a suffix cannot be promoted
by mistake — and the standalone card still renders whenever it returns `null`. The fold cannot lose
anything; at worst the page looks exactly as it did before.

**D-4 still holds: exactly one filled action.** It moved onto the row. When the board has no row for
the task, every row is an outline and the fallback card carries it. Two sites in the source, mutually
exclusive at render, asserted as such.

**The 26-word "why it matters" paragraph did not come with it.** A board of one-line rows is not the
place for prose, and the row's sub-line already carries the fact (*"Nothing booked · overdue by 278
days"*). It goes to the **inspector**, the surface built for one row at a time — `why?` renders only
when present, never an empty paragraph. The guard asserts the hand-off, so the comment claiming it
cannot become a lie.

### Guarded and probed
`lib/todays-one-thing-is-row-one.test.ts` — 5 executed cases on the resolver (start row · pick row ·
outstanding ask → null · a `pay:`/`role:`/`deadline:` suffix collision → null · no task) plus render
assertions with counts printed. Sabotages: removing the `!oneThingRowId` gate so the card renders
beside the row goes 🔴; dropping the `why` hand-off goes 🔴.

SPEC IMPACT: None beyond the 2026-09-22 `DECISION_LOG.md` rows already applied.
