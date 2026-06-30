## 2026-06-22 · feat(admin): handler-lane RBAC + §10b team-pool weekly cap — account-access model Phase 2c+2d

Builds Phase 2c (handler-lane RBAC) + Phase 2d (§10b shared-pool weekly cap) of the admin account-access model (`Admin_Account_Access_Model_2026-06-22.md` §3/§4/§10 · DECISION_LOG 2026-06-22). Both security-audit mustFixes; both ship **flag-gated OFF by default** so they are inert until the owner tests + enables.

**Handler-lane RBAC (2c).** Admin identity was FLAT — every admin could read/act on every console queue (a Verification handler could approve Payments, resolve Disputes). Now:

- **Migration `20270215765803_handler_lane_rbac_and_team_pool_weekly_cap.sql`** — `users.handler_role TEXT` (`verification|payments|disputes|full`, CHECK), **DEFAULT `'full'`** so every existing + future admin is unrestricted (no lockout). Tri-state kill-switch `platform_settings.handler_lane_rbac_enforced` (nullable BOOLEAN, fails-OFF, mirrors `setnayan_ai_paywall_enabled`). Additive RLS helpers `admin_handler_role()` + `admin_in_handler_lane(lane)` (SECURITY DEFINER, defense-in-depth only — not relied on).
- **`lib/handler-lane.ts`** — `resolveHandlerLaneRbacEnforced()` (uncached tri-state, fails-OFF), `requireHandler(lane?)` (drop-in superset of the per-file `requireAdmin`), `assertHandlerLaneOrRedirect(lane)` (page-level fence → 302 to `/admin`).
- **`app/admin/{verify,payments,disputes}/actions.ts`** — the three duplicated `requireAdmin()` gates now delegate to `requireHandler(<lane>)`, return shapes unchanged. **`app/admin/{verify,payments,disputes}/page.tsx`** — each queue read fenced with `assertHandlerLaneOrRedirect(<lane>)`.
- WHY code-layer, not RLS-only: all three queues read/write via the service-role client (`createAdminClient()` bypasses RLS), so RLS-only lane isolation would NOT bind — the binding fence lives in code; the RLS helpers are additive.

**§10b team-pool weekly cap (2d).** One team-pool member could drain the whole shared comp allocation. Now a per-member ROLLING-7-DAY cap (default **₱2,500/member/week** = 250000 centavos, admin-configurable via `platform_settings.team_pool_weekly_cap_centavos`):

- **BEFORE INSERT trigger `enforce_team_pool_weekly_cap()` on `comp_grants`** — mirrors `enforce_vendor_self_comp_quota()`; fires only on `source='team_pool'`, sums `retail_value_centavos` by `granted_by` over the rolling window, RAISEs `TEAM_POOL_WEEKLY_CAP_EXCEEDED`. Gated by tri-state `team_pool_weekly_cap_enforced` (fails-OFF). Binds even on service-role inserts (triggers aren't bypassed). Inert on all current inserts (no `team_pool` insert path exists yet; today's admin comps are `source='external_promo'`).
- **`lib/team-pool-cap.ts`** — `resolveTeamPoolCapConfig()` + `describeTeamPoolCapError()` (friendly relay of the trigger rejection).

Migration NOT applied to prod (orchestrator/owner gate). Verified: typecheck 0, `next lint` clean on changed files (only pre-existing `aria-pressed` warnings in payments/page.tsx), prod `next build` exit 0, `lint:chat-guard` clean.

SPEC IMPACT: Recorded in `Admin_Account_Access_Model_2026-06-22.md` + DECISION_LOG 2026-06-22 (orchestrator records the corpus row) + memory `project_setnayan_admin_account_access_model`. No SKU/price change; additive security substrate, OFF by default.
