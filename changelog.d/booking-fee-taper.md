## 2026-07-26 · feat(fees): the 5% / 1% booking-fee TAPER (owner-locked 2026-07-25)

Implements `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 3 to the exact
formula in `Vendor_Monetization_BUILD_PLAN_2026-07-25.md` § "EXACT fee-taper
spec". The code had been sitting on the superseded 2026-07-24 flat 5%.

| | FROM (2026-07-24) | TO (owner-locked 2026-07-25) |
|---|---|---|
| Rate | flat 5% | **5% on the first ₱100,000, then 1% above** |
| Floor | ₱50 | ₱50 (**survives** — the build plan is explicit) |
| Cap | none | none |

**The owner's own worked examples, all asserted:**
₱60,000 → ₱3,000 · ₱300,000 → ₱7,000 · ₱1M → ₱14,000 · ₱10M → ₱104,000

### Why it matters beyond the arithmetic

A flat 5% with no cap made large bookings punitive (₱1M → **₱50,000**) and
re-opened the large-ticket under-declaration incentive the old ₱4,000 cap had
been bought to close. The 1% tail softens the top instead — ₱1M now pays
₱14,000.

### Two properties asserted, not assumed

- **Continuity** at ₱100,000 — ₱5,000 computed either way, no cliff for a
  booking to sit just under.
- **Monotonic** — swept in ₱137 steps across the band edge, so declaring more
  can never pay less. This is the anti-gaming property; a naive two-tier formula
  inverts here.

### Both mirrors, and a guard so they can't drift

`apps/web/lib/booking-fee.ts` **and** SQL `public.booking_fee_centavos`
(migration `20271009120000`). The migration carries a **post-condition** that
re-checks all four worked examples plus continuity, the floor and monotonicity —
it refuses to apply if the SQL disagrees with the locked model. A new DB
assertion also compares the SQL to the TS to the centavo across seven amounts,
so the two implementations cannot silently diverge.

`BOOKING_FEE_SCHEDULE_VERSION` bumped to `2026-07-25-taper5-1-over-100k` (the
build plan requires it). Charges record the version they were priced under, so
**nothing is re-priced retroactively** — and prod holds 0 ledger rows and 0
charges, so there is nothing to re-price in practice.

**KEPT unchanged, per the build plan:** the sourced-only gate, first-5-free, the
LOCK trigger, the verified-gate, every idempotency guard.

### Also fixed: the stale header that caused this

`booking-fee.ts` opened with *"SUPERSEDED IN PLAN, NOT YET IN CODE … the taper
is the payment session's job"*. That note is why the flat rate survived this
long. Rewritten to state the current model, with the standing warning that no
header comment is the pricing source of truth — the corpus is.

**Tests:** 14 updated/added across 4 files (unit + DB). Falsifiable — reverting
the taper to a flat rate turns **4 unit red and 1 DB red**, the latter via the
SQL↔TS parity assertion. 4008 unit + 308 DB green, `tsc --noEmit` exit=0.

SPEC IMPACT: code now matches `Vendor_Monetization_Model_LOCKED_2026-07-25.md`
§ 3. ⚠ **Still outstanding from the same "Supersedes / reconcile" list**, NOT in
this PR: (a) the lock RPC hardcodes `attribution := 'sourced'`
(`20270927120000:165`), so a BYO/vendor-invited client would be charged at lock
despite the model saying imports are free forever — worth confirming against the
build plan's claim that "fee is already sourced-only in code"; (b) free-5 must
count **bookings, not events** (owner reaffirmed 2026-07-26: *"free first 5
booking on any events"*), which needs the `booking_fee_ledger`
`UNIQUE (vendor_profile_id, event_id)` rework; (c) `'website'` still sits in
`SOURCED_INQUIRY_SOURCES` though the owner ruled a vendor's own link is an
IMPORT.
