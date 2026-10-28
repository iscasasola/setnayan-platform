## 2026-10-29 · feat(supplier): ready a supplier to run an event and finish her shop (owner, 29 Oct)

Owner, verbatim (29 Oct ~04:25 PHT): *"I am planning to invite the stylist in tomorrow … fully access the event hub.
Create schedules. Check guestlist, fix seat plan and fix her shop and service card"* · *"This is similar to adding
them as a cohost which is already in effect. They only need a way to access it and have that menu for them on their
account."*

**S1 · "Events you run" for a live CO-HOST seat too.** `seatRunsTheEvent` (`lib/events-you-run.ts`) now also draws the
door for a joined, not-removed full co-host seat (`seatIsFullCohost`, the SQL `seat_is_full_cohost` mirror), listed
until the same seven days after the event a coordinator's window gives. The read
(`lib/events-you-run.server.ts`) asks `.in('role_subtype', RUN_SEAT_ROLES)`. Each row carries `seatWord`
(Coordinator · Co-host) for Today's line and the customer card's pill; after the event a co-host row says "Wrapping
up", never "access until" (a co-host's access does not end). A limited helper (`viewer`) gets no door. No new
permission path, no migration. Guards: `lib/events-you-run.test.ts`, `app/vendor-dashboard/coordinator-door.test.ts`.

SPEC IMPACT: DECISION_LOG row "SUPPLIERS READY TO RUN AN EVENT AND FINISH THEIR SHOP" (corpus).
