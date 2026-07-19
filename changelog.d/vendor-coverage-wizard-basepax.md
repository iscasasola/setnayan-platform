## 2026-07-02 · feat(vendor-services): wire base_pax into the wizard's atomic RPC (rework follow-up)

Closes the `base_pax` gap flagged in PR 4b — the guided "create a service" wizard can now set flat/pax pricing, matching the legacy card actions.

- Migration `20270428382392_save_vendor_service_add_base_pax.sql` — `CREATE OR REPLACE save_vendor_service` adding `base_pax` to the INSERT + UPDATE arms (re-defines the latest copy verbatim; compiled against the prod schema in a rolled-back txn).
- `commitVendorService` `p_fields` carries `base_pax`.
- Wizard "Base covers (guests)" input in the pricing-rules step.

tsc clean.

SPEC IMPACT: None.
