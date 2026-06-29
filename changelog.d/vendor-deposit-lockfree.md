## 2026-06-29 · feat(vendors): Deposit Reservation Lock-Free — record/acknowledge + instant date-hold

Adds the missing booking-lifecycle state: "host RECORDED a deposit → date HELD →
awaiting vendor confirmation", distinct from confirmed-paid. Previously
`deposit_paid_php>0` + `status='deposit_paid'` conflated "I logged it" with "it
cleared", with no proof artifact or vendor acknowledgement.

- **Migration `20270320429117_deposit_lockfree.sql`:** three orthogonal markers
  on `event_vendors` — `deposit_recorded_at`, `deposit_acknowledged_at`,
  `deposit_proof_url` (precedent: `contract_signed_at`; the `status` enum is NOT
  repurposed). New `acknowledge_vendor_deposit(p_event_vendor_id)` SECURITY
  DEFINER RPC modeled exactly on `respond_vendor_proposal`: ownership gate
  (`current_vendor_event_vendor_ids()` / `is_admin()`), `SELECT … FOR UPDATE`,
  `deposit_acknowledged_at IS NULL` precondition in both the guard and the UPDATE
  WHERE (defense-in-depth single-winner), idempotent re-call returns
  `status=already`. REVOKE PUBLIC/anon + GRANT authenticated.
- **Server actions (`vendors/actions.ts`):** `recordDeposit` (couple) stamps
  `deposit_recorded_at`, optional R2 proof upload → `deposit_proof_url`, logs an
  `event_vendor_payments` row, and HOLDS the date the instant the deposit is
  logged by reusing the existing `acquireSchedulePools` + `resolvePoolIdsFor*`
  path (does NOT flip status). `acknowledgeDeposit` (vendor) forwards to the RPC.
- **Surfaces:** couple workspace gets a "Record deposit" CTA + "Date held ·
  awaiting vendor confirmation" → "Confirmed by vendor" chip; vendor client page
  gets a "Confirm deposit received" action; admin force-majeure detail surfaces
  the deposit state + proof link. Vendor notified on record (`payment_logged`),
  couple notified on acknowledge (`payment_confirmed`).
- **Money semantics:** RECORD + ACKNOWLEDGE + date-hold ONLY — host-entered PHP
  figure for the couple's own ledger. No gateway, no OR, no tax, 0% commission;
  Setnayan never becomes the payee.

SPEC IMPACT: None (new orthogonal columns + RPC; no SKU/pricing/locked-decision
change). Wave 3 anchor of the "Soon" vendor booking-lifecycle cluster.
