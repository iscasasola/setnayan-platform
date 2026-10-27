## 2026-10-28 · feat(check-a-date): `/v/[slug]/dates` — a shop's calendar for couples: Available · Not bookable, ask with Undo, plus the "Check a date" QR

Owner, verbatim: *"it will only show dates not bookable and available dates. and will not show if there are current
inquiries on that day."* → *"index.html approve"* (prototype `prototypes/check_a_date_2026-10-28/`).

- **New public page `/v/[slug]/dates`** (no sign-in to look). One month grid — the app's `CalendarGrid` (kind 31) — with
  only two states. **Not bookable** = the shop's own month through the ONE shipped derivation
  (`buildCustomerCalendarMonth`, which folds blocks through `lib/not-available.ts`): an all-day closure (one-off or
  repeating), the shop's own hard hold (`locked`), or every schedule at its "How many a day" (Setnayan bookings +
  bookings from outside). Past days and days > 24 months out are not offered. No reason, no name, no count is shown.
- **Reads** (`lib/check-a-date.server.ts`): service role (a stranger has no RLS read on blocks/holds/bookings), six
  narrow window-bounded reads; only the answer (Not-bookable days, per service when the shop runs separate schedules)
  reaches the page. A refused or incomplete read shows "couldn't load" — never all-Available.
- **Ask** (Available day): Ask about this date → services (multi-select; per-service Not bookable when the shop's
  services sit on different schedules) → event (sign in at THIS step, date + services kept in the address; one event on
  that day is auto-picked, several = a PickMenu, none = "Start an event on <date>" via the shipped create path with
  `next=` back here) → ONE ask through the SHIPPED `startServiceInquiry` (one chat per event + shop, services as
  `thread_service_interests`, the date in the opening note). **Undo**: Send holds 5 s before anything is sent.
- **Not bookable** day → Try another date.
- **QR**: Supplier › QR codes gets a third code, "Check a date · free" → `https://<site>/v/<slug>/dates`, drawn by
  `renderUrlQrSvg` (the `qrcode` library, same renderer as the Shortlist code).
- Guards: `app/v/[slug]/dates/no-inquiry-reads.test.ts` (walks every module the route reaches at run time — 108 — and
  refuses any that names a chat/inquiry table or RPC; the only server-action door that does is the shipped Send; the
  month builder is never handed its asks list), `lib/check-a-date.test.ts`, `lib/check-a-date-qr.test.ts` (renders,
  rasterises and scans the code back with `jsqr`). Each sabotaged red once.

SPEC IMPACT: DECISION_LOG row "✅📅 CHECK A DATE — APPROVED; BUILD `/v/[slug]/dates`" — built (the row said the landing
does not exist yet). No migration, no new server action.
