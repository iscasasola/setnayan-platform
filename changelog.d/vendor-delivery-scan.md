## 2026-06-28 · feat(vendor): per-guest delivery scanning for pax-based services

Owner ask: a vendor whose service is delivered per guest (souvenir/favor vendor,
caterer, etc.) should scan each guest's personal QR at the event to confirm they
received it. **Operational only** — the vendor sees a count, never guest PII —
and enablement is an **explicit per-service toggle**. Generalizes the
couple/coordinator souvenir station (#2361) to the vendor side.

**Migration `20270317714480_vendor_per_guest_delivery`** (applied to prod +
ledger synced):
- `vendor_services.per_guest_delivery` BOOLEAN toggle (vendor-owned table → the
  vendor controls it; `event_vendors` is couple-write-only so it can't host it).
- `event_service_deliveries` table keyed to a booking (`event_vendors.vendor_id`)
  with RLS: vendor SELECT for their own bookings (count); couple+coordinator+admin
  SELECT for their event.
- `confirm_guest_delivery` / `undo_guest_delivery` SECURITY DEFINER — the vendor
  passes only `(booking_id, qr_token)`; the function enforces booking ownership
  (`current_vendor_event_vendor_ids()`), resolves the guest by token on that
  booking's event, and writes the row. **The vendor never reads `guests`** —
  this is the PII boundary. Returns operational data only (status + count).
- `list_vendor_delivery_bookings` SECURITY DEFINER — the vendor's
  delivery-enabled bookings (event label + service title + running count) for the
  scan-station index; no PII.

**UI:**
- `/vendor-dashboard/deliveries` index (eligible bookings) + `/[eventVendorId]`
  scan station (jsQR scanner → confirm/undo RPCs, big running count, undo-last;
  no roster, no names) — new **Deliveries** entry in the vendor Work nav.
- `per_guest_delivery` checkbox wired through ALL three service-create/edit paths
  (services page create + edit, ServiceWizard) and persisted in both
  `createService` and `updateVendorService`; threaded through `fetchVendorServices`
  (type + FULL_SELECT + fallback). The edit checkbox is pre-checked from the
  saved value (no silent reset on edit).

**Couple-side connection:** the booking workspace
(`dashboard/[eventId]/vendors/[vendorId]/workspace`) shows "N guests have
received this at the event" for delivery-enabled bookings (couple reads via the
`member_read` RLS).

**Adversarial-review hardening (same session, 4-lens workflow):**
- confirm/undo RPCs now also require the `per_guest_delivery` toggle (JOIN
  `vendor_services`) — a turned-off service can't be written even via a direct
  RPC call (the review found the toggle was only checked in the list/page).
- The vendor `SELECT` policy on `event_service_deliveries` was **dropped** (PII
  hardening) — no vendor code reads the table directly; all counts come from the
  DEFINER functions, so `guest_id` never sits behind a vendor-readable policy.
- **Wizard create path fixed (was a real break):** the guided wizard posts to
  `commitVendorService` → `save_vendor_service` (a column whitelist), which both
  dropped the field. Wired `per_guest_delivery` into `commitVendorService`'s
  fields AND re-defined `save_vendor_service` to carry it on INSERT + UPDATE.
- `qr_token` matched case-insensitively (`lower(btrim(...))`), matching the
  sibling scan RPCs.

Security review verdict: no cross-tenant privilege escalation, no forged-pair
insert, no PII leak — the operational-only boundary holds end to end.

Verified: tsc clean · nav-icon + bottom-nav + radius lint green · prod build
green (both `/vendor-dashboard/deliveries` routes) · migration verified live on
prod (table + RLS + 4 functions incl. redefined save_vendor_service + ledger).

SPEC IMPACT: Logged in `DECISION_LOG.md`. Build brief at
`0031_day_of_guest/Vendor_Per_Guest_Delivery_Scan_Build_Plan_2026-06-28.md`.
Reference homes: iteration `0031_day_of_guest` + `0022_vendor_dashboard`.
