## 2026-07-02 · feat(vendor-services): coverage as a first-class entity + priced add-ons + base-pax (schema)

Schema foundation for the vendor Services rework (owner-approved 2026-07-02, "build them all now, do not invent"). New migration `20270426250948_vendor_coverages_addons_base_pax.sql` — additive, idempotent, compiled against the prod schema in a rolled-back transaction:

- **`vendor_coverages`** — first-class coverage = a taxonomy leaf (`canonical_service`, the ~201 grain from `getTaxonomy().map`) a vendor serves, plus per-coverage `event_types`. Can exist with zero service cards. Vendor-org RLS via `current_vendor_profile_ids()` + console-admin read (copied from `vendor_locked_qr_tokens`); `event_types` guarded by the existing table-agnostic `validate_vendor_event_types()` trigger + nonempty CHECK + GIN index.
- **`vendor_service_addons`** — priced optional extras on a service card (`from_price_php`, NULL = inquire). Public-read gated exactly like `vendor_service_links` (anchor active + vendor published); vendor + console-admin write.
- **`vendor_services.base_pax`** — guests the starting price covers (pairs with the existing `added_pax_price_php` surcharge).
- **`vendor_services.coverage_id`** — links a card to its coverage. Nullable; legacy rows resolve via `category`; `ON DELETE SET NULL` so removing a coverage never silently destroys a card.

Grain = canonical leaf (~201); coverage is authoritative and will **drive Explore** — the `vendor_profiles.services` + `event_types` union sync, the `save_vendor_service` RPC wiring, the coverage/service server actions, and the merged UI land in the following PRs. No backfill (near-greenfield founder marketplace; the handful of legacy coarse-category listings are re-declared through the reworked flow).

**Owner sign-off flagged:** public-id type letters `V` (coverage) / `O` (add-on) are content-free labels reused across tables (only `Z` is unshipped) — confirm or reassign.

SPEC IMPACT: DECISION_LOG.md gets a new row (coverage first-class · canonical-leaf grain · coverage drives Explore · per-coverage event types · priced add-ons · base_pax). Iterations 0022 (vendor dashboard) + 0006 (vendors management) describe the old derived-coverage model and will be corrected as the code PRs land.
