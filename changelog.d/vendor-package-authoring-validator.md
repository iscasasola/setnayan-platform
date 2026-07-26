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
