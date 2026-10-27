## 2026-10-28 · feat(supplier): coordinators get a door into the events they run

Owner, verbatim: *"for coordinators, since they have access to the whole event as well. we can add that additional
menu for them? to enter the event dashboard?"* → *"approved"* (DECISION_LOG 2026-10-28 "COORDINATORS GET A DOOR INTO
THE EVENTS THEY RUN"; prototype `prototypes/coordinator_door_2026-10-28/`).

- **Today › Events you run** — one row per event (names · type · date · "Coordinator" · what the day is to them ·
  Open ›), first three, "All ›" to the tab. Only for a supplier with LIVE coordinator access.
- **A fifth bottom tab, Events** (and the same row on the laptop rail) — only while they run ≥ 1 event, live:
  `/vendor-dashboard/events` lists them upcoming first, a status line each, ⓘ "An event leaves this list when its hosts
  turn your access off, or after the event." Vanishes at the next render when access ends; a refused read hides it.
- **Customers › the couple › Open their event** beside Chat (+ a "Coordinator" pill), both customer-card shells, only
  for an event THIS person runs.
- **Inside the event** — one slim dark line "Coordinating <names> · ‹ Back to your shop", only for a viewer the event
  layout admitted through the coordinator's seat who has a shop.

LIVE = an accepted, non-removed `wedding_planner_external` seat, inside the shipped window
(`permissionsWithinWindow`), with the hosts' one switch ON (`coordinatorHasHostAccess`) — one pure rule,
`lib/events-you-run.ts`, read once per request through the person's own session (`lib/events-you-run.server.ts`).
**No new permission**: every door is `/dashboard/<id>`, admitted by the event layout's shipped check (unchanged);
no migration; +0 server actions. Maps: nav registry slots `vendor.bottom-nav.events` + `vendor.sidebar.events`,
the Ugat screens map, `delegate-access-window.test.ts` READERS, the supplier lab (`?s=coord-today|coord-events|
coord-customer`, `&none=1`) and `/dev/home-lab?coord=1`. Guards: `lib/events-you-run.test.ts`,
`app/vendor-dashboard/coordinator-door.test.ts` (14 sabotages, each red).

SPEC IMPACT: None new — implements the approved DECISION_LOG 2026-10-28 row as drawn. Deviations for the owner (in the PR body): the status line is the day ("In 45 days" · "Today" · "Wrapping up · access until …"), not a "3 things need you" count — no such count exists for a coordinator yet; the prototype's "NEW" marker on the Today eyebrow is not drawn; the Events tab has no first-visit spotlight yet.
