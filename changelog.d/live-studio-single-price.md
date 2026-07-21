## 2026-07-21 · feat(pricing): one Live Studio price — ₱2,500/day unlocks everything

Owner: *"1 price to access both. 2500/day."*

Collapses the two device tiers into a single SKU. `PANOOD_SYSTEM` becomes **"Live Studio"** at
₱2,500/day and grants the full capability — 8 cameras, offline-capable, both console layouts.
`PANOOD_SYSTEM_MOBILE` (₱1,500) is deactivated.

### This ratifies shipped behaviour rather than changing it

**The Mobile tier was never purchasable.** The only buy surface in the app
(`studio/panood/page.tsx`) posts `PANOOD_SYSTEM` and nothing else — its own comment already calls
it *"a single per-day multicam SKU"*. The row existed in the catalog and was advertised on
`/pricing`, but no code path could sell it. Verified against prod: **zero `PANOOD_SYSTEM_MOBILE`
orders, ever.**

So `/pricing` has been advertising a phantom ₱1,500 product. That stops now.

### No grandfathering clause, deliberately

Deactivating a catalog row doesn't revoke anything — entitlement reads `orders.status`, so a
historical holder would keep access. There are none. `resolvePanoodTier` still checks both SKUs
anyway (one cached lookup) so a legacy order can never be orphaned by this change.

### The device split survives where it belongs

As a **layout** decision taken from the operator's hardware
(`lib/panood-console-layout.ts`) — never from what they paid. A phone operator and a laptop
operator now buy the same thing and each get the console their device can run. `PanoodTier`
collapses `'free' | 'mobile' | 'desktop'` → `'free' | 'paid'`.

Migration `20270830038893` is idempotent with a post-condition that raises if the price doesn't
settle at 2500 or the Mobile row is still active, and emits a NOTICE (never a failure) if any
historical Mobile order is found — proving the no-grandfathering claim on whatever environment it
runs against rather than trusting a comment.

124 unit tests pass; typecheck + production build clean.

SPEC IMPACT: Supersedes the two-tier device split in `Live_Studio_Repackaging_2026-07-08.md` § 1
and the Mobile/Desktop rows in `Pricing.md` § 00.0 + § 2.1. Corpus updates to follow.
