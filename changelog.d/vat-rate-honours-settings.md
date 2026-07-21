## 2026-07-21 · 🔴 fix(billing): stop charging 12% VAT that Setnayan is not registered to collect

Owner, seeing ₱2,800 on an "Add to event" button for a ₱2,500 SKU: *"why did it become 2800 from 2500?"*

**Because the code hardcoded 12% VAT and ignored the configured rate — which is 0.**

```
platform_settings.default_vat_rate_pct  =  0.00   ← set by the owner, correctly
lib/receipts.ts DEFAULT_VAT_RATE_PCT    =  12     ← what pricing actually used
```

`default_vat_rate_pct` was **write-only**: `/admin/settings` renders a field for it and saves it,
and **no pricing code ever read it back**. `orders.ts`, the checkout action and the checkout drawer
all imported the hardcoded constant instead.

### Why this matters beyond the ₱300

Setnayan is **non-VAT registered** — a sole prop under ICASA ENTERPRISE on the 8% flat option, with
VAT only at the ₱3M combined-gross tripwire (`0026_bir_tax_compliance` says "V1 launches non-VAT").
So the 12% was not merely an overcharge: it presented as VAT a tax Setnayan is not registered to
collect, on every customer SKU in the catalog — Setnayan AI ₱1,499 was instructed at ₱1,678.88,
Live Studio ₱2,500 at ₱2,800.

### The fix

- **`getEffectiveVatRatePct(supabase)`** — reads `platform_settings.default_vat_rate_pct`.
  **Falls back to 0, never 12**: an unreachable settings row must not invent a tax, and 0 is the
  correct answer for a non-VAT taxpayer. When the ₱3M threshold is crossed, set the field — no code
  change.
- **`computeVatFromBase(base, rate)` now REQUIRES the rate.** A defaulted rate is precisely how a
  hardcoded 12 outlived a configured 0. Making it required turned the compiler into the audit: it
  found every implicit-tax call site (orders totals, admin payments ×2, the orders page, checkout,
  the drawer, `VoucherBlock`).
- `DEFAULT_VAT_RATE_PCT` → **`PH_STATUTORY_VAT_RATE_PCT`** (aliased for compatibility). It is a fact
  about the tax code, not a statement about what Setnayan charges.
- The `FALLBACK` settings row drops `12` → `0` for the same reason.
- The checkout drawer takes the rate as a prop resolved server-side, so the quoted figure and the
  charged figure cannot drift.

Vendor SKUs are untouched — `vendor_`-prefixed keys are all-in charm prices and were already
`vatInclusive`, ignoring the rate entirely. Tested at both 0 and 12.

**2407/2407 unit tests pass**, including new regression guards asserting that an omitted rate
charges nothing and that an explicit 12 still grosses correctly for the day registration is
required. Typecheck + production build clean.

⚠️ **No historical correction is attempted here.** Whether the 3 existing paid orders were
over-collected is an owner/accountant question, not a code one.

SPEC IMPACT: Makes the shipped code match `0026_bir_tax_compliance` ("V1 launches non-VAT") and the
2026-07-15 BIR strategy. `Pricing.md` should state plainly that catalog prices are what the customer
pays while VAT is 0.
