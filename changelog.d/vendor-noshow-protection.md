## 2026-06-29 · feat(vendors): No-Show Downpayment Protection — policy + couple acknowledgement + frozen evidence

Wave 3 of the "Soon" vendor benefits. A POLICY + couple-ACKNOWLEDGEMENT + frozen-EVIDENCE layer on the downpayment — NOT money movement. Setnayan never holds the downpayment; this builds the defensible paper trail for a forfeit dispute.

**Migration** `20270321049229_noshow_downpayment_protection.sql` (validated against prod in a `BEGIN…ROLLBACK`):
- Adds reservation-policy fields to `vendor_service_payment_schedules` (the per-service template where seq 0 IS the downpayment): `cancellation_terms TEXT`, `downpayment_non_refundable BOOLEAN DEFAULT FALSE`, `refund_window_days INT`, `no_show_forfeit BOOLEAN DEFAULT FALSE`. These inherit the table's existing `_owner_write` / `_public_read` RLS — no new/conflicting policies.
- New table `public.event_vendor_policy_acknowledgements` — write-once frozen evidence, one immutable row per locked booking. RLS enabled AT CREATE: host read+insert via `event_id IN (SELECT public.current_event_ids())`; admin via `is_admin()`. **No UPDATE/DELETE policy → immutable** (0 mutating policies confirmed in prod dry-run). A denormalized `vendor_profile_id` lets the admin dispute surface join evidence by vendor in one lookup.

**Lock-time snapshot:** in `finalizeVendor` (the existing `event_vendor_payment_plan` freeze path), the seq-0 downpayment policy + terms text are frozen into an `event_vendor_policy_acknowledgements` row, stamped with the acknowledging couple user. Reuses the same service-role transaction/path; best-effort + fail-soft (never rolls back the lock). A new `reservation_terms_required` `finalizeVendor` result gates the lock: if the downpayment is non-refundable and/or carries a no-show forfeit and the couple hasn't ticked the acknowledgement, the lock is refused and the UI surfaces the terms.

**Three surfaces:**
- **Couple:** a "Reservation terms" acknowledgement modal in the lock flow (`accordion-lock.tsx`) — the couple ticks "I understand the downpayment is non-refundable on no-show" before the lock commits; rendered read-only afterward on the per-vendor workspace beside `PaymentPlanStepper` (`reservation-terms-ack.tsx`).
- **Vendor:** policy fields on the downpayment row in `PaymentScheduleEditor`; a "Protected by your reservation policy — acknowledged [date]" badge on the per-booking plan card in the message thread (`vendor-payment-live.tsx`).
- **Admin:** the frozen `policy_snapshot_json` + `acknowledged_at` exposed as collapsible immutable evidence per dispute row in `/admin/disputes` (joined by `vendor_profile_id`), so support adjudicates a forfeit against the snapshot, not the editable live template.

**Scope boundary:** the service-create wizard (`service-wizard.tsx` → `save_vendor_service` RPC) carries no schedule editor today, so wizard-created services get default (no-policy) downpayments via the new columns' defaults; the vendor sets the reservation policy through the legacy `PaymentScheduleEditor` card (the canonical schedule-editing surface). No RPC change needed.

**SPEC IMPACT:** None (new vendor-benefit feature; no existing locked decision changed). Flagged for owner awareness: the non-refundable / no-show-forfeit couple-facing WORDING is legal text and should get PH-counsel review before launch — off-platform money lowers Setnayan's exposure (we hold nothing, execute no refund/forfeit), but the terms the couple agrees to are still binding language.
