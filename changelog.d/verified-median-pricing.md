## 2026-07-24 · feat(vendor): verified median pricing + price card (dark)

Ships the CORE of "verified median pricing" — the median of a vendor's DECLARED
prices from their LOCKED bookings becomes their verified market price, used to
position them to couples. Self-correcting: under-declaring reprices you down and
floods you with unservable leads; over-declaring loses leads. All DARK behind
`NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED` (default OFF) — no couple- or vendor-facing
change until the flag flips.

- **Pure math** — `lib/verified-median.ts`: `computeVerifiedMedian()` (median of
  qualifying locks) + `medianPhp()` + `roundToTypicalBand()`. Guards: min sample
  count **3** (`MIN_MEDIAN_SAMPLE`; below it → "not established", never a number)
  and excludable non-market bookings (comp/barter/₱0/promo dropped before the
  count check; non-positive/non-finite prices dropped regardless). 19 unit tests
  (odd/even counts, below-min, excluded, single booking, all-excluded, dup
  values, rounding).
- **Price source** — `lib/verified-median-read.ts`: median over
  `event_vendors.total_cost_php` on CONFIRMED (`status IN
  CONFIRMED_VENDOR_STATUSES`, i.e. 'contracted' onward = the lock), LINKED
  (`linked_vendor_profile_id`), non-excluded, positive rows. Chosen over reading
  accepted `vendor_proposals` directly because `respond_vendor_proposal()` (PR3,
  migration 20270201864104…20270201674389) already writes the accepted amount
  INTO the couple's `event_vendors` row, and the slot-lock path writes the same
  row — so `event_vendors` is the single consolidated, ~one-per-(event,vendor)
  couple-confirmed store (no double-count from multiple proposals). Read via the
  admin client returning ONLY de-identified aggregates (mirrors
  `price-position.ts`), so no couple identity / per-row price leaves the server.
- **Migration** — `20270928100000_event_vendors_market_median_exclusion.sql`:
  adds `event_vendors.excluded_from_market_median BOOLEAN NOT NULL DEFAULT FALSE`
  + a partial index. Idempotent, non-breaking, no RLS/policy change.
- **Vendor surface** — `/vendor-dashboard/performance` card (exact median +
  count + own spread) so the vendor sees what their declarations produce.
- **Couple surface** — `/v/[slug]` "Typical price" card: the vendor's OWN median,
  rounded (`roundToTypicalBand`, privacy), self-referential. Honors the vendor's
  hide-prices-publicly toggle. **Competition-law guard:** shows the vendor's own
  median only — NO cross-vendor comparison, NO "below/above market" language,
  never labels a vendor cheap/expensive.
- Budget-matching integration (filtering couples to a band) is a documented
  FOLLOW-UP; per-category median scoping and an admin control for the exclusion
  flag are also follow-ups.

SPEC IMPACT: This is a PRODUCT/POSITIONING BET, not a pure refactor. It
introduces a new couple-facing price signal ("typical price" from a vendor's
locked bookings) and a new vendor-facing "verified market price" — a monetizable
positioning primitive the corpus calls the biggest idea in the vendor model.
Logged at the bottom of `DECISION_LOG.md` (2026-07-24). Load-bearing choices to
surface for owner sign-off: (1) price source = `event_vendors` confirmed+linked
rows, (2) min sample = 3, (3) excludable via `excluded_from_market_median` with
the intended setter being an ADMIN (no couple control shipped), (4) public figure
is rounded. Flag stays OFF pending owner approval.
