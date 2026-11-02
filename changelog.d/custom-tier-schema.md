## 2026-07-04 · feat(vendor-tiers): Custom tier — schema + caps + pricing lib (PR-A); absorbs #2623

The negotiated "Custom" vendor tier that sits above Enterprise (owner-signed rate
card · `apps/web/VENDOR_TIERS_AND_BENEFITS.md` §11). Custom runs as an Enterprise
clone automatically; a composed plan (branches · reach · seats · slots · photos ·
included tokens · custom domain) raises the numeric ceilings and is quoted per the
signed math. **This PR is the substrate — schema, caps, the pricing lib, and the
equality-sweep so `custom` inherits every Enterprise entitlement.** It also
**supersedes the stale/failing PR #2623** by re-implementing its Enterprise
extra-seat add-on fresh on this branch (re-cut migration timestamp).

**Migrations (files only — orchestrator applies via Supabase MCP):**
- `20270511762904_vendor_extra_seat_addon.sql` — re-cut of #2623: `'seat'`
  offering_type + admin-managed `vendor_extra_seat` ₱250 SKU ·
  `vendor_profiles.extra_agent_seats` (default 0, non-negative CHECK) ·
  `vendor_team_members.deactivated_at` (inert until PR-B). Idempotent, additive.
- `20270512705572_vendor_custom_tier_and_plans.sql` — `ALTER TYPE
  vendor_tier_state ADD VALUE 'custom'` (outside txn, mirrors the Solo migration)
  · a `'custom_addon'` offering_type + the 7 rate-card SKUs (base 8999 · reach
  step 499 · reach nationwide 2499 · event slot 499 · photo pack 99 · included
  token 100 · custom domain 499 — the additional-branch unit reuses the existing
  ₱999 `vendor_additional_branch` SKU) · **`vendor_custom_plans`** table with RLS
  AT CREATE TABLE TIME (owner+admin via `current_vendor_profile_ids()`/`is_admin`,
  the exact `vendor_branches` pattern) — `composition jsonb`, `discount_type`
  (amount|percent), `discount_value`, `quoted_28d_php`, `status`
  (draft|quoted|pending_payment|active|rejected|lapsed), created_by, timestamps,
  partial-unique "one active plan per vendor". Prices stay admin-managed; on
  conflict `price_php` is never stomped.

**Libs:**
- `lib/vendor-seats.ts` (new · from #2623) — seat SKU constants + `fetchSeatFeePhp`
  (admin-managed, ₱250 fallback) + service-key helpers + `effectiveSeatCap` +
  `fetchExtraAgentSeats`.
- `lib/vendor-custom-pricing.ts` (new) — PURE `computeCustomQuote(composition,
  unitPrices, discount?)` → `{raw, list28, discountValue, final28, annual}`.
  Charm rounds UP to the next ‑99, floors at base, annual = charm(final28 × 10),
  discounts (amount/%) apply to the charm-rounded list then re-charm-round. Unit
  prices are ARGUMENTS (read from the catalog), never hardcoded. Golden tests:
  5-branch=12,999 · 5-branch nationwide=15,499 · full-service=25,999 · charm
  edges 16997/16999/17000 · floor · %+amount discounts · annual re-charm
  169990→169999.
- `lib/vendor-effective-caps.ts` (new) — `vendorEffectiveCaps(tier, composition?)`
  overlays an ACTIVE plan's composition onto the `custom` caps (seats 10+extras ·
  nationwide→Infinity · slots/photos); no-op for every other tier. +
  `fetchEffectiveCaps` (soft DB read).
- `lib/vendor-tier-caps.ts` — added `custom` to `VENDOR_TIERS` + a `custom`
  `TierCaps` (Enterprise clone) + `TIER_PRICE_PHP`/bundle-tokens/`TIER_LABEL`
  entries + `tierRank`/`isTierAtLeast`/`canBuyExtraSeats` helpers. Enterprise
  `serviceRadiusKm` was already **100** (owner re-cap). `canPlotTimeSlots` is now
  rank-derived (Enterprise-or-higher) so Custom inherits.
- `lib/sku-activation.ts` — new PREFIX_HOOK: `vendor_extra_seat__{id}` order
  approval recomputes `extra_agent_seats` (idempotent, ledger-guarded).

**App:** `team/actions.ts` invite guard now enforces the EFFECTIVE seat cap +
`buyExtraSeat` (Enterprise-or-Custom, apply-then-pay) · `team/page.tsx` seat-usage
line + Extra-seats card + `?bought=` banner.

**Equality sweep** (`rg "'enterprise'"`) — converted hard equality gates so
`custom` inherits Enterprise behavior (no behavior change for other tiers):
`vendor-tier-caps.ts` (`canPlotTimeSlots`), `branches/actions.ts` (branch gate),
`branches/page.tsx` (branch-manager page gate — now consistent with the action),
`shop/page.tsx` (branch add/manage ×3), `services/services-manager.tsx` (branch
picker), `v/[slug]/page.tsx` (Flagship hero + films rack), `vendor-microsite.ts`
(website rank), `vendor-cards.ts` + `library/_data/saved-vendors.ts` (day-1 name
reveal sets), `social/flush.ts` + `api/social/card/[postId]/route.ts` +
`admin/social-queue/page.tsx` (auto-social-card Pro+ gate), `editorial/data.ts` +
`editorial/editorial-content.tsx` (editorial featured/tier badge ×3),
`admin/disputes/page.tsx` + `admin/help/page.tsx` (tier-badge color maps gain a
`custom` key), `subscription/page.tsx` (paid-chip + current-plan label render
Custom). Marketing tier cards (subscription self-serve picker, `for-vendors`
ladder, home overlays) and the admin tier-set dropdown are unchanged — Custom is
"Talk to us", not a self-serve tier, and is provisioned via the custom-plan flow
(PR-B).

SPEC IMPACT: None — implements VENDOR_TIERS_AND_BENEFITS.md §11
