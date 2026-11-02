## 2026-07-01 · refactor(vendor-customers): rename "Service status" card → "Service coverage"

On the vendor **My Customers** page, the third summary card is reframed from a
binary on/off "Service status" to **Service coverage** — the services you cover
— matching the prototype's coverage concept (the covered-service chips on My
Services). The per-service pill changes from "Active" to "Covered" and the empty
state now speaks to setting coverage rather than posting a live service.

Label/copy + variable rename only (`serviceStatus` → `serviceCoverage`); the
underlying data (your active services + full-date capacity) is unchanged.

**Files:** `app/vendor-dashboard/customers/page.tsx`.

SPEC IMPACT: None. Terminology alignment with
`03_Strategy/Vendor_Dashboard_AllScreens_2026-07-01.html` ("Service coverage").
No pricing/SKU/scope change.
