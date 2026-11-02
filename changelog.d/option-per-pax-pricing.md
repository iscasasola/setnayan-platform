## 2026-07-26 · feat(packages): choice options can be priced PER HEAD ("+₱150/head")

From `Vendor_Package_Credit_BUILD_SPEC_2026-07-26.md` M2: *"A flat delta cannot
express 'premium delicacy, +₱150/head', the normal PH catering upgrade."*

### Shipped as an ALTER, because M2's own form is a no-op

M2 writes this as `CREATE TABLE IF NOT EXISTS vendor_package_item_options`. That
table shipped in `20271006413374`, so the statement is a **silent no-op** — the
three new columns would never be created while the migration still reported
success. This is the `ALTER` form, keeping the **shipped** names
(`option_label`, `is_available`).

### The rule

`billable pax = max(event pax, min_pax)` — identical to the basis convention
package **lines** already use (`lib/package-line-pricing.ts`), so a premium menu
prices the same whether it is a line or an option.

| guests | ₱150/head, 100-head floor |
|---|---|
| 80 | ₱15,000 (floored) |
| 150 | ₱22,500 |

**The head count is server-resolved** (`resolveLivePax`) on both the lock and the
remove path. It multiplies money, so it never comes from the client.

### Guarded shapes

- **A missing head count still charges the minimum, never ₱0.** The failure this
  prevents: a caller forgets to pass pax and a ₱150/head upgrade becomes free.
- **The DEFAULT option must be free on BOTH bases.** The shipped CHECK covered
  only the flat delta; without this a vendor could make "+₱150/head" the standard
  option and every couple would silently owe the uplift.
- **Money must sit on the basis in force** — a per-head option carrying a flat
  delta (or vice versa) is refused rather than letting a reader pick a column.
- **A per-head rate cannot be negative.** Downgrade credits stay an open owner
  decision; per-head must not become the back door.

### 🔧 Also: the column guard now reads ALTERs

`vendor-packages.columns.test.ts` parsed only the `CREATE TABLE`, so it failed
the moment a column arrived by `ALTER` — which would push the next author toward
deleting the guard rather than trusting it. It now reads CREATE **plus every
later ALTER**, i.e. the table's real shape. Still falsifiable: restoring the
original `label` bug turns 3 red.

**Verification:** 7 new engine tests + 4 new DB constraint tests. **4141 unit +
388 DB green**, `tsc --noEmit` exit=0, `next lint` exit=0. Exposure baseline
gains 3 facts — the new columns, same `SIU` shape as their siblings, writes
still gated to the owning vendor by the table's `owner_write` RLS.

SPEC IMPACT: the per-head half of M2 is done. ⚠ **NOT done, and still an owner
decision: signed deltas (downgrade credits).** Both money columns are CHECKed
`>= 0`, matching `20271006413374`'s deliberate refusal. No UI yet — the authoring
editor and the lock modal still show flat deltas only; that is the next PR.
