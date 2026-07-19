## 2026-07-02 · feat(vendor): service-card redesign Phase 1 — schema + discount cut-over

Phase 1 (schema-first) of the finalized quote-based service-card redesign
(owner-approved; see `DECISION_LOG` 2026-07-02 + the prototype memory). Reconciled
to the shipped schema — REUSES `vendor_service_attributes` (refinements),
`vendor_service_addons`, `vendor_service_links` (comes-with),
`vendor_service_payment_schedules` + Locked-QR (downpayment), and
`vendor_coverages.event_types`. Adds only the six genuine gaps.

**Migration `20270502342558_vendor_service_card_pricing_media_discounts.sql`:**
- `vendor_services` +columns: `pricing_basis` (fixed | per_pax | per_hour),
  `per_pax_price_php`, `min_pax`, `hour_base_php`, `min_hours`, `extra_hour_php`,
  `crew_meal_included`, `transport_included`, `transport_flat_fee_php`,
  `showcase_video_r2_key`, `showcase_photo_r2_keys` (≤5). `starting_price_php`
  stays the synced "from ₱X" anchor for Explore/budget.
- New child tables (RLS at create, mirroring `vendor_service_addons`):
  `vendor_service_price_brackets` (Fixed pax tiers; one open bracket = flat),
  `vendor_service_inclusions` (FREE items + worth ₱), `vendor_service_discounts`
  (MULTI-discount; couple sees the best).
- `vendor_coverages.faiths` TEXT[] (mirrors event_types; app-validated vs faith_vocab).
- **Discount FULL CUT-OVER:** backfilled the single legacy `discount_*` into one
  `vendor_service_discounts` row (unit heuristic: rate ≤ 100 ⇒ %, else ₱), then
  DROPPED the four legacy columns.
- `save_vendor_service` RPC: 6-arg → 9-arg (adds `p_discounts` / `p_brackets` /
  `p_inclusions` replace-all + the new scalar columns; no more discount_* writes).

**Code cut-over (same PR — the dropped columns force it):**
- `lib/vendor-services.ts` — removed discount_* from the type/select; added
  `fetchDiscountsByService` + `VendorServiceDiscount`.
- `services/actions.ts` — create/update write the discount to the new table;
  `commitVendorService` passes the new RPC args.
- `services-manager.tsx` — off-peak nudge / row badge / edit-form defaults read
  the fetched discounts (single-discount UI preserved; list editor = Phase 3).
- `explore/page.tsx` — both off-peak-deal queries now read
  `vendor_service_discounts` (inner join keeps the active-service constraint).

New public_id type letters `K`/`N`/`D` (brackets/inclusions/discounts) —
content-free, flagged for owner sign-off (mirrors the V/O sign-off in 20270426250948).

Verified: tsc (0) · next lint (0 errors) · migration-timestamp guard · prod build.

SPEC IMPACT: net-new vendor-services schema (see `DECISION_LOG` 2026-07-02 and
`project_setnayan_service_card_prototype_final`). Phases 2–4 (coverage UI · fast
service-card build · Explore surfacing) follow. Single-discount UI still ships; the
multi-discount list editor + base-price bases + media + serves UI land in Phase 3.
