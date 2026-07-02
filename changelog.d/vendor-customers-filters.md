## 2026-07-02 · feat(vendor-dashboard): wire the My Customers calendar filters

The Type / Service / Agent selects on `/vendor-dashboard/customers` were
decorative — `FilterSelect` rendered options with no `onChange`, so choosing one
changed nothing (only the Heat map toggle was live). This wires them, honestly,
to what the data supports.

Data-availability triage (verified against the schema):

- **Service** — FEASIBLE. Bookings carry `pool_id`; pools carry `categories`.
  Selecting a service narrows the pools fed to the day builder to those that
  carry that category, so consumption / booked / full recompute for that
  schedule.
- **Type** — FEASIBLE via enrichment. `vendor_schedule_pool_bookings` has no
  `event_type`, so `page.tsx`'s existing admin `events` lookup (already run for
  venue) now also selects `event_type`; it's threaded onto each booking as an
  optional `eventType`. Selecting a type narrows which booked events count
  toward booked/full days. No extra query.
- **Agent** — NOT WIREABLE. There is no booking→team-member column or assignment
  table (`vendor_schedule_pool_bookings` has none, no ALTER adds one). Rather
  than ship a dead dropdown, the Agent select is **disabled** with a hint
  ("Per-agent scheduling isn't tracked yet"). It lights up for free once
  booking→agent assignment exists.

Implementation — all client-side, no re-fetch on filter change:

- `customers-calendar.tsx` restructured to cache **raw** per-month inputs (day
  states + waitlist) instead of pre-built grids, and derive the visible grid via
  `useMemo(build(filteredPools, filteredBookings, blocks, …))`. Filters are pure
  state; changing one re-derives instantly. Preserves the client-driven month
  nav + per-mount cache from #2580/#2586 (the cache is now filter-agnostic).
  Vendor-level marks (blocked / locked / whitelist / waitlist) aren't event- or
  service-scoped, so they stay visible under any filter; an active-filter context
  line makes a narrowed (possibly empty) grid self-explanatory.
- `customers-filter-bar.tsx` — `FilterSelect` gains `value` / `onChange` /
  `disabled` / `title`; active selects get an accent style.
- `vendor-customers.ts` — `CalendarBookingInput` gains optional `eventType`
  (ignored by the builder).
- `page.tsx` — passes raw `dayStates` / `waitlist` (replacing the pre-built
  `initialData`) + event_type-enriched bookings.

**Scope:** filters narrow the CALENDAR only. The customer list + summary cards
are server-rendered and don't react to these client filters — deliberately left
as a follow-up (would need lifting them into a client wrapper or a re-fetch),
flagged rather than silently skipped.

SPEC IMPACT: Behavior only, no schema/pricing/SKU change. Vendor "My Customers"
calendar Service + Type filters are now functional; the Agent filter is disabled
pending a booking→team-member assignment model (a future schema decision — surfaced
for owner sign-off). List/summary-card filtering is a noted follow-up. (Corpus
DECISION_LOG append deferred — this worktree is isolated from the shared spec
corpus; this fragment carries the record.)
