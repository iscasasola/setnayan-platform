## 2026-08-21 · feat(nav): the Studio group stays in the rail inside an event

Owner, comparing the sidebar before and after opening a wedding: *"when we
enter an event it becomes suite and other features are added there. This seem
wrong since we lose the consistency of the concept. What we want is for that
Studio to still show on the sidebar, but now it is link to that event."*

The seven named products taught a stranger what Setnayan makes and then
vanished at the moment somebody finally had somewhere to open them — replaced
by one row under a second name.

- The Studio group no longer collapses when an event context is present. The
  Marketplace category group still does (fifteen supplier categories beside a
  wedding's sections is the list the drawing rejected).
- The event layout names its own event to the rail, so the rows open THAT
  wedding's tools instead of falling back to the board-as-picker for anybody
  with more than one event. The id is matched against the person's own
  organiser events inside the resolver before a single row points at it.
- The group ends in one **All services** row → the services hub for that event.
  The event menu's own hub row is dropped from the DESKTOP RAIL only — the same
  builder feeds the phone's bottom bar, which carries no Studio group.
- New `lib/studio-hub.ts` owns the one `NEXT_PUBLIC_SUITE` branch that decides
  the hub's address, so the rail row and the nav builder cannot land on
  different pages.

Guard: `app/_components/frontdoor/studio-follows-you-in.test.ts` — 8
assertions, each mutation-checked by occurrence count.

⚠ NAMED DEBT: the Studio rows stay UNLIT. Lighting them needs one match list
spanning the shell and `EventRailContext`; run separately the two double-light
(`3D Plan` opens `/seating/lab`, and the event menu's `Seat plan` row
prefix-matches `/seating`). Unlit is today's behaviour, so nothing regresses.

SPEC IMPACT: None — this is a rail composition change, no pricing, SKU or
schema movement. The vocabulary lock ("Studio" = the things you make) is
unchanged and is what the change restores inside an event.
