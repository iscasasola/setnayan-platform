## 2026-10-22 · feat(account): every account switches between ALL of its shops — one active-shop resolver behind every supplier read and write

Owner, 22 Oct: every account switches between all of its shops from the avatar sheet. #6783 offered the switch only to a helper with no shop of their own, because the owner path ignored it: reads found "my shop" as `vendor_profiles.user_id = auth.uid()`, so an owner of shop A who also helps shop B, switched to B, would have seen B while the shop editors saved to A.

- **One resolver** — `resolveActiveShop` (`lib/active-shop.ts`): the chosen shop when this login owns it or holds a seat in it, else the shop they own, else their first seat; a foreign id falls back, never opens. A refused read throws (never "no shop"). `fetchOwnVendorProfile`, `resolveVendorRole` (now the role on the ACTIVE shop, not the highest across seats), `fetchAdminVendorContext` (Team), `fetchVerifiedLock` all go through it.
- **Moved off `user_id`**: the shop-field / page editors and correction request (`vendor-dashboard/actions.ts`), Instagram connect + sync, manpower page + complete-gig, the plan page's tier reads, payment options' Pro check (`isShopProActive`, per shop). Owner-only editors (the `vendor_profiles` write policy admits the owner alone) now say "Only the shop's owner can change this." to a helper instead of matching zero rows and reporting success.
- **The sheet offers every shop** to owners too (`reachableShops`); the switch route admits all of them.
- Guards: `lib/the-active-shop-is-resolved-once.test.ts` (no shop-scoped server file resolves the shop by the login's own id; every other by-identity read is a named enumeration with an exact count) · `tests/db/an-owner-picks-which-shop.db.test.ts` (two shops, real RLS: a write after switching lands on the switched shop).

SPEC IMPACT: None — implements the owner's 2026-10-22 ruling already recorded with the avatar sheet (DECISION_LOG "THE AVATAR SHEET IS DIRECTION 2"); no new decision.
