## 2026-09-20 · fix(vendor): only a PROVEN absence may send a supplier to /open-shop

`/vendor-dashboard/shop` redirects to `/open-shop` — the brand-new-shop wizard —
when `loadShopData()` returns the `'no-vendor'` sentinel. Shown to a supplier who
already HAS a shop, that screen invites them to create a second one.

Audited every path that can produce that sentinel. All but one were already
honest: `selectVendorProfileBy` throws when both its projections fail, and
`ShopHome`'s catch lands on `data = null` and the separate "couldn't load"
branch. The one exception was the team-member path of `fetchOwnVendorProfile`
(`lib/vendor-profile.ts`), which destructured the `vendor_team_members` read's
`data` and discarded its `error` — so a refused or failed read produced exactly
the same `null` as a successful read over zero memberships, and a team member
with a shop would have been walked into the create-a-shop wizard.

- NEW `lib/shop-presence.ts` — a pure `classifyShopRead(rows, error)` →
  `'has-shop' | 'no-shop' | 'unreadable'`. An error is never an absence.
- `lib/vendor-profile.ts` now keeps the membership read's error and throws on
  `'unreadable'`, joining the throw path the page already handles. A genuinely
  shopless account still resolves to `null` exactly as before, so nothing
  changes for a couple opening `/vendor-dashboard/shop`.
- NEW `lib/shop-presence.test.ts` — EXECUTES the decision, both on the helper
  (20 (rows, error) pairs, floored) and through the real `fetchOwnVendorProfile`
  driven by a stub client: a refused membership read must throw, a successful
  empty one must still return `null`.
- NEW `app/vendor-dashboard/shop/the-open-shop-redirect-is-a-proven-absence.test.ts`
  — scans every `redirect('/open-shop')` outside the wizard's own folder (1
  today, count printed and floored), every `'no-vendor'` production site, and the
  membership destructure. Comment lines are excluded so a docblock quoting the
  bug cannot convict the file that fixed it.

Sabotaged four ways, each caught by the guard written for it: an error mapped to
`'no-shop'`; the membership error dropped again; a second unguarded
`redirect('/open-shop')`; the loader's catch assigning the sentinel.

NOT a fix for a live regression. The 2026-09-20 02:16 UTC report of a supplier
being offered a second shop was a misattribution — the prod edge logs show the
session was user `8a9fcf15-…` (a couple account with no shop), whose
`vendor_profiles_self` read returned **200 with no row**. Saysay's own read was
re-measured against production and works. This is the hardening that was real.

SPEC IMPACT: None.
