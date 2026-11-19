## 2026-11-19 · feat(plans): the 19 Nov supplier plan numbers + the Ultra Add-on

Owner, 19 Nov, verbatim: *"use what is on max be named ultra and remove the current ultra"* · *"just 1 pack"* ·
*"Ultra Addon"* · *"2490"* · *"they only buy the … pack"* · *"we do not limit the potential of a card"* · *"shop page
also is 1 for all already"* · the final table: *"this is good"*. Specs: SUPPLIER_PLANS_CHANGE_PLAN_2026-11-19.md §B.

- **The ladder (no fifth tier)** — people incl. the owner · live cards · branches besides the main shop · storage:
  Free 1·1·0·— · Verified 1·3·0·— · Plus 2·10·0·5 GB · Pro 5·27·1·10 GB · Ultra 16·68·3·20 GB. `TIER_CAPS`,
  `vendor_plan_contents` and the `vendor_tier_limit` fallback move together (migration `20271351415438`).
- **Price:** Pro ₱3,990 per 4 weeks (was ₱4,990). Pro's yearly row is DERIVED in SQL as 10× (₱39,900, was ₱49,900),
  following the guarded 2026-11-04 rule "a year = 10× the 4-week price" (`a-year-is-ten-four-week-cycles.db.test.ts`);
  the yearly price itself is still an open owner call. The yearly plan rows carry the same seat caps as the monthly.
- **The same on every plan:** morning + afternoon slots (`slotsTimeBounded`), the shop page with its own web address,
  the Pro page parts and the "Films" video layer (`website`, `customWebsiteName`, `premiumPage`; `micrositeCan` reads
  them — the Films layer by the owner's §C ruling, item 5).
- **The Ultra Add-on — the ONE add-on:** +1 branch · +15 live cards · +3 people · +50 GB, ₱2,490 per 28 days, Ultra
  only, may be bought more than once. SKU `vendor_ultra_addon`. ⏳ **28 days per payment, never forever:** there is no
  stored count — the activation hook stamps each paid order's own window (`orders.expires_at` = approval + 28 days,
  the paid branch's pattern) and the live number is `vendor_live_ultra_addons()` (paid orders whose window covers
  now); a refund or a lapsed window drops out by itself. The database's branch and storage gates add it; the app adds
  all four (`applyAddOnExtras`, seats, storage) through the checked `vendor_live_ultra_addons_for()`. Bought from a new
  row on the Plan page; shown in the Plans table and the line under the plan cards.
- **No new single seat or branch is sold** (`canBuyExtraSeats` / `canBuyExtraBranches` are false on every plan). One
  already bought is kept and renews (`holdsExtraSeats` / `canRenewExtraBranches`); their catalogue rows stay active
  for that reason. The invite "at cap" seat-fee hint is gone — Ultra is pointed at the Ultra Add-on.

- **Existing subscribers (owner ruled change plan §C, "Yes, all five"):** the lowered limits apply — a shop over one keeps
  what it has and cannot add; Pro's year stays ₱39,900 (10×); a single seat or branch already paid for renews until it
  lapses and is never sold new; a current Pro subscriber moves to ₱3,990 at the next renewal (the catalogue price);
  the Films layer opens to every plan.

SPEC IMPACT: None in this PR — the rulings are in the corpus DECISION_LOG 2026-11-19 (incl. the §C "Yes, all five")
and the change plan (ac15265b).
