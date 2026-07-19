## 2026-07-02 · feat(vendor-services): flat/pax pricing (base_pax) on service cards (rework PR 4b)

`base_pax` (guests the starting price covers) on the service create/edit path — the "flat OR per-guest" half of the coverage rework's pricing. Pairs with the existing `added_pax_price_php` surcharge: leave `base_pax` blank for a flat price, or set it to price by pax ("covers N guests at ₱X, +₱Y per extra guest").

- `services/actions.ts` — `createVendorService` + `updateVendorService` parse `base_pax` (positive int or NULL, matching the DB CHECK) and write it.
- `page.tsx` — a "Base covers (guests)" input on the service edit form.

Note: the atomic wizard path (`save_vendor_service` RPC) does not yet write `base_pax` — settable via the card edit form for now; RPC wiring is a follow-up. tsc clean.

SPEC IMPACT: None (covered by the rework's DECISION_LOG row).
