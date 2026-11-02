## 2026-08-27 · feat(vendors): the night-before supplier email (S5, ships OFF)

Built and wired, switched off. A booked supplier's own registered account gets
an email the night before their event saying tomorrow is the day, with a
suggested call time and a link straight into their event page — but only once
`SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED=true` is set, which nobody has done yet.

- `lib/supplier-night-before-email-flag.ts` — the kill switch. Opt-in
  (`=== 'true'`, default OFF): the owner gate ("may we email a supplier
  automatically at an address they never gave us?") is still open.
- `lib/supplier-night-before-email-core.ts` / `-email.ts` — the copy/arithmetic
  split from the DB job, same shape as `anniversary-emails[-core].ts`.
  `formatVenueClock` reads `event_schedule_blocks.start_at` (and
  `deriveCallTime`'s output) by its own stored digits, `timeZone: 'UTC'` — no
  Manila conversion, which is the exact mistake that once emailed a 2 PM
  ceremony as 10 PM.
- Wired into `runDailyEmailJobs()` (the existing cron-free traffic-driven
  runner) rather than the `after()` branch on `/{slug}` that only fires for a
  scheduled-launch reveal — that branch is true for approximately no page
  loads and would have shipped the job dead with every test green.
- Reads only `event_vendors.linked_vendor_profile_id` (a real registered
  vendor account) and that account's own signup email — never
  `event_vendors.contact_email`, which 44 of 45 prod supplier rows hold as a
  name the couple typed with no account behind it.
- New table `supplier_night_before_email_log` (migration
  `20271174500643`) — insert-first idempotency claim per
  (event_vendor_id, event_date), taken BEFORE the send, admin-only RLS.
  Mirrors `anniversary_headsup_log`.
- 9 unit tests (flag defaults + the wall-clock formatting rule + the email
  builder), all mutation-shaped to catch the specific traps named in
  `WHATS_NEXT_Suppliers_Room_SESSIONS_2026-08-27.md` § S5.

SPEC IMPACT: None — the owner gate this ships behind is already recorded in
the corpus register (`WHATS_NEXT_Suppliers_Room_SESSIONS_2026-08-27.md` § S5);
this entry just marks the build half done and still flag-dark.
