# HANDOVER — rd/an-owner-picks-which-shop (stacked on #6783)

Task: every account switches between ALL its shops from the avatar sheet (owner 2026-10-22).

Done (committed):
- `lib/active-shop.ts` — THE resolver `resolveActiveShop` (+ `resolveActiveShopId`, `resolveOwnedActiveShop`, pure `pickActiveShop`); `reachableShops` = every shop.
- Routed: `fetchOwnVendorProfile`, `resolveVendorRole` (role on active shop), `fetchAdminVendorContext`, `fetchVerifiedLock(shopId)`,
  vendor-dashboard/actions.ts (4 editors, owner-only), Instagram connect + actions (owner-only), manpower page + completeGig,
  subscription page tier reads, payment-options Pro check (`isShopProActive`).
- Guards: `lib/the-active-shop-is-resolved-once.test.ts`, `tests/db/an-owner-picks-which-shop.db.test.ts`; updated
  `the-sheet-lists-every-place.test.ts`.
- Lab: `/dev/avatar-sheet-lab?who=owner2|owner2b`.

Next: install → run touched tests + db test → sabotage → shots (375 light+dark) → push → draft PR (base = 6783 branch) → CI.

Decisions taken here (no ruling needed — matches RLS): owner-only editors refuse a helper in words
("Only the shop's owner can change this.") instead of a zero-row update reported as success.

Not done (named in PR body): front-door rail/command shop label still names the first shop (pressing it opens the active
shop); thread-scoped vendor checks + event-scoped RPCs (SQL) still enumerate all shops (pre-existing, no migration).
