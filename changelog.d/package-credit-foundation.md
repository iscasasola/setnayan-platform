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
step to get wrong. Asserted directly and **by exhaustion over the full power
set of all four lines (16 subsets)** — 4 accepted, 12 refused. The earlier
"by exhaustion" test enumerated only the OPTIONAL ids and therefore still
passed with the guard deleted; it now fails with it.

### Schema — `20271006413374_vendor_package_credit_required_and_choice_options.sql`

- `vendor_package_items.is_required` BOOLEAN NOT NULL **DEFAULT FALSE** — the
  flag-OFF hold. Distinct from `is_default_included`, which only ever meant
  "ticked by default".
- **`CHECK vendor_package_items_required_implies_included`** — a required line
  must also be included. Without it, `is_required = TRUE` +
  `is_default_included = FALSE` was authorable and the engine resolved it as
  "keep the line": the couple was DELIVERED an inclusion nobody charged for,
  and the cascade priced an `event_vendors` row off its
  `replacement_value_centavos`, inflating the 5% platform-fee base with
  revenue never collected. Wrong in both directions; now refused at the DB and
  mirrored in the engine as `invalid_package`.
- `vendor_packages.unspent_credit_policy` TEXT NOT NULL **DEFAULT 'expiring'**
  (`expiring` | `refundable`). The default is today's math exactly.
- NEW `vendor_package_item_options` — one row per alternative, with a stable
  `option_id` PK, a `price_delta_centavos >= 0`, a `CHECK` pinning the DEFAULT
  option's delta to 0 (the price already includes it), a partial UNIQUE index
  for one-default-per-line, `is_available` for retiring an alternative, and RLS
  mirroring the sibling package tables (public read while active,
  vendor-owner/admin write).
- **`CHECK vendor_package_item_options_default_is_available`** — the DEFAULT
  option can never be retired. The engine falls back to the default for any
  kept optional choice line the couple did not pick, and errors are
  all-or-nothing, so one retired default made the WHOLE package uncomputable
  for every couple. A vendor doing the thing `is_available` exists for must
  not be able to take a live package down.
- Chose a CHILD table over a self-referencing `parent_item_id` group: every
  shipped reader of `vendor_package_items` does an unfiltered
  `where package_id = …`, so alternatives-as-items would immediately be priced
  and cascaded into extra `event_vendors` rows the moment the migration landed
  — a behaviour change before any flag flip.
- Value-preserving backfill: zero-value anchor lines (the seed's fake
  required-ness workaround) are promoted to `is_required = TRUE`. They already
  freed ₱0, so no pool, total, or booking figure can move. The statement is now
  **lifted out of the migration file at test time and replayed against
  seed-shaped data**, so its WHERE clause is actually exercised (the replay
  corpus has no seeded packages, so it previously ran against zero rows).

### Engine — `apps/web/lib/package-credit.ts`

`computePackageCredit({ pkg, removedItemIds, chosenOptionIds, additions,
catalogue })` → available / spent / remaining credit, overspend,
forfeited-vs-refunded, and the booking total. Pure and total (no env, clock,
or I/O — runs under `tsx --test`). Fails CLOSED on unknown ids, duplicate
selections, removing a required line, an un-picked required choice, an
unavailable option, a non-included removal, and negative / non-integer /
absurd money. The legacy `computeCustomization` is untouched, so `lockPackage`
and `lock-modal.tsx` compile and behave exactly as on main.

Corrections applied in this wave:

- **The result tuple now RECONCILES.** `creditRefundCentavos` is capped at the
  base price it comes off, and whatever the price cannot absorb is reported as
  `forfeitedCreditCentavos` — previously a pool larger than the price reported
  the FULL pool as refunded while the total merely floored at 0 (a ₱1,000,000
  package with a ₱5,000,000 pool claimed a ₱50,000 discount of which ₱40,000
  never existed, with `forfeited = 0` asserting nothing was lost). Two
  identities are now asserted over a 300+ case matrix:
  `bookingTotal === basePrice + overspend − creditRefund` and
  `refund + forfeited === remainingCredit`.
- **Additions can no longer carry a client price.** `CreditAddition` is now
  `{ addition_id, quantity }` only; prices arrive separately in a
  server-resolved `catalogue`. An addition with no catalogue entry is
  `unknown_addition` (fail-closed), never priced at 0. The "never trust a price
  from the client" rule used to live only in a doc comment.
- **`option_on_excluded_item`** — choosing an option on a line that is not
  included is now an error. It previously returned `ok: true` with the pick
  silently absent from `selections`, so a stored upgrade whose line the vendor
  later un-ticked would vanish with no error and the booking would be written
  without it.

### Known limits, stated honestly (not fixed here)

- **Retiring an option does NOT protect a stored selection.** The migration
  comment claimed it did. The engine rejects ANY chosen option with
  `is_available = FALSE` and cannot tell a NEW pick from one already stored on
  a locked booking, so today retirement bricks a stored selection exactly as
  hard as deletion. Teaching it to resolve stored selections needs an extra
  input and belongs to the booking/lock wave. The comments now say so; the new
  DEFAULT-must-stay-available CHECK bounds the blast radius.
- **`keptItemIds` deliberately diverges from the shipped `keptItems()`.** The
  shipped helper filters ONLY on removal, so a line the vendor never ticked
  still cascades into `event_vendors` today; the credit engine excludes it.
  Both behaviours are now pinned by a test so the lock wave must choose rather
  than silently inherit — switching the cascade to `keptItemIds` would drop
  rows main creates right now.
- **`'refundable'` semantics are UNVERIFIED and await owner sign-off.** Read
  literally, it refunds the whole unspent pool including the base consumable
  budget the sticker price already charged for: on the seeded ₱1,400,000 /
  ₱200,000-consumable package, a couple who customizes NOTHING pays ₱1,200,000
  and still gets every inclusion — and removals cut the price, contradicting
  the model's own "changes WHAT you get, not what you pay" pillar. It is
  implemented as the owner worded it and PINNED BY TEST rather than quietly
  reinterpreted. Safe today: the column defaults to `'expiring'`, which
  reproduces the shipped math to the centavo, and no surface can set
  `'refundable'`.

### Flag

`NEXT_PUBLIC_PACKAGE_CREDIT` via `apps/web/lib/package-credit-flag.ts` —
LAUNCH flag, ON only for the exact string `'true'`. Nothing reads it yet by
design; the UI/lock wave reads this function rather than minting a second var.

### Verification

- `npx tsc --noEmit` inside `apps/web` → **exit 0** (baseline before the fixes
  was also exit 0; run directly, not via turbo, not piped).
- 64 engine tests + 3 flag tests + 14 DB tests (full migration replay in
  PGlite). Full suites green: **3741 unit / 0 fail**, **211 DB / 0 fail**.
- Every behavioural claim FALSIFIED by reverting the fix and observing red:
  required-implies-included guard → 2 fail; refund clamp → 2 fail;
  `option_on_excluded_item` → 1 fail; the required-removal invariant guard →
  **6 fail (was 4 — the two vacuous "INVARIANT" tests now bite)**;
  `unknown_addition` fail-closed → 2 fail; per-package refundable branch → 4
  fail; DB `required_implies_included` CHECK → 1 fail; DB
  `default_is_available` CHECK → 1 fail; the backfill's zero-value guard → 2
  fail.

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
