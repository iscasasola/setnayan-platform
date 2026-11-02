## 2026-07-01 · feat(admin): priority-dispute sort by vendor tier

The `/admin/disputes` queue now orders disputes by the disputed vendor's tier
priority (enterprise > pro > solo > verified > free) DESC, then preserves the
existing newest-first (`created_at` DESC) order as the tiebreak — so premium
vendors' disputes surface to the top of the admin queue. Each dispute row now
shows a small tier chip under the vendor name.

Implementation is a READ-ONLY ordering + display change confined to
`apps/web/app/admin/disputes/page.tsx`:
- The existing `vendor_profiles` lookup now also selects `tier_state`; tiers are
  normalized via the canonical `asVendorTier()` and ranked by index into
  `VENDOR_TIERS` (both from `lib/vendor-tier-caps.ts`).
- Rows are stably re-sorted in-memory (the list is server-capped at 200), so no
  migration, RPC, or index change is needed.
- Header copy updated to describe the new ordering.

Untouched (per #2510 boundaries): the demotion cron, the vendor-contest write
path, `counts_toward_demotion`, `admin/disputes/actions.ts` resolve logic, and
all RLS/triggers.

SPEC IMPACT: None. Iteration 0023 § 3.6 describes the admin dispute queue but
does not pin an ordering; tier-priority ordering is an admin-side ergonomics
refinement, not a product/pricing/schema change.
