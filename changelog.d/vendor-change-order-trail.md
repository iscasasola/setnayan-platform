## 2026-06-29 · feat(vendors): Change-Order Trail — both-acknowledged mid-plan add-ons/removals

Adds the missing booking-lifecycle artifact: a BOTH-ACKNOWLEDGED record of a
mid-plan add-on or removal. Until now budget line items
(`event_vendor_line_items`) were unilaterally couple-edited — no audit trail, no
vendor sign-off when scope/price changed after booking. Wave 3 of the "Soon"
vendor booking-lifecycle cluster, sitting beside the deposit lock-free + Suggest
flows.

- **Migration `20270320861005_change_order_trail.sql`:** new
  `public.vendor_change_orders` (`change_order_id`, `event_vendor_id` →
  `event_vendors(vendor_id)`, `event_id`, denormalized `vendor_profile_id`,
  `raised_by ∈ couple|vendor`, `title`, `description`, signed `delta_amount_php`
  (+add-on / −removal), `proposed_due_date`, `status ∈
  proposed|accepted|declined|withdrawn`, ack columns, `settled_line_item_id`).
  RLS enabled **at CREATE** with canonical helpers — couple read/insert via
  `current_couple_event_ids()` (+ `current_moderator_event_ids()` read), vendor
  read/insert via `current_vendor_booked_event_ids()` +
  `current_vendor_profile_ids()`, admin read via `is_admin()`. **No couple/vendor
  UPDATE policy** — every resolved state is written only by the RPCs.
- **Single-winner RPCs** (SECURITY DEFINER, modeled exactly on
  `respond_vendor_proposal` / `acknowledge_vendor_deposit`): the COUNTERPARTY
  responds — `accept_change_order(p_change_order_id)` and
  `decline_change_order(p_change_order_id, p_reason)`; the PROPOSER retracts via
  `withdraw_change_order(p_change_order_id)`. Each: ownership gate (couple-raised
  → vendor acts; vendor-raised → couple acts; or admin), `SELECT … FOR UPDATE`,
  `status='proposed'` precondition in both the guard and the UPDATE WHERE
  (defense-in-depth), `GET DIAGNOSTICS ROW_COUNT`, idempotent re-call returns
  `status=already`. REVOKE PUBLIC/anon + GRANT authenticated.
- **Ledger settle on ACCEPT only:** the accept RPC inserts ONE
  `event_vendor_line_items` row (the single budget-ledger source of truth — no
  parallel money store) in the same transaction, links it via
  `settled_line_item_id`, and bumps `event_vendors.updated_at`. The
  `amount_php >= 0` CHECK is honored by storing `ABS(delta)` with a sign-encoding
  label ("Change order: …" / "Change order (credit): …", truncated to 64); the
  signed `delta_amount_php` on the change-order row stays the canonical audited
  figure. A lost UPDATE race raises → the orphan line item rolls back.
- **State-machine only — NO 2-way writes.** A change order is a row whose state
  both parties move through; neither side ever direct-edits the other's data.
- **Surfaces (architect mandate):** couple raises + accepts/declines/withdraws on
  the vendor workspace (`vendors/[vendorId]/workspace`, new
  `ChangeOrderTrail` component); vendor raises + accepts/declines/withdraws on the
  client brief (`vendor-dashboard/clients/[eventId]`, beside the Suggest flow);
  admin reads the immutable trail on the force-majeure / dispute detail page.
  Counterparty notified on raise + resolve via `emitNotification`
  (`schedule_suggestion`).
- **Money semantics:** `delta_amount_php` is a host/vendor-entered PHP figure for
  the couple's own ledger. No gateway, no OR, no tax, 0% commission; Setnayan
  never holds funds or becomes the payee.

SPEC IMPACT: None (new table + RPCs + UI; no SKU/pricing/locked-decision change).
Honors conflict-architecture (state machine, single-winner serialization) and the
`event_vendor_line_items` single-source-of-truth ledger lock.
