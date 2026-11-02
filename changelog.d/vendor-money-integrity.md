## 2026-07-01 · feat(vendor/money): verification-gate token buy + subscribe · hard-delete redeem-code (Phase 2)

Owner 2026-07-01: "they can only purchase tokens and subscribe when they are
verified" + "no free tokens since we already made the prices lower." Closes the
free-token faucet that would let an unverified store acquire tokens without
buying (a bypass of the new buy-gate). Landed atomically — a half-done gate is a
backdoor.

- **Migration `20270403095563_vendor_verification_gate_and_close_redeem_faucet.sql`**
  - Redefines `create_vendor_token_purchase(TEXT,UUID)` + `create_vendor_subscription(TEXT)`
    (VERBATIM current bodies) with a null-safe verification guard —
    only `vendor_profiles.verification_state='verified'` may buy tokens or
    subscribe (RAISE `NOT_VERIFIED`). Reverses the stale 2026-06-07 "FREE may
    buy" override (its client-import justification died when import went free, #2448).
  - `REVOKE EXECUTE` on `redeem_vendor_token_voucher(UUID,UUID,TEXT)` so the
    faucet can't be reached by a crafted API call either (that RPC is used ONLY
    by the deleted route — no couple-checkout / admin path calls it).
- **`lib/vendor-tier-caps.ts`** — `canBuyTokens()` now returns `asVendorTier(tier) !== 'free'`
  (client UX mirror; the server RPC is authoritative).
- **Hard-delete `/vendor-dashboard/redeem-code`** (page + actions + loading — it
  minted free tokens). Removed from the sidebar (My Shop), bottom-nav
  activeMatch, `/more` copy map, `lib/routes.ts`, `lib/route-meta.ts`,
  `lib/nav-registry-defaults.ts`. Repointed the 3 in-content CTAs (earnings +
  manpower ×2) from "Redeem a code" → "Buy tokens" (`/vendor-dashboard/tokens`).

**HELD for owner sign-off (NOT in this PR — flagged, reverses recent perks):**
subscription-bundled tokens (Solo +2/mo, Pro 5/50, Ent 10/100 · owner-set
2026-06-09 / 06-25) are a free-token faucet but are NOT a security bypass (you
must be verified to subscribe first), so removing them is a policy call, not a
security fix. Likewise the admin discretionary grants + admin voucher-creation
(`/admin/discount-codes`) + manpower telemetry reward stay pending the "no free
tokens" scope decision (D2). Verified: typecheck · ESLint · lint:navicon ·
lint:botnav · lint:entitlement-gates · lint:retired · migration timestamp guard.

SPEC IMPACT: None. Captured in `03_Strategy/Vendor_Dashboard_Build_Plan_2026-07-01.md`
§2 Phase 2 + §0.5.
