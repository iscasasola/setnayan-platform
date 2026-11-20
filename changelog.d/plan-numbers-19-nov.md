## 2026-11-19 · feat(plans): the 19 Nov supplier plan numbers + the Ultra Add-on

Owner, 19 Nov, verbatim: *"use what is on max be named ultra and remove the current ultra"* · *"just 1 pack"* ·
*"Ultra Addon"* · *"2490"* · *"they only buy the … pack"* · *"we do not limit the potential of a card"* · *"shop page
also is 1 for all already"* · the final table: *"this is good"*. Specs: SUPPLIER_PLANS_CHANGE_PLAN_2026-11-19.md §B.

- **The ladder (no fifth tier)** — people incl. the owner · live cards · branches besides the main shop · storage:
  Free 1·1·0·— · Verified 1·3·0·— · Plus 2·10·0·5 GB · Pro 5·27·1·10 GB · Ultra 16·68·3·20 GB. `TIER_CAPS`,
  `vendor_plan_contents` and the `vendor_tier_limit` fallback move together (migration `20271351415438`).
- **Price:** Pro ₱3,990 per 4 weeks (was ₱4,990). Pro's yearly row is DERIVED in SQL as 10× (₱39,900, was ₱49,900),
  following the guarded 2026-11-04 rule "a year = 10× the 4-week price" (`a-year-is-ten-four-week-cycles.db.test.ts`);
  the owner ruled it stays (§C item 2). So one annual row IS touched: `pro_vendor_annual` moves with Pro's 4-week row;
  Plus's and Ultra's yearly rows do not move. The yearly plan rows carry the same seat caps as the monthly.
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

- **⏳ Every add-on payment buys 28 days, never forever (review fix).** `recomputeVendorAddOnCount` counted every paid
  "+1" add-on order (category · service card · wait list · booking per date) with no expiry. Now the activation hook
  stamps EVERY count add-on order's own window (`orders.expires_at` = approval + 28 days, once), the recompute counts
  only paid orders whose window ends after now (an unread count throws instead of writing), the migration gives every
  older paid "+1" order its window (first `service_activated` ledger row + 28 days, else created_at + 28 days), and a
  new hourly request-driven job (`count-addon-recount` → `recount_vendor_count_addons()`, service role only) lowers a
  stored count when a window lapses with no order event. Tests: `vendor-ultra-addons.test.ts` (the window rule) and
  `vendor-plan-allowances.db.test.ts` (two live + lapsed + refunded + window-less = 2; the shop cannot call it).
- **📮 The Ultra Add-on gets the renewal reminder** (owner 2026-11-19, specs ad44b079, "all your picks"). It goes through the
  ONE existing sender, the daily `renewal-reminders` job (`runRenewalReminders` over
  `subscriptions_due_for_renewal_reminder`, through `sendEmail`). No second sender. That path has no allowlist:
  `EMAIL_ENABLED_TYPES` gates only `emitNotification` types, so what decides who is mailed is the SQL function, and a
  paid Ultra Add-on order with its 28-day window is selected 7 days before it ends. New pure
  `lib/renewal-reminder-products.ts`: it is named "Ultra Add-on", says "four prepaid weeks" (not "a year"), and opens
  the Plan page; every older product reads exactly as before. The four retired "+1" add-ons are left out of the SQL,
  because they are no longer sold and their orders now carry windows. Tests: `lib/ultra-addon-renewal-reminder.test.ts`
  and a DB test (a due Ultra Add-on is picked, a retired "+1" is not, and none is picked twice in one window).
- **§C tests:** `lib/lowered-limits-keep-what-you-have.test.ts` (an over-limit shop keeps its cards, branches and people
  and cannot add one; the migration takes nothing away) and `tests/db/pro-renews-at-the-price-of-the-day.db.test.ts`
  (a current Pro subscriber's renewal is billed the catalogue price on the day it renews; Pro's year = 10×).
- **Existing subscribers (owner ruled change plan §C, "Yes, all five"):** the lowered limits apply — a shop over one keeps
  what it has and cannot add; Pro's year stays ₱39,900 (10×); a single seat or branch already paid for renews until it
  lapses and is never sold new; a current Pro subscriber moves to ₱3,990 at the next renewal (the catalogue price);
  the Films layer opens to every plan.

SPEC IMPACT: None in this PR — the rulings are in the corpus DECISION_LOG 2026-11-19 (incl. the §C "Yes, all five")
and the change plan (ac15265b).

### Renewing an Ultra Add-on extends that add-on (20 Nov, controller ruling on review, option A)
- The Plan page lists each live Ultra Add-on with its end date and its own **Renew** button. A renewal is an order keyed `vendor_ultra_addon_renew__<the add-on's order_id>`; on approval `ultra_addon_apply_renewal` moves THAT add-on's window to its own live end + 28 days (a lapsed one restarts from today). No other add-on moves, the renewal is never counted as an add-on, a re-approval changes nothing, and a refund takes back exactly its 28 days (`ultra_addon_reverse_renewal`).
- "Add one" still buys a new add-on; a renewal without an order id (or for an add-on that has lapsed) is a new add-on. An order id that is not the shop's own add-on is refused.
- Renewal orders are a supplier paying Setnayan (`vendor-pays-setnayan`) and are not sent their own renewal reminder.
- DB test `renewing-an-ultra-addon-extends-that-one.db.test.ts` (two live add-ons; 6/6). No new server action — folded into `buyUltraAddOn`.
SPEC IMPACT: None beyond the ruling already in the PR's STATUS (Decisions).

### Review fixes on the renewal (21 Nov, money builder)
- A renewal now clears THAT add-on's `renewal_reminder_log` rows, so it is reminded again before its new end (it was reminded once and then never again). Other orders keep their once-per-window lock.
- Refunds out of order: refunding the first of two renewals now takes its 28 days back (the add-on ends at or after that renewal's mark) and moves every later renewal's mark of the same add-on down by 28 days, so each can still be undone exactly. An add-on that already ends before the mark is left alone. The add-on's reminder lock is cleared when its end moves back.
- The migration sets `SET LOCAL lock_timeout = '5s'` after `BEGIN` (it ALTERs `vendor_billing_catalog` and UPDATEs `orders`).
- DB test `renewing-an-ultra-addon-extends-that-one.db.test.ts`: 9/9 (3 new; the two defect tests were shown red first).
SPEC IMPACT: None.
