## 2026-10-23 · fix(event-rail): one door to Event Details — the rail's "⚙ Event settings" line is gone

Owner, 23 Oct, comparing the Home cover's "ⓘ Event Details" button with the event rail's
"⚙ Event settings" line: *"same? If yes, only keep the Event Details button and remove the event
settings"*. Both opened `/dashboard/[eventId]/details`. The rail's name row
(`event-rail-context.tsx`) is now plain text — no link, no gear, no "Event settings" — and its dead
CSS (`.fd-rctx-link` · `-sub` · `-settings` · `-gear`) is removed. The `event` group stays in the
menu tree (the lit-row resolver still answers `personalization` on /details), but no row is drawn
for it, so /details lights nothing in the rail. The Details page's own "Event settings" section is
untouched.

Guards: new `one-door-to-event-details.test.ts` (rail draws no /details door and no `event` row ·
the Home cover RENDERS exactly one /details link, named "Event Details" · no "Event settings" on the
Home or rail; 5 sabotages, each red). `reachable-without-typing-the-url.test.ts` re-pointed
honestly: it counts only the rail rows the rail DRAWS, and `/details` proves its door through the
mounted Home cover button.

SPEC IMPACT: DECISION_LOG.md — one row, "ONE DOOR TO EVENT DETAILS" (owner 2026-10-23).
