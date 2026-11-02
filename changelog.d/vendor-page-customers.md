## 2026-07-01 · feat(vendor-dashboard): build the My Customers page to the finalized prototype

Replaced the `/vendor-dashboard/customers` stub (6-menu proto-shell destination)
with the full "My Customers" surface, faithfully matched to the finalized design
prototype in the editorial `--m-*` palette (white cards on alabaster paper,
12px radius, skeletal Lucide icons only). Every figure is wired to a LIVE,
vendor-scoped source — no prototype sample numbers were hard-coded.

- **Heading** "My Customers" + subtitle "Your calendar, book of business, and
  money in."
- **Filter row** — All types / All services / All agents selects (populated from
  the vendor's real `event_types`, service categories, and `vendor_team_members`)
  + a live Heat map toggle + an info tooltip legend. The three selects are
  presentational for now (no per-booking type/service/agent index exists to
  filter on yet) and default to "All …"; they never fabricate an option. The Heat
  map toggle is fully live — it dims non-booked/full days so busy stretches pop.
- **Month calendar (centrepiece)** — a full month grid with prev/next server-
  driven month nav, each day cell showing the date + a 6-state status chip drawn
  from the SAME taxonomy the Calendar page uses (`vendor_calendar_day_states` +
  `vendor_schedule_pool_bookings` + `vendor_calendar_blocks` + capacity), plus the
  couple `vendor_date_waitlist` folded in as a Waitlist chip, plus per-day event
  labels. States: Full (obsidian) · Booked (sage green) · Locked (gold) ·
  Whitelist (lilac) · Blocked (gray) · Waitlist (amber). Day cells link to the
  existing `/vendor-dashboard/calendar/[date]` manage route.
- **Three summary cards** — (1) Ongoing payments "₱collected / ₱expected this
  month" with a green progress bar, summed from the frozen installment plan the
  `vendor_payday_installments()` RPC returns (this-month due dates only;
  unresolved-amount installments are counted, never invented); (2) Messages —
  N new (`count_unread_message_threads()`) · M conversations (chat threads); (3)
  Service status — per active `vendor_services` row: Active + "full N dates" this
  month computed from bookings/external-client blocks vs pool capacity.
- **Customers list** — one row per booked / in-conversation event: initials
  avatar + event name + "date · venue" + a status pill (Booked / In conversation)
  + a right-aligned money note (Balance ₱X / Fully paid / Downpayment in / Quote
  pending) from the per-event installment position. Booked events come from the
  vendor's pool bookings; date + venue enrich via the admin client (events are
  couple-RLS); in-conversation rows from accepted chat threads. Empty/zero states
  render where a source is genuinely absent (e.g. couple hasn't set a venue).

New pure helper `lib/vendor-customers.ts` (`buildCustomerCalendarMonth` ·
`summarizeMonthlyPayments` · `computeEventMoneyPositions`) + two client
components (`customers-calendar.tsx` filter-hosting grid · `customers-filter-bar.tsx`).

Verified: `pnpm run typecheck` clean · ESLint on all changed files (0
errors) · `lint:navicon` · `lint:retired` · full `pnpm run build` (the
`/vendor-dashboard/customers` route compiles with its client-reference manifest).

SPEC IMPACT: None. (Prototype fidelity + live-data wiring for one existing route;
reuses existing queries/RPCs. No pricing, SKU, schema, or product-decision change.)
