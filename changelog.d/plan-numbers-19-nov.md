## 2026-11-19 · feat(plans): the 19 Nov supplier plan numbers + the Ultra Add-on

Owner, 19 Nov, verbatim: *"use what is on max be named ultra and remove the current ultra"* · *"just 1 pack"* ·
*"Ultra Addon"* · *"2490"* · *"they only buy the … pack"* · *"we do not limit the potential of a card"* · *"shop page
also is 1 for all already"* · the final table: *"this is good"*. Specs: SUPPLIER_PLANS_CHANGE_PLAN_2026-11-19.md §B.

- **The ladder (no fifth tier)** — people incl. the owner · live cards · branches besides the main shop · storage:
  Free 1·1·0·— · Verified 1·3·0·— · Plus 2·10·0·5 GB · Pro 5·27·1·10 GB · Ultra 16·68·3·20 GB. `TIER_CAPS`,
  `vendor_plan_contents` and the `vendor_tier_limit` fallback move together (migration `20271351415438`).
- **Price:** Pro ₱3,990 per 4 weeks (was ₱4,990). Monthly rows only — the yearly price is an open owner call, so no
  annual row is touched.
- **The same on every plan:** morning + afternoon slots (`slotsTimeBounded`), the shop page with its own web address
  and the Pro page parts (`website`, `customWebsiteName`, `premiumPage`).
- **The Ultra Add-on — the ONE add-on:** +1 branch · +15 live cards · +3 people · +50 GB, ₱2,490 per 28 days, Ultra
  only, may be bought more than once. SKU `vendor_ultra_addon`, the paid count `vendor_profiles.extra_ultra_addons`
  (recomputed by the existing activation hook; self-grant refused by the entitlement guard). The database's branch
  and storage gates add it; the app adds all four (`applyAddOnExtras`, seats, storage). Bought from a new row on the
  Plan page; shown in the Plans table and the line under the plan cards.
- **No new single seat or branch is sold** (`canBuyExtraSeats` / `canBuyExtraBranches` are false on every plan). One
  already bought is kept and renews (`holdsExtraSeats` / `canRenewExtraBranches`); their catalogue rows stay active
  for that reason. The invite "at cap" seat-fee hint is gone — Ultra is pointed at the Ultra Add-on.

SPEC IMPACT: None in this PR — the rulings are in the corpus DECISION_LOG 2026-11-19 and the change plan (ac15265b).
Owner calls still open (PR status comment): existing subscribers over a lowered limit, the retired single extras'
renewals, and when the new Pro price applies to a current subscriber (change plan §C).
