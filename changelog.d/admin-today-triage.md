## 2026-08-03 · feat(admin): the work list opens with the morning read, and filters by lane

First slice of the admin-simplification programme the owner approved on 2026-08-03 ("this is our best approach"). Two additions to the **existing** `/admin/work` triage feed — no new route, no new data, no new query.

**RULE 0 mattered here.** `/admin/work` **already is** the ranked worklist: it pulls every act-now queue, orders them overdue → due-soon → busiest, and shares `lib/admin/queue-counts.ts` with the nav badges so the two can never disagree. The prototype's "Today" screen was largely a redraw of a page that ships. The genuine delta was only these two things, so only these two were built.

### 1 · The triage strip

`19 past promise · 25 due soon · 44 on pace`, over a proportional meter. The whole day in one line, before any scrolling.

Counts **items waiting, not queues** — the same unit as the nav badge and the subtitle, so no two numbers on the screen mean different things. Built from the **unfiltered** list on purpose: a lane filter narrows the rows beneath it without changing how the day actually looks. Renders nothing when there is no open work (the all-clear tile already speaks).

### 2 · Lane filter chips

`All · Money · Trust · Growth · Support`, each carrying its own waiting count. Lane was already on every row as a label; it just wasn't a filter.

**URL-driven (`?lane=`), not client state** — so the feed stays a Server Component, the chips work with JS off, and a filtered view is bookmarkable. Matches the `?tab=`/`?view=` convention used across the admin. An unknown value degrades to the full list rather than 404-ing, so a stale bookmark still lands somewhere useful. The chip row hides itself when fewer than two lanes are present — a filter with one option is not a filter.

`totalOpen` deliberately stays the **full** total while a lane is selected; the subtitle and strip describe the whole day, only the rows narrow.

### Notes

- The empty-lane tile ("Nothing waiting in Money · See every queue") is **defensive** — all four lanes currently have rows, so it is only reachable by hand-typing a URL. It exists because a page that renders a header and then nothing reads as broken rather than as good news, and the queue mix will change.
- `QueuesTriageFeed` has exactly one real caller (`app/admin/work/page.tsx`); the other grep hit is a comment. Both new props are optional, so the component's contract is unchanged for anything added later.
- Colours are the feed's existing `#B42318` / `#B54708` / `#8A6A2E`. The prototype's warmer status palette belongs to the later look-and-feel slice, not here.

⏭ **Found while building, not fixed here:** `Vendor payouts` is a **dead lane** in this list. Its dispatcher's own call site records the 2026-05-28 V2 cutover — *"Setnayan is now a software publisher, not a marketplace intermediary… new V2 orders won't route through it"* — so it can never accrue new work, yet it occupies a row in a ranked list of what needs the owner today. Removing a queue is a product call, tracked not taken.

Verified: 25 unit tests pass · lint clean · zero typecheck errors in the changed files (the 145 reported locally are the pre-existing missing-package cascade from a linked older `node_modules`, identical on unmodified `origin/main`).

SPEC IMPACT: None — presentation over data that already ships. No SKU, price, route, or schema change.
