## 2026-10-28 · fix(plans): a free shop holds any number of bookings — the free-tier booking cap is removed

Owner, verbatim (money rule): *"Remove the limit."* The free-tier 3-concurrent-booking cap contradicted his
2026-10-23 ruling — free gets every work tool; paid is reach · scale · time.

What the cap was: `enforce_free_tier_booking_cap_trg` (BEFORE INSERT/UPDATE on `event_vendors`, migration
20271001120000, rewritten 20271009160000) refused a free/verified shop's new move into contracted · deposit_paid ·
delivered once it held 3 other such events, behind `platform_settings.free_tier_booking_cap_enabled` (DEFAULT FALSE).
Nothing ever wrote TRUE, so it was INERT — a loaded switch, not a live refusal. `vendor_agree_to_lock` turned its
message into `fully_booked`, which `lib/lock-answer-notice.ts` worded as "move to a paid plan to take on more".

- Migration `20271293507816_a_free_shop_holds_any_number_of_bookings.sql`: drops the trigger, the function and the
  switch column (plain DROPs, no CASCADE), and re-creates `vendor_agree_to_lock` as 20271223386305's body minus the
  two-line `fully_booked` branch; post-conditions assert all of it plus the RPC's grants and its other refusals.
- App: the `fully_booked` sentence is gone from `lib/lock-answer-notice.ts`; the unused cap modules
  `lib/vendor-free-tier-booking-cap.ts` + `-flag.ts` (+ test) are deleted (no importer ever existed).
  ⚠ `NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP` may still be set in Vercel — it now reads into nothing; removing it is an
  owner/dashboard step.
- Untouched on purpose: the shop's own hold limit per date (`soft_hold_limit_reached`), a card's "Bookings per day",
  time-slot capacity, `enforce_vendor_whitelist_per_date`, and every reach / scale cap.
- Guards: new `tests/db/a-free-shop-holds-any-number-of-bookings.db.test.ts` (a free shop holding three live
  bookings agrees to a 4th as a real `authenticated` supplier and it books; a 5th books; NEUTRALISED: the old trigger
  re-installed in a rolled-back transaction refuses the same fixture). `every-lock-answer-has-a-sentence` pins
  `daily_limit_reached` where it pinned `fully_booked`; stale lines dropped from `anon-rpc-surface.baseline.txt`,
  `gates-have-handles.baseline.txt` and `platform-settings-anon-revoke`; exposure baseline regenerated.

SPEC IMPACT: `DECISION_LOG.md` 2026-10-28 "SUPPLIER PLANS — FREE GETS EVERY WORK TOOL" and the same-day row "THE
FREE-TIER 3-CONCURRENT-BOOKING CAP IS REMOVED" (corpus 3ca944de · 96363cb0, already on the corpus main) — this PR is
that removal. No further corpus edit.
