## 2026-07-02 · feat(vendor-dashboard): Locked QR service picker is DB-driven leaf offerings, not the hardcoded enum (PR5)

Answers the owner's question ("Service is taken from the Leaf Services on Service
Coverage and not hardcoded?"). It was the coarse `VendorCategory` enum
(hardcoded in `lib/vendors.ts`) rolled up from coverage. It now lists the
vendor's own `vendor_services` rows — their real leaf offerings, DB-driven.

- **Migration `20270426216000`** adds `vendor_service_id` (FK `vendor_services`,
  nullable, ON DELETE SET NULL) to `vendor_locked_qr_tokens` — records WHICH leaf
  offering was locked. Additive, idempotent.
- **`LockedQrGenerator`** service `<select>` is now fed the vendor's leaf services
  (title, or category-label fallback); the option value is a `vendor_service_id`.
- **`issueLockedQr`** resolves the chosen service back to its parent `category`
  (still required for `event_vendors`) and stores `vendor_service_id`. A vendor
  with no published services falls back to their coverage categories (value =
  category key), so the picker is never empty — no hardcoded taxonomy either way.
- Both Locked-QR entry points (My Shop inline + standalone `/invite`) fetch the
  services list via `fetchVendorServices`.

SPEC IMPACT: Vendor dashboard § Locked QR — service picker is now taxonomy-DB
driven (honors the "menus come from the taxonomy DB, never hardcoded" rule).
Logged in DECISION_LOG.md. ⚠ Scoped to the Locked QR (the owner's concern).
Shortlist-QR URL leaf param + shortlist-add leaf scoping remain the coarse
category — a separate downstream flow, flagged for a follow-up. ⚠ Migration NOT
yet applied to prod; code degrades gracefully (legacy tokens keep NULL).
