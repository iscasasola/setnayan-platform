## 2026-10-20 · perf(dashboard): the Guests tab is two database trips from its first name, and the event's row is read once

Owner, after the Supabase move to Pro + Micro: *"why is it still loading slow … loading the guests"*.
The database was healthy; the couple's signed-in pages were the wait. The Guests page awaited ten
reads one after another and the event's `events` row was read 5–7 times per request.

- `lib/event-row-once.ts` — `openDashboardEventRow` + `DASHBOARD_ROW_CARRIES`: the couple's
  dashboard reads its event row ONCE per render, as the viewer's own client (RLS unchanged), and every
  `eventRowOnce` asker on that client is answered from it. A refused one read hands out nothing — each
  asker sends its own read and keeps its own failure.
- `lib/event-membership-once.ts` — the layout gate, `viewerHostsEvent`, `fetchEventViewer` and Home
  share one `event_members.member_type` read per render (retried inside).
- `guests/page.tsx` — every read starts at once and is awaited in ONE wait; the linked names and
  linked photos share one `event_members` read.
- Event layout — the rail's and the co-host card's reads start in its read block; the rail's Studio
  resolver and the guest card use the request's one `getCurrentUser()` (each sent a second auth trip).
- Home, Suppliers, Budget open the one row; Home's lean row, tab title and membership reads, the
  head-count read (`lib/pax.ts`), the needs read and the invite setup ride it.
- Suppliers — the review sweep runs in `after()` instead of in front of the screen; the
  "Couldn't load your date and place" state no longer crashes (a function icon crossed into a client
  component).

Measured (`guests-page-reads.harness.ts`, 150 ms a trip): the page 10 → 2 trips deep, 1,543 → 311 ms;
layout + page 9 → 4 deep, event-row reads 7 → 1, membership reads 3 → 1. Held by
`guests/the-guests-page-asks-once.test.ts` and `lib/event-row-once.test.ts` (8–10b).

SPEC IMPACT: None.
