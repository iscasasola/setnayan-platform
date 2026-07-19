## 2026-07-02 · perf(vendor-dashboard): client-side month nav on My Customers calendar

The month arrows on `/vendor-dashboard/customers` were server links
(`?m=YYYY-MM`), so every click did a full server navigation that re-ran the
page's entire read set — ~12 Supabase (Singapore) round-trips (pools, all
bookings, blocks, day-states, waitlist, chat threads, unread count, services,
team, the `vendor_payday_installments` RPC, an admin `events` venue lookup, and
`enrichTeamWithUsers`) — even though only **two** of them (`fetchVendorDayStates`
+ `fetchVendorWaitlist`) actually depend on the visible month. On a slow link or
a cold serverless invocation the calendar just sat frozen (no per-swap loading
state), which is what the "why is changing the month so slow" report was.

**Fix** — month navigation is now client-driven:

- New server action `fetchCustomerCalendarMonth(month)`
  (`app/vendor-dashboard/customers/actions.ts`) resolves the vendor from the
  session and returns **only** that month's `dayStates` + `waitlist` (two
  parallel queries). The client never passes a vendor id.
- `CustomersCalendar` now receives the month-independent inputs (`pools` /
  `bookings` / `blocks`) once on first paint plus `todayIso` + `initialMonth`,
  holds `month` + `data` in state, and rebuilds any month locally with the pure,
  client-safe `buildCustomerCalendarMonth` (its module is `import type`-only — no
  Supabase / `server-only`). Arrow clicks are `<button>`s driving a
  `useTransition`; the grid dims + a spinner shows on the month label while the
  swap is in flight, and the URL is kept in sync via `history.replaceState`
  (shareable/refreshable, no router round-trip). Falls back to a full navigation
  if the action returns null (session gone).
- `page.tsx` drops the now-dead `monthLabelOf` / `shiftMonth` server helpers and
  the `prevHref` / `nextHref` / `monthLabel` props (label + shift moved into the
  client component).

Net: an arrow click goes from ~12 round-trips + the payday RPC + two sequential
admin queries down to two lightweight month-scoped reads, and the
payments/messages/services cards + customer list no longer re-fetch when paging
months.

Two follow-on refinements:

- **Per-mount month cache.** `CustomersCalendar` memoizes each built month in a
  `useRef<Map>` (seeded with the first-paint month), so paging back to an
  already-seen month is instant — no re-fetch, no spinner. Cache lifetime is the
  mount; any booking mutation navigates away to the day-manage route and
  remounts with a fresh cache, so intra-session staleness is a non-issue.
- **Trimmed client payload.** The builder only reads `poolId` / `bookedDate` /
  `eventName` from bookings and `poolId` / `source` / `startDate` / `endDate`
  from blocks, so `buildCustomerCalendarMonth` now takes narrow `CalendarBookingInput`
  / `CalendarBlockInput` (`Pick<>`) types and `page.tsx` ships only those fields.
  Raw block client-contact fields (`clientName` / `clientContact` / `clientNote`)
  no longer cross the wire into the client payload. A full row is still
  structurally assignable, so the server's own builder call is unchanged.

Typecheck + lint + prod build all clean.

SPEC IMPACT: None. Pure performance refactor of shipped vendor-dashboard code;
no schema, pricing, SKU, product-behavior, or copy change. The calendar renders
byte-identical data (same `buildCustomerCalendarMonth`, same six-state taxonomy) —
only how a month change is fetched moved from a full page reload to a scoped
client fetch.
