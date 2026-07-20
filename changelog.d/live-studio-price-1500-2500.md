## 2026-07-20 · chore(pricing): Live Studio device tiers → ₱1,500 / ₱2,500

Reprices the two Live Studio (Panood) device-controller SKUs in
`platform_retail_catalog_v2` to the owner's 2026-07-17 per-service sheet,
confirmed by the owner 2026-07-20:

| SKU | Was | Now |
|---|---|---|
| `PANOOD_SYSTEM_MOBILE` — Live Studio · Mobile Controller | ₱1,299/day | **₱1,500/day** |
| `PANOOD_SYSTEM` — Live Studio · Desktop Controller | ₱2,499/day | **₱2,500/day** |

Migration `20270827190298_live_studio_price_1500_2500.sql` — idempotent, guarded by a
post-condition that raises if either price fails to settle. Also updates the single
hardcoded fallback in `apps/web/app/_components/home/pricing-data.ts` (`2499 → 2500`)
so the no-catalog path matches; `/pricing` itself is catalog-driven and needs no change.

**The round numbers are deliberate.** The 07-17 sheet re-bases the catalog off the
2026-05-12 charm-pricing (-1 endings) convention across the board (Pakanta ₱2,500 ·
3D Plan Unlock ₱3,000 · Monogram Pro ₱999 → ₱1,000). Do not "charm-correct" these
back to ₱1,499 / ₱2,499.

Safe on existing data: `orders` rows carry their own `requested_total_php` /
`confirmed_total_php`, so the 3 historical paid orders on these SKUs are untouched.
Both SKUs stay "In build" / not purchasable — the release gate is a real-event test of
the controller, not the price.

SPEC IMPACT: Applied directly to the corpus at `~/Documents/Claude/Projects/Setnayan/`
— `Live_Studio_Repackaging_2026-07-08.md` § 1 (price table + provenance banner),
`Live_Studio_Competitive_and_Pricing_2026-07-20.md` § 5.2 (new doc: competitive teardown
+ pricing decision), and three `DECISION_LOG.md` rows (2026-07-20 teardown · pricing +
Facebook-Live delivery · correction withdrawing an erroneous ₱1,499).
