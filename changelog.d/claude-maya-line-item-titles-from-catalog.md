## 2026-07-30 · fix(billing): the Maya/QR line-item title comes from the catalog row that priced it

`/api/v1/billing/initialize-maya` resolved the line-item **price** from the admin
catalog (`platform_retail_catalog_v2` / `platform_package_catalog`, fail-closed —
no row, no sale) but resolved the line-item **title** from a module-level
`TITLE_BOOK` map that, unlike its sibling `PRICING_BOOK`, was **never fenced
behind `SETNAYAN_DEMO_MODE`**. So the hardcoded names ran on the real charge
path: a couple reaching Maya / manual-QR checkout for `PAPIC_SEATS` was billed
for "Papic Professional 5 Seats Pass" — a retired product — and that name is
what an admin then reconciles the payment reference against. `PAPIC_GUEST`
printed "Papic Guest AI Gallery", also not the shipped name.

The price and the name now travel on the same row, so they cannot drift apart
again: both reads `select('title, retail_price_php')`, and `is_active` filtering
is unchanged. A row is billable only if it carries **both** a price and a title —
a titleless row is refused rather than falling back to a hardcoded name or to
`service_code.replace(/_/g, ' ')`, which would leak an internal identifier onto a
payment record. The fail-closed posture is preserved end to end: the à-la-carte
path 400s on an unresolvable code, the bundle path still throws.

`TITLE_BOOK` is **kept, not deleted**, and reduced to demo-only — the one code
path that genuinely has no catalog row is `SETNAYAN_DEMO_MODE=1`, which by
design never touches the DB (it is where `PRICING_BOOK` / `BUNDLE_BOOK` already
live). It is now read from a single `demoLine()` helper whose only two call
sites are `if (DEMO_MODE)`. The demo-fenced `PRICING_BOOK` values and the
`INDOOR_BLUEPRINT` entries are untouched — the holistic Maya/pricing pass owns
those.

Also fixed in passing on the same line of code: a non-numeric catalog price used
to flow through as `NaN` and render `"NaN"` in the Maya payload, because
`NaN <= 0` is false and the empty-order guard let it past. The new resolver
refuses it.

New pure module `apps/web/lib/maya-catalog-line.ts` (`catalogLineFromRow`) holds
the fail-closed decision with no I/O — the same pure/I-O split as
`order-charge-math.ts` beside `order-charge-authority.ts` — plus
`apps/web/lib/maya-catalog-line.test.ts` (9 tests) pinning both the rule and the
demo fence, so a future session cannot quietly put a hardcoded name back on the
charge path.

SPEC IMPACT: None. No price, SKU, or entitlement changes — only which field the
displayed product name is read from. The retired names in `TITLE_BOOK` survive
as demo-only strings of record.
