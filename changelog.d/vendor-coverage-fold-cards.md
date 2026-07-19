## 2026-07-02 · feat(vendor-services): link service cards to their coverage (rework follow-up)

Service cards can now be assigned to a coverage (`coverage_id`), connecting the coverage-first model end to end.

- Migration `20270429678585` — `CREATE OR REPLACE save_vendor_service` adds `coverage_id` to the INSERT + UPDATE arms (compiled against prod, rolled back).
- `createVendorService` / `updateVendorService` / `commitVendorService` parse + write `coverage_id`.
- Service **edit form** gains a "Coverage" select (the vendor's own coverages); each card row shows its `Parent › Branch › Leaf` coverage path.

tsc + RPC compile + vendor-layout + ESLint clean.

**Follow-ups (documented):** server-side ownership validation of `coverage_id` (the UI only offers the vendor's own coverages; founder-only, low harm); a wizard coverage select; and full visual nesting of cards under coverage headers.

SPEC IMPACT: None.
