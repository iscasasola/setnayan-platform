## 2026-07-23 · fix(security): entitlement columns are not self-writable + refund/lifecycle reversals

**AUTHZ hardening — the entitled party could self-grant paid tiers, and refunds did not reverse them.**

### DB — new migration `supabase/migrations/20270831020000_entitlement_write_guard.sql`
`BEFORE INSERT OR UPDATE` row triggers that RAISE when a DIRECT end-user write sets/changes a
paid-entitlement column. **INSERT coverage is load-bearing** — every guarded column sits behind a
FOR-ALL / `WITH CHECK(TRUE)` RLS policy, so an UPDATE-only guard is bypassed by writing the
entitlement at INSERT time (a couple POSTing an event with `setnayan_ai_active=true`, a vendor
POSTing a `vendor_custom_plans` row already `status='active'`, or a vendor DELETE+re-INSERTing their
`vendor_profiles` row at an elevated tier). Gated on
`current_user IN ('authenticated','anon') AND NOT public.is_admin()` — NOT on `auth.role()` —
because `current_user` is the EFFECTIVE Postgres role: a browser write is `authenticated` (blocked),
the service-role activation path (`lib/sku-activation.ts`) is `service_role` (allowed), and a
`SECURITY DEFINER` RPC runs as the function owner (allowed). This is deliberate:
`public.sweep_vendor_tier_expiry` (the login-driven lapse sweep, invoked by an AUTHENTICATED vendor
from `app/vendor-dashboard/layout.tsx`) and the subscription-checkout RPC family are SECURITY
DEFINER authenticated-invoked writers of `tier_state` — an `auth.role()` guard would lock vendors
out of the auto-lapse. Guarded:
- `vendor_profiles.tier_state` + `tier_expires_at` (policy `vendor_profiles_owner`, FOR ALL, no column guard).
  INSERT: a non-privileged writer may only create the `'free'`-default row (registration inserts
  `{user_id}` via the service-role admin client → unaffected).
- `vendor_custom_plans.status` + `composition` — TRANSITION-AWARE (the vendor legitimately updates its
  own non-active row to `pending_payment`): on UPDATE, self-activation (→`active`) and mutating an
  already-`active` plan are blocked; on INSERT, creating a row already at `status='active'` is blocked
  (`requestCustomPlan` inserts `pending_payment` → unaffected).
- `events.setnayan_ai_active` (UPDATE policy `couple_can_update_event`; INSERT policy
  `authenticated_can_create_event`, `WITH CHECK(TRUE)`). INSERT: the flag must arrive `false`
  (normal event creation never sets it → unaffected).

### App — `apps/web/lib/sku-activation.ts` (refund/lifecycle holes)
- `deactivateOrderSku` now reverses `SETNAYAN_AI_SUB` — rolls back `user_ai_subscription.active_until`
  (was: refund the money, keep the sub). New pure helper `reverseUserAiSubscriptionWindow`
  (`lib/setnayan-ai-subscription.ts`) — only rolls back when this order is still the window tail.
- `deactivateOrderSku` now recomputes `vendor_profiles.extra_agent_seats` on a refunded
  `vendor_extra_seat` order (was: seats never lowered). Shared recompute helper +
  `extraSeatsFromPaidCount` (`lib/vendor-seats.ts`).
- Custom-tier activation now binds to the plan the ORDER PAID FOR — a payable plan whose current
  `quoted_28d_php` matches the paid amount — instead of the most-recently-updated row (closed a
  pay-cheap / get-expensive swap and a stale-active mis-bind). New pure helper
  `selectActivatableCustomPlan` (`lib/vendor-custom-catalog.ts`) + a per-order idempotency ledger
  guard; refuses (throws → recoverable) rather than activating the wrong plan.

Tests: `lib/setnayan-ai-subscription.test.ts`, `lib/vendor-custom-catalog.test.ts`,
`lib/vendor-seats.test.ts` (red-before/green-after mutation-tested; 26 helper tests green). The SQL
triggers have **no local red/green** (no local Postgres/Docker in this env) — the INSERT/UPDATE logic
is statically verified against every writer, but a Supabase preview-branch confirmation is the
outstanding pre-`ready` gate (see PR body). Shipping as DRAFT for that reason.

SPEC IMPACT: None. Security hardening only — no SKU, pricing, taxonomy, or product-spec decision
changes. Establishes the engineering invariant "paid-entitlement columns are writable only through
the service-role activation path / admin console / SECURITY DEFINER RPCs, never a direct end-user
PATCH", and makes refund/reject symmetric for the AI subscription window + extra-seat count.
