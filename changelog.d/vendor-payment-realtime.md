## 2026-06-28 · feat(vendor): realtime payment view on the vendor thread

Upgrades the vendor-side payment roll-up (PR #2350) from server-rendered to
**live** — the owner-approved follow-up to the couple's realtime budget summary
(#2348). When a couple logs an off-platform payment, the vendor's pending-confirm
card + plan roll-up (received / total / % / next due) now update within ~500ms
with no refresh; confirming flips the installment to paid live too.

**The enabling security change (scoped, read-only)**

- `event_vendor_payments` / `event_vendor_line_items` were couple-RLS only, which
  blocked Realtime delivery to vendors. Migration
  `20270315091571_vendor_read_payment_ledger_rls.sql` adds a **read-only** vendor
  SELECT policy on both, scoped to the vendor's OWN bookings via a new
  SECURITY DEFINER resolver `current_vendor_event_vendor_ids()` (owner/admin via
  `marketplace_vendor_id`, agents via assigned service — mirrors the existing
  `agent_customer_event_ids()` pattern; no invented patterns). This exposes
  exactly the rows the vendor already saw server-side — just over a live channel.
  Writes stay couple-only + the SECURITY DEFINER guards. **Applied to prod**
  (`setnayan-prod`) with a matching `schema_migrations` ledger row.

**Client**

- New `VendorPaymentLive` client component subscribes to both tables (event-
  filtered) and refetches via the ownership-gated `getVendorPaymentState(threadId)`
  server action on any change. The pending-confirm cards + plan-progress cards
  moved into it verbatim (forms still post to `confirmVendorPayment` /
  `clearVendorPaymentPlan`). First paint uses the server-computed initial props;
  reconnects backfill.

SPEC IMPACT: Iteration 0022 (vendor_dashboard) — vendor thread payment view is now
realtime; new couple-private-ledger vendor-read RLS policy. Logged in corpus
`DECISION_LOG.md`.
