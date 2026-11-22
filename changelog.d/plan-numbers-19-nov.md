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
- Plan page: a held add-on row reads "Ultra Add-on 2 · Until Thu 17 Dec 2026" (the number moved to the title) — at 375 px the end date was cut off. §4 shots: `build-sessions/shots-plan-numbers/renew-*`.
SPEC IMPACT: None.

### Refunds of a renewal can no longer fail silently (20 Nov, round 4)
- `ultra_addon_reverse_renewal` returns TRUE (28 days taken back), FALSE (applied, but the add-on already ends before the renewal's mark, so nothing was taken) or NULL (nothing to undo). The deactivation hook reports FALSE through `reportActivationFault`, so a reversal that moved nothing never looks like one that worked. The return type changed while the migration is unshipped, so the file drops the function before re-creating it.
- Both renewal functions lock the add-on row before the renewal row, so an approval and a refund (or two refunds) on one add-on serialize and cannot deadlock.
- If the original add-on itself is refunded, renewals already paid on it lose their value. That stays Setnayan's call, by hand (controller note).
- DB test `renewing-an-ultra-addon-extends-that-one.db.test.ts`: 13/13. New: refund the latest renewal (the earlier mark stays) · refund after the add-on has ended (28 days come off the end it set, never off today; no live window; taken once only) · a refund that takes nothing says FALSE · two add-ons on one shop stay independent through out-of-order refunds (B's mark, end and reminder lock never move).
SPEC IMPACT: None.

## 2026-11-22 · fix(plans): Specialized tools come with Pro and Ultra only — Plus no longer includes them; no "Max" left

Owner, 21 Nov, verbatim: *"or we just place it with Supplier Pro and Up."* → *"Yes, Pro and up"*; 22 Nov: *"i remember
us retiring max already"* (DECISION_LOG 2026-11-21 "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP", 2026-11-22
"CORRECTION — THERE IS NO MAX PLAN").

- `SPECIALIZED_TOOLS_INCLUDED_TIERS` is `['pro', 'enterprise']` (was `['solo', 'pro', 'enterprise']`). The Plans table,
  the plan sheet row and the For Suppliers lines read it, so Plus now says "Free set" / "The free set · all of them
  from Pro" and Pro carries "All specialized tools, included". No copy was typed; every line is derived from the gate.
- **The database half:** migration `20271358646819` rewrites `vendor_specialized_tools_unlocked` with the plan arm
  `('pro', 'enterprise')`; the paid-window and trial arms, the signature and the grants are verbatim. No table, row or
  price is touched. Prod has no shop on Plus today (measured 22 Nov), so nobody loses anything. Applied only by the
  pipeline, on the controller's go.
- A verified Plus shop is once more on the buying side of the (off-sale) unlock, the same as Verified; a window
  already bought still runs to its end.
- Comments in `lib/vendor-tier-caps.ts` no longer name a "Max" plan (five plans: Free · Verified · Plus · Pro · Ultra);
  the service-card docblock states the 19 Nov numbers the table already holds.
- **The locked Cake Maker demo's bar** (shipped in #8112) read "Pro, Max and Ultra"; it now reads **"This special
  tool is available on Pro and Ultra"** with its Upgrade button (`CAKE_DEMO_BAR_WORDS`, DECISION_LOG 21 Nov "A LOCKED
  SPECIAL TOOL SHOWS ITS FRONT-END EXPERIENCE", amended 22 Nov). The demo itself is unchanged: the couple's designer on
  sample options, nothing read, saved or sent, no price shown; the settings stay Pro and up.
- Tests: `a-locked-cake-maker-is-a-demo.test.ts` (the bar's words), `specialized-tools-free-tier.test.ts` (5b), `vendor-plan-rows.test.ts`, DB `specialized-tools-unlock` (2a, 2b,
  and 2f, which holds the TS mirror to the SQL on every case) and `pro-tools-come-with-pro` (2).
- Merged `origin/main` (merge commits only, no conflicts on this catch-up). Generated baselines were NOT regenerated
  here; that is the ship session's, once per batch.

SPEC IMPACT: None — the rulings are already in the corpus DECISION_LOG (21 and 22 Nov rows).

## 2026-11-22 · fix(plans): the ship fix pass on PR #8019 — the buyer cannot set their own add-on window; seats, storage and branches a shop pays for are never drawn (or paused) as full

Two read-only audits of the PR head found six things. Each fix has a test that was sabotaged once and seen red.

- **A · security — `orders.expires_at` is the server's.** `authenticated` could UPDATE `orders.expires_at` on its own
  submitted order (the table grant + `orders_owner_write`; `guard_orders_protected_columns` did not list the column),
  the activation hook stamped a window only where it was empty, and `vendor_live_ultra_addons` counts an order while
  `expires_at > now()` — so a buyer could type a far date before paying and keep the Ultra Add-on for one payment.
  NEW forward-prefixed migration `20271358916247_orders_expires_at_is_the_servers.sql` (made with
  `pnpm migration:new`; not applied by hand): the guard's body, byte-identical to its newest prior definition
  (`20271008300000`), plus `or new.expires_at is distinct from old.expires_at`, with the bypass it already had (the
  service role, SECURITY DEFINER functions, `is_admin()`). The hook is also safe on its own: a FIRST activation (no
  `service_activated` ledger row — a row only the service role can write) overwrites whatever window is on the order;
  only a re-approval keeps one, so a renewal's extension is never reset (`addOnWindowStamp`). Tests: DB
  `orders-expires-at-is-the-servers.db.test.ts` (the owner's UPDATE refused; the service role's allowed; an owner update
  the guard allowed before still works) and `vendor-ultra-addons.test.ts`.
- **B · two public pages still promised every special tool on Plus.** `/pricing` ("All specialized tools") and
  `/features` ("All specialized tools included") had the line TYPED on the Plus row. Both are now placed by
  `SPECIALIZED_TOOLS_INCLUDED_TIERS` (`lib/supplier-plan-public-words.ts`): the line sits on Pro; Plus says what it
  holds — on `/pricing` its numbers from `TIER_CAPS` ("10 live cards · 2 people · 5 GB"), on `/features` the Plan
  page's own words ("Specialized tools: the free set · all of them from Pro"). `/for-suppliers` already read the list.
  Guard: `public-plan-surfaces-follow-the-tools-gate.test.ts`.
- **C · the seat-pause job would have locked out seats a shop pays for.** It read `canBuyExtraSeats(tier)` — false on
  every plan since this PR — and never counted Ultra Add-on people. The allowance is now the plan's people + the single
  seats the shop still HOLDS + 3 per live Ultra Add-on, from ONE rule (`extraPeopleHeld`, `lib/vendor-seats.ts`) that
  the Team page's cap and the invite gate read too. The add-on count is a measured read: unread → the job aborts and
  pauses nobody. ⚠ One behaviour change to know: the invite gate used to count stored single seats on ANY plan; it now
  counts them on the plan that holds them (Ultra), as the pause job and the downgrade sheet already did. Production
  has no shop with a paid single seat. Test: `seat-pause-counts-what-the-shop-holds.test.ts` (runs the job).
- **D · a failed add-on read was drawn as "full".** The live Ultra Add-on count now has a measured read
  (`readLiveUltraAddOns` → `unread`); the soft 0 stays for gates only. The upload check answers `unavailable` past the
  plan's own floor (never `full`); the Plan page's Storage row, the Team's seats line and Where you work's branch form
  say they couldn't load; the invite and branch refusals say "couldn't check" instead of "limit reached" / "all in
  use". Test: `an-unread-addon-count-is-never-full.test.ts`.
- **E · screens.** (1) At 375 px the Ultra Add-on buy row cut off its own price: it is two house rows now — what it
  gives (no control beside it), then the PRICE as the title of the row with "Add one". (2) "+1 branch · +15 live cards
  · +3 people · +50 GB" is built once (`ultraAddOnGivesWords`, from `ULTRA_ADDON_GIVES`) for the Plan row, the Plans
  table and the purchase label. (3) For Suppliers › Plans ⓘ draws the approved drawing's two lines: "Branches and
  storage." (from `TIER_CAPS`) and the Ultra Add-on line (its price from the catalogue row; unread → not drawn).
  (4) `buyMoreLine` had no reader and is deleted. ⚠ Not seen in a browser — the app could not be run on the build
  machine that day. Test: `the-ultra-addon-is-said-once-and-fits-a-phone.test.ts`.
- **F · small.** `ultra_addon_apply_renewal` accepted status `paid` or `fulfilled` while the live count counts `paid`
  only; it now takes `paid` only (no code path writes `fulfilled` on an order, and every other reader of an add-on
  asks for `paid`). The header of `20271351415438` no longer claims its prefix sorts after every migration.
  `renewBranch`'s refusal no longer says single branches are "sold with Ultra only" (none is sold; one already paid
  for renews on Ultra).
- **The four open calls, closed by the controller and the owner on 22 Nov, and what was built for them:**
  - *Renewal* stands as built (a renewal extends its own add-on from its own end + 28 days; a refund takes exactly 28
    back). *The retroactive 28-day window on paid "+1" orders* stands as built.
  - **The single extra seat lasts 28 days per payment too** (controller: "fix the single extra seat the same way").
    `extra_agent_seats` counted every paid `vendor_extra_seat__<shop>` order with no window. Now the hook stamps each
    seat order's own window through the ONE shared stamp (`stampAddOnWindow`), `recomputeVendorExtraSeats` counts paid
    orders whose window covers now (and throws on an unread count instead of writing 0), migration `20271351415438`
    §5a gives older paid seat orders their window and §5b's `recount_vendor_count_addons()` lowers a lapsed seat.
    ⚠ To know: there is no seat renewal in the app and no seat is sold, so a held seat runs out 28 days after it was
    approved; for the same reason seat orders are left out of the renewal reminder. On apply, a seat approved more
    than 28 days ago stops counting at once — re-measure `select count(*) from vendor_profiles where
    extra_agent_seats > 0` before the pipeline applies it (the controller's figure on 22 Nov: no shop holds one).
    Guards: `a-paid-seat-lasts-28-days.test.ts`, DB `vendor-plan-allowances` ("A PAID SINGLE SEAT…").
  - **No yearly Ultra Add-on row.** None existed in the code, copy or migrations; a guard now holds it (unit + DB:
    the catalogue has exactly one `vendor_ultra_addon` row, per 4 weeks).
  - **Add-ons stack** (owner: "Yes, they can stack"). As built: every reader multiplies by the live count (the two
    database gates, `applyAddOnExtras`, `extraPeopleHeld`, `storageAllowanceBytes`, Where you work); a guard holds it
    for 1, 2 and 3. The Plan page says the words per add-on ("Each Ultra Add-on adds") above one numbered row per
    add-on held.
- No price, limit or period was changed. No server action was added. Generated baselines were NOT regenerated (the ship
  controller's).

SPEC IMPACT: None — no ruling is changed; the rulings applied are the corpus DECISION_LOG rows of 19–22 Nov.
