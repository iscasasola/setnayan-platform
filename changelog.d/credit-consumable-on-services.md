## 2026-07-26 · feat(packages): credit is CONSUMABLE on the vendor's other services

Owner-locked 2026-07-26: **"credits can be consumables to other services, but
not deductables… can be used on other services of the vendors as well."**

The **not-deductible** half shipped in `20271010903954` (the refund policy was
retired, so unspent credit can never come off the price). This is the
**consumable** half — which the engine already supported and **nothing wired**:
`computePackageCredit` accepts `additions` + `catalogue`, and no production
caller passed either. Credit could only be spent on upgrades *inside* the
package.

### The committed price — and why not `starting_price_php`

New column `vendor_services.credit_price_centavos`. From the build spec, and it
is the whole reason the column exists:

> *"`starting_price_php` is the synced FLOOR … never a committed price —
> debiting credit against it is exactly the failure we set out to delete, moved
> one table over."*

`starting_price_php` is the "from ₱X" marketing anchor, recomputed whenever a
vendor edits a bracket. Spending real credit against it would debit a couple at
a number the vendor never agreed to for that purchase.

**NULL = not purchasable with credit, and that is the default.** A vendor's
catalogue does not silently become spendable; each service is opted in with a
committed number. `> 0`, not `>= 0` — a ₱0 credit price would hand a service
over for nothing, and "not for sale on credit" is what NULL already says.

### Two hard rules, enforced not trusted

1. **Same vendor only.** The catalogue query is scoped to the package's
   `vendor_profile_id`, so credit can never be spent against a *different*
   vendor's service — that would be Setnayan moving money between two
   businesses, which this model explicitly does not do (0% commission, vendors
   settle off-platform).
2. **The price comes from the DB.** The client sends service ids and quantities
   only. An id with no committed price is dropped at the query *and* refused by
   the engine (`unknown_addition`) rather than priced at zero.

Additions are also **refused outright when the credit flag is OFF** — silently
dropping them would tell the couple the booking simply cost less.

### What the tests pin

Spending credit **drains the pool and does not move the price**; overspend
**bills the excess rather than discounting**; an unpriced addition **fails
closed**; quantity multiplies the **committed** price. Falsifiable — removing
either guard turns one red.

**4175 unit + 390 DB green**, `tsc --noEmit` exit=0, `next lint` exit=0.
Baseline gains one fact (the new column, same shape as its siblings).

> ⚠ Caught in review by the migration replay: my first draft addressed
> `vendor_services.service_id`, which does not exist — the PK is
> `vendor_service_id`. Same class as this morning's `label`/`option_label` bug.
> The replay refused to apply rather than letting it reach a column-name 400.

SPEC IMPACT: implements the M2 `credit_price_centavos` item. **No UI** — there
is no catalogue picker yet, so nothing sends `credit_additions` in practice;
the server, schema and money rules are ready for one. Still an owner decision:
signed deltas (downgrade credits).
