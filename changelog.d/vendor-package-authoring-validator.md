## 2026-07-26 · feat(packages): the authoring validator (PR-1 of the authoring wave)

Vendors have never been able to build a package. Prod holds **zero** `vendor_packages`
rows because no application code inserts one — the couple-side configurator that ships
at `/v/[slug]` renders for nothing. This is the first piece of the surface that fixes it.

`validatePackageDraft()` is the gate authoring writes through, so the first package that
ever exists is already well-formed. Pure module — no I/O, no env, no clock.

**Deliberately does NOT duplicate the row-level rules.** Migration `20271006413374`
already enforces every single-row invariant as a CHECK constraint — required-implies-included,
`price_delta >= 0` (owner-locked: *"swap will only add, since swap starts at the cheapest
variant"*), the default option costs nothing, a sold-out option cannot be the default. A
validator copy of those would be a second source of truth that drifts.

What it adds are the CROSS-ROW invariants a CHECK cannot see:

- a choice line needs **≥2** options, and **exactly one** standard — zero leaves the couple
  without a baseline, two make the package price ambiguous and the credit engine picks arbitrarily
- not every option may be sold out
- no two options sharing a label (case- and whitespace-insensitive)
- package price **> 0** and an integer number of centavos (owner-locked: *"there should never
  be an option to have a service at 0"*)
- package price **≥ the sum of required lines** — otherwise the credit engine could refund
  more than the package ever cost
- spendable budget ≤ package price, and a flexible package must actually have a budget,
  or the couple is shown credit that buys nothing

Returns every problem at once with `itemRef`/`optionRef` so a long form highlights all
fixes rather than one at a time.

- `apps/web/lib/package-authoring.ts` (new)
- `apps/web/lib/package-authoring.test.ts` (new — 22 tests; two rule mutations each turn a test red)

SPEC IMPACT: `Vendor_Card_Actions_Findings_2026-07-26.md` §3b — begins closing the
"vendor authoring surface does not exist" gap. Server actions + UI follow in PR-2/PR-3.

### PR-2 (same branch) · the server actions

`savePackage` / `setPackageActive` / `deletePackage`, behind
`NEXT_PUBLIC_PACKAGE_AUTHORING` (strict `=== 'true'`, default OFF).

Four guards on every write: **flag** → **ownership** (`vendor_profile_id` matched on every
query, never taken from the payload) → **shape** (the validator) → **edit scope**.

The edit-scope rule is the one that only bites after launch: a package with a live booking
is a CONTRACT. `event_vendor_packages.customizations.removed_item_ids` and
`event_vendors.package_item_id` both point at item rows, and the locked total derives from
`total_price_centavos` — so restructuring underneath a booking silently re-prices a couple's
contract and orphans their provenance links. `editScopeForPackage` freezes a booked package
to metadata; `structuralChanges` decides what counts, conservatively (a description typo
counts, because the alternative is a diff subtle enough to let a real re-price through).

Consequences: items are replaced wholesale on save, which is safe *only* because that path
is unreachable once a booking exists. A new package starts `is_active = false` so a
half-built one never appears on a live card. Publishing re-validates, so a draft saved
before a rule tightened cannot go live broken. A booked package can be unlisted but never
deleted — including for released bookings, which are still the couple's record of a real
transaction.

- `apps/web/lib/package-authoring.ts` — `editScopeForPackage`, `structuralChanges`, `isEditAllowed`
- `apps/web/lib/package-authoring-flag.ts` (new)
- `apps/web/app/vendor-dashboard/packages/actions.ts` (new)
- 32 tests total; full unit suite 3789/3789.
