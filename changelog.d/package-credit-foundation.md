## 2026-07-26 · feat(packages): package CREDIT model — schema + pure engine (FLAG-DARK)

Foundation for the owner-locked package credit model (2026-07-26). A vendor
package carries a credit POOL shaped like a hotel F&B credit: dropping an
inclusion returns that item's value to the pool, the package PRICE stays
fixed, so credit changes WHAT you get, not what you pay. Credit spends across
the vendor's WHOLE catalogue, a line can be a CHOICE (N alternatives, pick
one, each with its own price delta over the default), REQUIRED is a separate
axis from CHOICE, unspent credit is expiring-or-refundable per package, and
overspend is allowed and billed on the EXISTING apply-then-pay rail.

**No UI, no lock-path change, no money path touched.** This wave lands the
schema, the pure engine, and its tests only.

### 🚨 The invariant

A REQUIRED line's value must NEVER enter the available-credit pool — a couple
must never be shown credit they cannot actually free. Enforced structurally:
credit accrues only from ids in `removedItemIds`, and a removal naming a
required line is refused outright, so there is no "subtract it back out"
step to get wrong. Asserted directly and by exhaustion (the pool can never
exceed budget + the OPTIONAL lines).

### Schema — `20271006413374_vendor_package_credit_required_and_choice_options.sql`

- `vendor_package_items.is_required` BOOLEAN NOT NULL **DEFAULT FALSE** — the
  flag-OFF hold. Distinct from `is_default_included`, which only ever meant
  "ticked by default".
- `vendor_packages.unspent_credit_policy` TEXT NOT NULL **DEFAULT 'expiring'**
  (`expiring` | `refundable`). The default is today's math exactly.
- NEW `vendor_package_item_options` — one row per alternative, with a stable
  `option_id` PK, a `price_delta_centavos >= 0`, a `CHECK` pinning the DEFAULT
  option's delta to 0 (the price already includes it), a partial UNIQUE index
  for one-default-per-line, `is_available` for retiring an alternative without
  orphaning stored selections, and RLS mirroring the sibling package tables
  (public read while active, vendor-owner/admin write).
- Chose a CHILD table over a self-referencing `parent_item_id` group: every
  shipped reader of `vendor_package_items` does an unfiltered
  `where package_id = …`, so alternatives-as-items would immediately be priced
  and cascaded into extra `event_vendors` rows the moment the migration landed
  — a behaviour change before any flag flip.
- Value-preserving backfill: zero-value anchor lines (the seed's fake
  required-ness workaround) are promoted to `is_required = TRUE`. They already
  freed ₱0, so no pool, total, or booking figure can move.

### Engine — `apps/web/lib/package-credit.ts`

`computePackageCredit({ pkg, removedItemIds, chosenOptionIds, additions })` →
available / spent / remaining credit, overspend, forfeited-vs-refunded, and
the booking total. Pure and total (no env, clock, or I/O — runs under
`tsx --test`). Fails CLOSED on unknown ids, duplicate selections, removing a
required line, an un-picked required choice, an unavailable option, a
non-included removal, and negative / non-integer / absurd money. The legacy
`computeCustomization` is untouched, so `lockPackage` and `lock-modal.tsx`
compile and behave exactly as on main.

### Flag

`NEXT_PUBLIC_PACKAGE_CREDIT` via `apps/web/lib/package-credit-flag.ts` —
LAUNCH flag, ON only for the exact string `'true'`. Nothing reads it yet by
design; the UI/lock wave reads this function rather than minting a second var.

### Verification

- `npx tsc --noEmit` inside `apps/web` → exit 0.
- 51 new unit tests + 10 new DB tests (full migration replay in PGlite); full
  suites green: 3706 unit, 202 DB.
- Every behavioural claim FALSIFIED: reverting the required-removal guard
  failed 4 tests; the required-choice guard 2; the unspent-policy branch 2;
  the catalogue-additions term 2; the overspend term 3; the DB `is_required`
  default + delta CHECKs 4.

### Cross-wave dependency (NOT fixed here — reported)

`lockPackage` sets `event_vendors.total_cost_php` from each line's
`replacement_value_centavos`, and the booking-fee cascade derives its 5% from
that column. Under the credit model a line's real cost is
`replacement_value + chosen option delta`, so once the flag flips the lock
path must re-derive per-line cost from the engine's `selections` or the
booking fee will under-charge on every premium pick. Owned by the lock/money
wave.

SPEC IMPACT: None in this PR (schema + pure engine only, flag-dark). The
owner-locked credit model itself is logged in the corpus `DECISION_LOG.md`
by the wave that ships the customer-visible behaviour.
