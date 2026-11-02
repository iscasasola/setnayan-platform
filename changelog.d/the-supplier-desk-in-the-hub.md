## 2026-08-27 · feat(event-hub): the supplier's desk opens inside the Event Hub on the day

**S3.** Owner, 2026-08-27, correcting the shape twice before a line was written:
*"we are redesigning not placing a new page"* and *"on the day. is the integration of the vendors
to the event's event hub. so we would still want to to be an event hub."* So there is **no new
route**: `app/[slug]/_components/vendor-doorway.tsx` — whose own docblock calls it *"A DOOR, NOT A
ROOM"* that *"carries NOTHING about the event"* — opens **in place** from the day the celebration
begins until 06:00 the morning after it ends, and is byte-identical to today on every other day.

What a booked supplier now gets on the celebration's own link, on the day: the venue and its
address, the running order live (the shared `RunOfShowHeader`, realtime), the whole running order
listed with the organiser's **private lines shown and marked** (owner ruling 2026-08-27 — the same
notes in a new place; he turned down *schedule only*), the live headcount, and their own tools.

- 🔒 **Authorization may use the service role; event CONTENT never does.** `/{slug}` renders with
  an admin client that is in scope on the very line the desk is resolved, and every RLS rule
  keeping a supplier out of the guest list and the private cues is inert there.
  `app/[slug]/_lib/supplier-desk.server.ts` opens its **own cookie-scoped client** and is asserted
  by source to contain no `createAdminClient`.
- 🔒 **Two gates, in order:** the existing `resolveVendorCapability` (a database-confirmed
  *committed* booking for a signed-in account — a cookie-only guest has no account) and
  `supplierDeskIsOpen`, which delegates to `getMenuLifecyclePhase`, the same rule the organiser's
  own day-of desk uses. One rule, so the two cannot drift.
- 🚨 **The brief's `timeline` is deliberately NOT used.** `get_vendor_event_brief` is
  `SECURITY DEFINER` and its timeline select carries **no visibility filter at all** — it includes
  `visibility = 'coordinator_only'` rows that the booked-supplier RLS policy excludes. Reading the
  blocks through the supplier's own session gets the narrower, correct set.
- 🪤 **Two columns answer one question.** The capability is minted off
  `event_vendors.linked_vendor_profile_id`; the brief and the schedule policy gate on
  `marketplace_vendor_id`. They agree in production today (measured 2026-08-27: 45 rows, **0**
  disagreements, **0** linked) and can diverge in the direction where the hub admits and the brief
  refuses — so a refused brief returns null and **the supplier keeps the door, never an empty
  desk**.
- 🔴 **`events.event_end_date` and `cleared_at` were being READ BEFORE THEY WERE SELECTED.**
  `app/[slug]/page.tsx` has cast for the end date since the lifecycle learned about ranges, and
  `loadEventShell`'s select named neither — so the multi-day arm of `getLifecyclePhase` has never
  once run. Both columns are now selected and typed. Safe by arithmetic: production holds 5 events,
  **0** with an end date and **0** cleared.
- ⛔ **The Papic capture tool does not move onto the celebration's page.** Its own page is day-bound
  and would bounce a supplier opening the desk the afternoon before, and the build plan holds the
  capture lane back until its INSERT policy is read out of production.
- ⛔ **No pinned bar.** The Hub's bottom edge already has five claimants; a sixth is what
  `lint-no-stacked-pinned-bars` exists to catch. Post and Flag stay on the floor console.
- 🔁 `moduleHref` moved out of the floor console into `lib/vendor-dayof-module-href.ts` so the desk
  and the console read ONE route map. `is_public` now travels on `RunOfShowBlock` (additive; the
  anonymous policy already filters the column away, so a guest's rows all read `true`).
- ⏭ **Named, not built — and deliberately:** a shop's **granted teammate** does not get the desk.
  Widening `resolveVendorCapability` would also widen `belongsToThisEvent`, the single boolean
  gating a keepsake story the organiser kept to the people of their day — a disclosure question,
  not a port. The room-to-room bridge for a supplier working two celebrations in one day, and the
  pre-day call-sheet state, are also not built here.

Guard: `app/[slug]/_lib/the-supplier-desk-is-in-the-hub.test.ts` — 17 assertions, every one
mutation-checked with the occurrence count printed before → after.

SPEC IMPACT: `WHATS_NEXT_Suppliers_Room_SESSIONS_2026-08-27.md` (S3 row) ·
`WHATS_NEXT_Vendor_Hub_And_Answers_2026-08-26.md` (Piece 7) · `DECISION_LOG.md` 2026-08-27.
