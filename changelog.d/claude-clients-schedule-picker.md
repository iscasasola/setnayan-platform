## 2026-11-12 · feat(clients): the Schedule pick moves into Show & sort — a chip under the month says it

Controller approved part (a) of `Build_Schedules_2026-11-12/schedules-hand-in-hand.html` under the owner's "Into Show & sort" (DECISION_LOG "📅 CLIENTS SCHEDULE PICKER → SHOW & SORT (build)").

- The "All schedules ▾" `PickMenu` (`data-dates-scope`) that sat ABOVE the supplier's Clients month is gone.
- Show & sort (`customers/_components/clients-show-sort.tsx`) gains a **Schedule** row under Show — All schedules · each schedule · a seat's work — counted in "N applied" and let go by Clear all.
- A 44px chip under the month's legend (`customers-calendar.tsx`, `data-dates-schedule-chip`) says the pick — "All schedules", or "Showing · Video team schedule" — and opens the SAME choices. One schedule: no row, no chip.
- ONE list for both (`scheduleScopeOptions` in `customers/clients-show-sort.ts`); the pick stays on-screen (never the URL) and crosses between the sheet and the month on window events (`CLIENTS_SCHEDULE_EVENT` / `CLIENTS_SCHEDULING_EVENT`), like `CLIENTS_SHOW_EVENT`.
- The Schedule page's month (`schedule-calendar.tsx` → `CustomersCalendar place="schedule"`) draws the same chip with its own pick and never hears the Clients events.
- Dev lab: `/dev/clients-lab?v=events&pools=2` and `?v=pick&page=schedule&cal=two` draw a two-schedule shop.
- Guard: `customers/the-schedule-pick-is-in-show-sort.test.ts`.

Part (b) — schedules moving together (event hours on a booked row, call times, a schedule chat card) — is NOT built; it waits on the owner questions listed in the prototype.

SPEC IMPACT: None
