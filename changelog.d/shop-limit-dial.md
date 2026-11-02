## 2026-07-09 · feat(vendor): name the multi-business cap as a dial (MAX_SHOPS_PER_USER = 1)

Makes the "multi-vendor available but capped at 1" decision (M1, owner-locked
2026-07-09) concrete in code, behavior-neutral today.

- New `lib/shop-limits.ts` — `MAX_SHOPS_PER_USER = 1` (the single named source of
  the cap) + `canOpenAnotherShop(ownedCount)`. Doc comment spells out that raising
  it above 1 must ship with the deferred flip (shop-picker + `[shopId]` routing,
  drop `vendor_profiles.user_id UNIQUE`, migrate ~28 RLS policies to
  `current_vendor_ids()`).
- `lib/roles.ts` `fetchUserRoleSummary` now returns `ownedShopCount` +
  `canOpenShop` (owned shops only, excludes team seats) — the field the future
  "+ Open a business" affordance reads. Safe-default literals updated to match.
- `open-shop/actions.ts` reads the full owned set and guards new-shop creation on
  `canOpenAnotherShop()`. Today it only ever reuses or creates the one shop (cap 1
  also held by the `user_id UNIQUE` constraint); the guard becomes live
  enforcement when the cap is raised and UNIQUE is dropped.
- Unit tests pin the cap at 1 and the boundary logic.

Ownership stays person-anchored (user owns the shop directly; name matches
documents). No UI change, no schema change, no RLS change.

SPEC IMPACT: None (decision already logged — DECISION_LOG 2026-07-09 M1 rows +
memory project_setnayan_multi_business_marketplace).
