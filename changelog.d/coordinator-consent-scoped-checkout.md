## 2026-07-19 · feat(coordinator): consent-scoped vendor-lock + checkout authority (flag-gated) + fail-consistent recordDeposit

Owner decision 2026-07-19 #5: coordinators MAY lock vendors and handle the payment process, but ONLY upon the couple's approval of the coordinator's access limitations. The absolute money wall becomes consent-SCOPED, enforced behind `NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED` (default OFF — flag-off behavior is byte-for-byte today's).

**Scope model** — migration `20270823668011_coordinator_consent_scopes.sql` adds `scopes JSONB NOT NULL DEFAULT '{}'` to `coordinator_access_consents` (`{"vendor_lock": bool, "checkout": bool}`; missing key = not granted, fail-closed). The PR #3390 consent modal (`hosts/_components/consent-gated-invite-form.tsx`) grows two default-OFF couple-set toggles — "Can lock vendors" and "Can handle payments (submit orders / upload payment proof / record deposits)" — recorded by `inviteHost` into the consent row (`scope_version` bumps to `'v2'` for the new disclosure).

**Guard** — new `apps/web/lib/coordinator-money-scope.ts` → `coordinatorMoneyScopeAllowed(admin, eventId, userId, scope)`: flag OFF → true with zero reads; flag ON → couple always true, non-couple true only when an un-revoked consent row on one of their live moderator rows grants the scope. Wired into:

- `submitOrderAction` (checkout/actions.ts) — scope `checkout`; the prior guard admitted ANY event_members row.
- `createOrder` + `logPayment` (orders/actions.ts) — scope `checkout`; logPayment's order read was widened to all members by migration 20270129279924, so a coordinator could attach payment proof to the couple's orders.
- `finalizeVendor` (vendors/actions.ts) — scope `vendor_lock`, placed AFTER the dormant propose-lock branch (`NEXT_PUBLIC_COORDINATOR_PROPOSE_LOCK_ENABLED` untouched).
- `recordDeposit` (vendors/actions.ts) — scope `checkout`; a consent-authorized coordinator's `event_vendor_payments` ledger insert goes through the admin client (the RLS policy is couple-only, migration 20260513110000).

**Unconditional bug fix (NOT flag-gated)** — `recordDeposit` was fail-DIVERGENT: it stamped `deposit_recorded_at` + proof on `event_vendors`, then inserted the `event_vendor_payments` ledger row "best-effort" — and for coordinators that insert always failed silently under the couple-only RLS, leaving deposit state with no ledger row. Now a failed ledger insert rolls back the just-stamped marker, releases the date hold, and returns the error.

Unit tests: `apps/web/lib/coordinator-money-scope.test.ts` (flag off → permissive with no DB reads; flag on → couple ok, coordinator w/o scope denied, with scope allowed, revoked/empty/stringly scopes denied).

SPEC IMPACT: Owner 2026-07-19: money wall superseded → consent-scoped coordinator lock+checkout (couple approves scopes at invite). Coordinator_Role_Feature_Spec + Coordinator_Whats_Next money-wall sections now historical.
