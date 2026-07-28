## 2026-07-27 · feat(vendor-services): early-booking discounts become LEAD-TIME TIERS picked by the couple's event date

Owner ruling 2026-07-27 (`DECISION_LOG` "🧙 THE MAKER IS ZERO STEPS" row, ruling ②):
*"give discounts depend on how far their event is? 12 months, 6 months?"* — an
editable ladder, and **the couple's event date picks the tier automatically**,
shown live on their side ("Booked 6+ months ahead · −10%"), never negotiated in
chat.

`discount_type = 'early_booking'` already shipped (migration `20270502342558`);
the only thing missing was the **threshold**, which until now could live only as
free text in `conditions_md` — unreadable by code. This adds it as data.

- **Schema** — `20271017262879_vendor_service_discount_lead_time_tiers.sql`:
  `vendor_service_discounts.min_lead_months INT NULL CHECK (>= 1)`. Several
  `early_booking` rows on one service, each with its own threshold, ARE the
  ladder (12+ → −15%, 6+ → −10%). `NULL` = no threshold ⇒ legacy behaviour
  byte-for-byte unchanged. `save_vendor_service` re-created (same 9-arg
  signature) so the WIZARD write path persists the field too — without it a
  vendor would author a ladder and silently get thresholdless rows. Migration
  ends in a POST-CONDITION `DO` block asserting the column, its type, its
  nullability, its CHECK, and the RPC's use of it (the `schema_migrations`-lies
  pattern).
- **Resolver** — `lib/vendor-lead-time-tier.ts`: pure, dependency-free,
  `now` injected as a parameter. `applicableLeadTimeTier(discounts, eventDate,
  now)` returns the rung with the LARGEST `min_lead_months` ≤ months-away
  (months = days / 30.44), with a 1e-6-month epsilon so an exactly-on-the-boundary
  event date cannot lose its tier to float noise. Thresholdless rows are not
  rungs and are never downgraded.
- **Couple-side display** — `pickBestDiscount` (`lib/vendor-service-public.ts`)
  gained an options bag `{ eventDate, now }`. With an event date in context the
  qualifying rung is NAMED ("Booked 6+ months ahead · −10%") and rungs the couple
  is too late for are dropped outright rather than dangled; anonymous viewers
  keep today's best-tier badge, worded "Save up to 15% booking early". Every
  non-ladder discount keeps its exact previous copy. Wired through
  `/v/[slug]` (services gallery badge, one clock per render) and the inquiry
  composer's price line, which spells out that the vendor still confirms the
  final price. **DISPLAY ONLY** — no charge path, package/lock pricing or
  booking-fee code was touched.
- **Maker** — `DiscountsEditor` shows a "Book ≥ N months ahead" field only for
  Early Booking rows and always emits an index-aligned hidden
  `discount_min_lead_months[]`, so all three mount points (wizard, My Shop
  inline edit, My Shop add-new) post it and the component's public props stay
  stable for the canvas maker being built in parallel.
- **Parser** — `parseDiscountRows` extracted verbatim out of the `'use server'`
  `services/actions.ts` into `lib/vendor-discount-rows.ts` so it can actually be
  unit-tested. Same validation order, same vendor-facing error strings. The new
  field is defensive: blank / non-numeric / fractional / out-of-range degrades to
  `null` instead of bouncing a whole service save, and is forced to `null` on
  every non-`early_booking` type.
- **Auto-reply** — a ladder used to read as two indistinguishable "Early
  Booking" offers; the rung is now named ("15% off (Early Booking, 12+ months
  ahead)"). It only STATES the ladder — the tier is still picked by the couple's
  date on their card, not in chat.
- **Tests** — 47 new unit assertions across `vendor-lead-time-tier.test.ts`
  (exact boundaries at 12.0 / 11.99, largest-rung-wins, null/legacy rows,
  garbage thresholds, `now` injection), `vendor-service-public.test.ts` (tier
  named for an in-context date, anonymous "up to" fallback, unchanged copy for
  the other four types), and `vendor-discount-rows.test.ts` (round-trip incl.
  missing/garbage months, index alignment). Plus 8 DB assertions in
  `tests/db/vendor-discount-lead-time.db.test.ts` (column exists + nullable,
  CHECK rejects 0, legacy rows insert with NULL, RPC round-trip). Neutralisation
  verified: flipping the resolver to the SMALLEST applicable rung fails 9 named
  tests showing the wrong percent.
- **Exposure freeze** — the new column adds exactly one baseline line,
  `col public.vendor_service_discounts.min_lead_months anon=SIU authenticated=SIU`,
  identical to its 12 sibling columns on the same table (the grants are
  table-level and pre-existing; RLS still gates the rows). Baseline regenerated
  in this change with that one-line diff.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — early-booking
discounts are **lead-time tiers**: a vendor authors a ladder of `early_booking`
rows on one service, each with a `min_lead_months` threshold, and the couple's
event date selects the single applicable tier automatically (largest threshold
they satisfy), named on their service card and in the inquiry composer. It is
display-only and never negotiated in chat; the vendor still confirms the final
price in their reply.
