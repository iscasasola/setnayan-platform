## 2026-06-22 · feat(admin-security): DB-enforced two-admin gate on high-risk writes (Phase 2b)

Closes the Admin Account-Access Model security audit **mustFix #1**: the
two-admin "four-eyes" gate was UI-only, so a single admin could execute a
critical action (large refund, big comp grant, change the platform's BDO/GCash
receiving accounts, promote an admin, re-price a SKU) BEFORE the second-admin
approval arrived. This pushes the gate down to the database.

Migration `20270216829481_db_enforced_two_admin_gate_high_risk_writes.sql`:

- **Flag (fails-off, default INERT):** new tri-state
  `platform_settings.two_admin_enforcement_enabled` BOOLEAN (NULL/FALSE = off).
  SQL resolver `public.two_admin_enforcement_enabled()` (SECURITY DEFINER,
  STABLE) reads it and returns FALSE on ANY error (missing column, NULL, bad
  value). With the flag NULL/off every trigger early-returns `NEW` unchanged →
  prod is byte-identical. The owner flips it ON only after testing each path.
- **Approval link + consumption:** each gated write carries an
  `approval_request_id` (new nullable FK; `users` uses
  `promote_approval_request_id`). The shared SECURITY DEFINER helper
  `public.claim_two_admin_approval(...)` validates the referenced
  `admin_approval_requests` row is `status='approved'`, the matching
  `action_type`, unexpired, target-aligned, and UNCONSUMED, then CONSUMES it via
  an atomic `UPDATE … WHERE consumed_at IS NULL RETURNING` (new
  `consumed_at`/`consumed_by_table`/`consumed_by_pk` columns). One approval =
  exactly one write; replay is impossible. `admin_approval_requests` four-eyes
  CHECK + the existing atomic approve() claim already guarantee the approval was
  decided by a *different* admin, so this is genuinely two-admin.
- **Five BEFORE triggers**, each gating ONLY its specific high-risk transition
  (every other write to the table passes untouched, even when enabled):
  1. `order_refunds` INSERT where `refund_amount_centavos > 2_500_000`
     (₱25,000) → `refund_over_25k`.
  2. `comp_grants` INSERT where `retail_value_centavos > 1_000_000` (₱10,000) →
     `comp_grant_over_10k`.
  3. `platform_settings` UPDATE that changes any BDO/GCash receiving-account
     field (account name/number/QR ×2) → `change_receiving_account`.
  4. `users` gaining `account_type='admin'` (INSERT or transition) →
     `promote_to_admin` (reuses the existing action_type).
  5. `service_catalog` UPDATE of `price_centavos` or `unit` (frequency) →
     `service_catalog_price_change`.
- Extends the `admin_approval_requests.action_type` CHECK with the four new
  types; adds a partial index on the approved+unconsumed set.

TS: `resolveTwoAdminEnforcementEnabled()` in `lib/integration-config.ts`
(read-side mirror for the admin console, fails-off, env fallback default OFF);
the four new action types added to the `ApprovalActionType` union in
`lib/admin-approvals.ts` (kept out of the manual `APPROVAL_ACTIONS` picker —
they're consumed by triggers, not the approvals-page executor).

Not applied to prod (flag stays NULL until the owner tests each path).
Verified: typecheck clean · `next lint` on changed files clean · production
`pnpm -C apps/web build` EXIT 0 · `lint:chat-guard` clean.

ASSUMPTIONS (flagged for human review):
- **Refund amount lives on `order_refunds`, not `orders`.** The doc says "orders
  refund (status → 'refunded')"; the real code flips `orders.status` then
  inserts an `order_refunds` row carrying `refund_amount_centavos`. The gate is
  on the `order_refunds` INSERT (the canonical money/audit row) — the
  `orders.status` flip itself is NOT gated. To make the gate binding end-to-end
  the refund server action must run the status-flip + the gated insert in one
  path (it already does, in that order); a hardening follow-up could move the
  status flip behind the same approval.
- **No `payment_receiving_accounts` table exists.** The platform's BDO/GCash
  receiving accounts are columns on the `platform_settings` singleton, so that
  gate is a `platform_settings` UPDATE trigger scoped to those 6 columns.
- **`service_catalog` is the SKU table targeted** (real, has price_centavos +
  unit). The newer `platform_retail_catalog_v2` has no frequency column and was
  NOT gated; if pricing moves there, add a parallel trigger.
- Triggers do NOT yet wire the approval link from the TS write paths — the
  server actions still INSERT/UPDATE without setting `approval_request_id`.
  That's intentional for this PR: with the flag OFF the writes are unaffected,
  and the TS wiring + the request-creation UI for the four new action types
  lands as the follow-up that the owner enables alongside flipping the flag ON.

SPEC IMPACT: Admin_Account_Access_Model_2026-06-22.md §4 ("DB-level two-admin
enforcement (mustFix #1)") — this migration implements the trigger half of that
section. Orchestrator records the DECISION_LOG row.
