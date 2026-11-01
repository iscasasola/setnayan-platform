## 2026-11-01 · feat(suppliers): many venues per event · Where = chapters · coordinators everywhere (Step 4a) [migration]

Owner rulings 1 Nov (DECISION_LOG "MANY VENUES PER EVENT; SUPPLIERS PICK THEIR CHAPTERS; COORDINATORS ARE EVERYWHERE";
plan `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3 "Suppliers", §12 Step 4).

- **More than one venue.** The one-venue limit was the One per event switch on the `ceremony_venue` and `reception`
  categories (20271296971721). Migration 20271300598766 turns both off; the follow trigger re-keys bookings, so a
  second venue books like any supplier. Officiant, coordinator and host keep the limit.
- **Where = one or more chapters.** A supplier's Where is the chapters (top-level `event_schedule_blocks`) whose
  `responsible_vendor_ids` hold them — the column the Schedule lens and the call time already read (no link table, one
  fact). One writer: `set_supplier_where` (SECURITY DEFINER, gated on a host of the event), which refuses a coordinator, a
  non-chapter, and an empty Where for a booked supplier while chapters exist. No new server action (the route budget):
  the row calls the database door on the host's own session.
- **Booked › Team row**: second line names the chapters or says "Needs at least 1 chapter"; the count line adds
  "· N need a chapter"; the opened row has **Where ⓘ** — the shared Form Row + PickMenu with ticks, saving per tick in
  place. No chapter yet → "Add a chapter in Schedule first." Coordinators read "Every chapter", no dropdown.
- **In-house** (a venue's cake, catering, stations): each starts on the venue's chapters and has its own Where under
  the venue; a change is kept in the new `event_vendors.covered_where`.
- **On the quote** (`/proposals/[publicId]`): the couple sets Where there; the supplier who sent it reads it.
- **A change after booking tells the supplier** in the app: new notification type `supplier_where_changed`
  (20271301389353), written by `set_supplier_where` itself in the same statement (nothing can skip it), never email,
  never to the person who changed it; the notice says the price does not change by itself.
- Guards: `lib/supplier-where.test.ts`, `tests/db/many-venues-and-where.db.test.ts`; the hard-single DB tests now use
  the coordinator, since venues are no longer one per event.

SPEC IMPACT: `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3 "Suppliers" + §12 Step 4 — Step 4a marked built, with the
data model (Where on the chapter, `covered_where`, `set_supplier_where`) and the reading that "booked without Where is
refused" means a booked supplier can never be left on none (booking itself is not blocked).
