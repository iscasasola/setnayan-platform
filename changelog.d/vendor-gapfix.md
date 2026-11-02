## 2026-07-01 · fix(vendor): vendor-dashboard reorg gap-fix wave (C1/C2/H1/H3/H4/H5/M1–M4/L1–L5)

Corrective sweep over verified defects in the vendor-dashboard reorg (P1–P7).
One new migration carries the three SQL fixes; the rest are app-code changes.
(H2 — the unordered-pair UNIQUE index apply risk on `20270403305164` — was
intentionally NOT touched; the operator handles that migration/index separately.)

Migration `20270405381226_vendor_gapfix_partnership_immutable_and_slot_daystate_gate.sql`:
- **C1 (CRITICAL · security):** `vendor_partnerships_lock_immutable_cols()` was
  re-defined WITHOUT the `NEW.target_id`/`OLD.target_id` lines — that column
  does not exist on `vendor_partnerships` (it's on `admin_approval_requests`),
  so the merged hotfix `20270405045663` RAISEd `42703` on every non-admin
  partnership UPDATE, bricking accept/decline/withdraw. The remaining pins
  (recommending/recommended vendor id, relationship_type, fee, discount,
  covered_plan_groups) still close the forged-endorsement hole.
- **H1 (HIGH · double-booking):** `acquire_service_time_slot()` now honors the
  6-state day taxonomy — reads `vendor_calendar_day_states` (org-wide /
  pool_id IS NULL) and returns `status='locked'|'whitelist'` BEFORE consuming
  the slot, matching `acquire_schedule_pools`. Couples could previously book a
  vendor's hard-held / approve-first date straight through the slot path.
- **L5:** dropped the stale ungated 1-arg `create_vendor_token_purchase(TEXT)`
  overload (defensive; `20270401611377` already dropped it — re-issued so no
  ungated path can co-exist regardless of apply order).

App code:
- **C2:** `canPlotTimeSlots` now returns `asVendorTier(tier) === 'enterprise'`
  (Enterprise is bounded to slotsPerDay=8, so the old `=== Infinity` test was
  permanently false). Updated 3 stale `Infinity` comments in `vendor-tier-caps.ts`
  + `services/page.tsx`.
- **H1 (app):** added couple-safe `locked`/`whitelist` cases to the slot-path
  switch in `dashboard/[eventId]/vendors/actions.ts` (generic "this date isn't
  available" copy — never who/why).
- **H3 + M3 (RESOLVED TOGETHER — RETIRE, not re-gate):** the two-admin partnership
  "verify" flow is inert under mutual-accept (`status='accepted'` gates couple
  visibility, not `admin_verified`). Removed the dead `initiateApproval` /
  `confirmApproval` actions; rewrote `admin/vendor-partnerships/page.tsx` as
  passive oversight aligned to the `proposed/accepted/declined/withdrawn`
  lifecycle (Open proposals + Live partnerships), keeping the single-admin
  reject (is_active=false) kill-switch + HQ manual propose. Repointed the
  admin queue count (`lib/admin/queue-counts.ts`) to
  `.eq('status','proposed').eq('is_active',true)` so it actually drains.
- **H4:** removed `'solo'` from `PAID_TIERS` (Solo is admin-set only;
  `create_vendor_subscription` RAISEs `UNMAPPED_SKU_TIER` for solo, so a
  self-serve Solo card hard-errored). Button label now keyed on the real tier.
- **H5:** `TIER_SUBSCRIPTION_BUNDLE_TOKENS.solo.monthly = 0` (no grant path
  ever credits Solo bundle tokens); card hides the "free tokens" line at 0.
- **M1 + L1:** `NOT_VERIFIED` RPC error mapped to a clear "Verify your shop
  first" message in `tokens/actions.ts` + `subscription/actions.ts`.
  `canBuyTokens` left as-is per guidance.
- **M2:** added `/performance`, `/recommendations`, `/demand`, `/funnel`,
  `/payday` to the bottom-nav `more` `activeMatch[]` (were unlit on mobile).
- **M4:** replaced 🔒/✕/✓? emoji + dingbats with inline Lucide line-icons
  (Lock/X/CheckCircle2) in `calendar/page.tsx` + `calendar/[date]/page.tsx`;
  `<option>` labels use plain text. No emoji.
- **L2:** added `recommendations` + `payday` descriptions to `more/page.tsx`.
- **L3:** added `vendor.sidebar.payday/.demand/.funnel/.performance` slots to
  `lib/nav-registry-defaults.ts` so `/admin/menus` can rename/hide them.
- **L4:** fixed stale "Enterprise (₱4,999/28d)" comment → ₱7,499 in
  `vendor-tier-caps.ts`.

SPEC IMPACT: None. Corpus/spec files unchanged — these are corrections to
already-shipped reorg behavior (partnership accept/decline, slot-booking
day-state gate, Enterprise slot plotting, honest Solo card, verified-gate
messaging, mobile nav, icon standard). The as-built ground-truth doc's vendor
sections already describe mutual-accept + verification-gated purchases, which
these fixes make the code actually match.
