## 2026-06-20 · feat(vendor): atomic save_vendor_service RPC — foundation for the guided "create a service" flow

Vendor Services builder redesign (the diff-5 vendor-retention surface). Today a service card has FOUR independent save buttons writing four tables with no shared transaction — tap the wrong save and the other sections' edits vanish; the replace-all sets do delete-then-insert as separate awaited calls so a mid-failure wipes the set. This lands the load-bearing fix: one atomic write.

- **`supabase/migrations/20270208451790_save_vendor_service_atomic_rpc.sql`** (new, NOT yet applied) — `save_vendor_service(p_vendor_profile_id, p_service_id, p_fields jsonb, p_links jsonb, p_schedule jsonb, p_publish)` upserts the `vendor_services` row + replace-all `vendor_service_links` + `vendor_service_payment_schedules` in ONE transaction (function body = one implicit tx), so a partial loss is structurally impossible. Re-enforces the publish gate (perk required for is_active=true) as a server-of-record safety net.

Architecture: validation stays in TypeScript (reuse the existing `parse*` helpers — single source of truth, no SQL/TS drift); the RPC is a thin atomic writer taking already-validated JSONB. Tier caps stay in the TS action; time-slots (Enterprise-only + booking-lock interactions) keep their existing actions.

Full build spec: `Services_Builder_Create_Flow_Design_2026-06-20.md` (corpus). Remaining on this branch: the `commitVendorService` action, a generic Stepper, the 7-step wizard, create + edit routes, and rewiring the page (old card kept as a quick-tweak path per owner). Owner go-live step: apply the migration once the flow lands.

SPEC IMPACT: 0022 vendor services builder. Logged in `DECISION_LOG.md`.
