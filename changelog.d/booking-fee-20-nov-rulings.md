## 2026-11-20 · fix(fees): supplier booking-fee billing follows the owner's 20 Nov rulings

Migration `20271356196197_the_20_nov_booking_fee_rulings.sql` + the TypeScript twins.

- **The schedule.** 5% of the first ₱100,000, **3%** after (was 1%), **locked at ₱100,000** (new
  `platform_settings.booking_fee_cap_php`). An **unverified** shop pays the head rate on the whole booking, locked
  too (`booking_fee_flat_centavos`, `booking_fee_centavos_for`, `unverifiedBookingFeePhp`). Every number is read from
  `platform_settings`; the tail-rate setting moves to 3.00 in the migration (ALTER first, then the one UPDATE).
  Schedule version `2026-11-20-taper5-3-cap100k`. The bill sentence now says "never more than ₱100,000".
- **No free first booking.** `booking_fee_free_booking_limit()` → 0, `FREE_BOOKING_LIMIT` → 0. A ledger place frozen
  free before this stays free. Supplier-brought clients keep the 16 Nov import rule already in
  `booking_fee_attribution_for` (unchanged).
- **Every 100,000th booking fee on Setnayan is free.** One-row `booking_fee_platform_counter` (RLS on, service-role
  only) + `booking_fee_take_platform_number()` (one `INSERT … ON CONFLICT DO UPDATE … RETURNING`: row-locked, exact,
  a rolled-back booking gives its number back). `booking_fee_charges.platform_fee_number` (UNIQUE) +
  `free_by_platform_count`. N is `platform_settings.booking_fee_free_every_nth` (100000). Existing fee charges are
  numbered so the count is Setnayan's real count. It sits above the free booking fee ticket, so the ticket is kept for
  the next booking; an amendment never re-bills it.
- **Tickets** stay auto-claimed (unchanged SQL); copy says so and never "redeem".
- **Screens and receipts:** the forecast before Agree, the Plan row, the waived-fee list on Booking fees / Money /
  the client page, and the emailed receipt name the flat rate, the lock and Setnayan's every-Nth fee; no fee surface
  promises a free first booking. Admin pricing shows the lock and the count.
- `decideLockFee` is rewritten as the arm-for-arm mirror of the new RPC. The add-on "free window"
  (`vendor-addon-first5-free.ts`) is decoupled and unchanged at one booking pending an owner ruling.

Tests: `tests/db/the-20-nov-booking-fee-rulings.db.test.ts` (new, fails without the migration),
`lib/the-20-nov-fee-rulings.test.ts` (new), and the fee suites updated to the new rule.

SPEC IMPACT: Billing now matches DECISION_LOG 2026-11-20 rows "BOOKING FEE: 5%… 3% AFTER, LOCKED AT ₱100,000", "FREE
BOOKING FEE TICKETS ARE AUTO-CLAIMED", "EVERY 100,000TH BOOKING FEE IS FREE", "…COUNTED ACROSS ALL OF SETNAYAN" and
"BILLING MUST FOLLOW THE RETIRED COPY" — each of which says "Not built"; the corpus rows should be marked built when
this merges. Open for the owner: whether the add-on free window follows the fee to zero.

### Ship review fixes (20 Nov, FIX-FIRST)
- origin/main merged; the migration is re-allocated to `20271356196197` with `SET LOCAL lock_timeout = '5s'`.
- **An amendment re-prices on the schedule the booking was locked on.** Each primary charge stores `fee_basis` (flat or taper, head/tail rate, band, lock), stamped at insert by `booking_fee_charges_stamp_basis`. Charges made before this change are backfilled from their `schedule_version` and the settings as they stood before the 3% update. `booking_fee_rederive_lock_fee` prices with `booking_fee_centavos_on_basis`. DB test 7: a verified ₱1M booking locked at ₱32,000, verification lapsed and the tail moved to 4%, then a ₱1,000 change → a ₱30 top-up. The old line gave ₱18,050 (shown red once).
- "First booking is free" is removed from the help row (`SUPPLIER_HELP_ROWS`), the suppliers feature page (EN + TL) and the invite door (`DOOR_FEE_LINE`). Guard 3 is widened to cover them (shown red once).
- The forecast now names a "free booking fee ticket", not a "badge reward" (DECISION_LOG 20 Nov "FREE BOOKING FEE TICKETS ARE AUTO-CLAIMED").

### Ship re-review fixes (20 Nov, FIX-FIRST 2)
- **The free-first-booking promise is retired at its source.** `FIRST_BOOKING_ON_US`, `FIRST_BOOKING_ON_US_CLAUSE`,
  `FIRST_BOOKING_FREE` (`booking-fee-lock.ts`) and `FIRST_BOOKING_FREE_LABEL` (`open-shop-more-services.ts`) are
  DELETED. Every page that read them now says the owner's free rule from `booking-fee-who-words.ts`: the home fee
  line, For Suppliers (page, fee ⓘ, how-we-earn block, meta description), the claim promise (`commission-promise.ts`
  → pricing, suppliers landing, home vendor benefits, `vendor/claim`), the invite message, open-shop (service cards,
  plan sheet lead, claim door), For Coordinators, help (two articles — "is my first booking free?" now answers No),
  llms.txt, the AI answers, the Papic quote row and the December post.
- **Guard 3 walks all of `app/` and `lib/`** (comments stripped) for the retired constant names AND the sentence
  (EN + TL). Three files may still say it, each for a stated reason (the frozen-place receipt sentence, the help
  question, a dev lab); a listed file that stops saying it fails until its line is removed. Shown red on a planted
  `PLAN_LEAD`.
- ⚠ Open PRs that import the deleted constants (#8050 For Suppliers) must take the who-words instead when they rebase.

### Ship re-review 2 (20 Nov) — the last live "first booking free" lines
- For Coordinators (fc-i11) no longer says "Your first bookings through Setnayan are free"; the features page's suppliers hero and c25 say "none when you are the first to bring the event".
- Admin › Verify's same-business note no longer speaks of an unused free first booking: it says a match means not a new business or a new account, lists today's free bookings (own import as a new account · first import onto a new event · a new shop from a couple's Find invite · every 100,000th fee · a badge ticket — specs 1abf35bd) and keeps the old free booking in the past tense only. The held-back sentence for a frozen place is past tense too.
- Guard 3 widened: plurals, sentences that wrap across JSX lines, "the first one (is) free" and "free first booking". Shown RED on the old tree (5 files), green after.
