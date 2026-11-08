# Supplier Build 2 · lane B2-A — Clients + Schedule

Branch `claude/supplier-build2-a` (from `origin/claude/supplier-1build`). Row order from the brief:
**#43 → #38 → #37 → #28 → #36 → #27 → #29 → #34 → #42**. No PR, no merge, no deploy.

Lab: `/dev/clients-lab` (L2's), dummy env only (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1`), never `.env.local`.
Shots: `build-notes/shots/b2a/sbs-<row>-<view>-<light|dark>.png` — v118 on the left, the build on the right, 375 px.

⚠ **Dark shots are forced.** The app paints dark only through `html.dark`, and `/vendor-dashboard` is NOT on
`DARK_READY` (`lib/appearance.ts`) — production shows the supplier dashboard in light only. The build's dark shots
add the class by hand so the dark rules can be judged before the area is listed.

## Done

### #43 — one Clients screen (commit `564748d68c`)
- (a) Events and Dates draw ONE screen: `CustomersPin` mounts the month on top (`oneScreen`), the tiles as their own
  row, Overdue / Unread, then every client under its day. `CustomersDates` is gone; `?seg=dates` lands on the same
  screen (`?seg=dates&day=` still opens the day page).
- (b) Pinned row: `Clients · N booked · ₱X to collect · ⚙` (`formatPhp`; ₱1M+ compact on the tile only).
- (c) Tiles: their own row under the month (v113 `.tot.t4`), dot · word · figure; pressed = ink fill.
- (d) Thumb row: Search clients · ⇅ · ＋. Check a date folded into the month's day bar.
- (e) Day heads read `SUN 8 NOV` (`dayHeadWords`, uppercased by CSS) on the list, the month and the picked day. The
  plain list is day-grouped (`DEFAULT_CLIENTS_GROUP = 'day'`): coming days soonest first → No date yet → past days.
- (f) Details: the numbers inline (dot · word · figure · small line), no box. The stage strip was already on top of
  the real Details page (`pipelineBlock`); the lab does not draw it.
- (g) Schedule month asking marks: read inside the SAME `whole` request (threads in the same `Promise.all`, then the
  asks' events). An unread ask stays `null` (no marks drawn), never "nobody asked".
- Picking a day: the day head + "Open the day ›" + ×, that day's rows; the whole list and Overdue/Unread hide.
  × or a tile lets the day go (`CLIENTS_LET_GO_DAY_EVENT`).
- Guard: `app/vendor-dashboard/customers/clients-is-one-screen.test.ts` (a)–(g). Sabotaged (b) PickMenu in the title
  row, (e) default group → status, (g) dropped the `measured` gate — each failed, each restored.
- Existing guards updated with reasons in place (anchors-land, customers-are-events, dates-is-one-calendar,
  money-is-rows, people-is-rows, the-customers-figures-are-the-pinned-row, the-roster-opens-on-who-is-waiting,
  lib/every-thumb-row-is-the-one-row). Clients guard set: **307 pass · 0 fail**.
- **Requests:** the Clients screen = the list's reads (unchanged) + the month's 5 reads started in parallel with them
  (dayStates · month waitlist · upcoming waitlist · settings · picked rows) + 1 asks events read; pools, bookings,
  blocks, threads, services and team are handed in, never read twice. Fewer than Events + Dates were together.
  Schedule month: still **1 request** (the `whole` action), with 2 more DB reads inside it.
- Shots: `sbs-43-clients`, `sbs-43-day-picked`, `sbs-43-list`, `sbs-43-details`, `sbs-43-schedule` (light + dark).

## Not done / differs from v118 (for the controller)
- v118's picked day swaps the tiles for that day's figures and shows "Accept bookings" + "Book a client"; the build
  keeps the month's tiles. The picked fill is still the accent — that is row #37.
- DatesFolds (closures, caps, waitlist tools) now sit at the FOOT of the one screen — a placement call to confirm.
- The "Events ⓘ" heading over the list is still drawn; the scope dropdown stays for shops with several schedules.
- Forced dark: the opened-event pane (Schedule / Details) keeps a white ground — not dark-swept yet (not live).

## Needs
- tsc: queued under the heavy lock behind `integrate-unit-suite` (see "Where I stopped").

## Generated files (not edited — the controller regenerates)
- `port:baseline`, `ugat:screens` — page.tsx lost `CustomersDates` and moved `readOpenAsks` to `open-asks.ts`.
- Server-action budget: unchanged (no new exported action).

## Where I stopped
- #43 committed + pushed. Next: #38 (one open path — `customers-roster.tsx` `hrefFor` → `customerCardHref`).
