## 2026-07-10 · fix(seating): Seat Pass live-refreshes on a day-of reseat

Gap 8 from the seating gap audit. The guest Seat Pass (`/[slug]/seat`) renders the
guest's assigned table from `event_seat_assignments` but was `force-dynamic` with
NO live refresh — so when a coordinator reseated a guest during the reception,
`find-my-table` updated (it renders `<LiveRefresher/>`) while the Seat Pass kept
showing the OLD table. Two Setnayan surfaces disagreed about the same guest.

Fix: `SeatPassShell` now renders `<LiveRefresher eventDate={event.event_date} />`
(the same `useDayOfLiveTick` → `router.refresh()` mechanism find-my-table and the
day-of hub already use). Added `event_date` to the page's event select + the
`EventRow` helper type, and threaded `eventDate` through all Shell call sites.
LiveRefresher renders null, so there is no visual change.

Audit correction: the audit also flagged `/[slug]/hub`, but `HubShell` ALREADY
calls `useDayOfLiveTick(eventDate, …)` — the hub was never stale. No change there.

`tsc` + guards clean. Behavioural (day-of polling) — mirrors the shipped
find-my-table pattern.

SPEC IMPACT: None.
