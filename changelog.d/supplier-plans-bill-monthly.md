## 2026-11-23 · feat(plans): supplier plans bill by the calendar month, not every 4 weeks

Owner, 23 Nov: *"the plan is not per 4 weeks. it is now monthly"*. This builds DECISION_LOG 2026-11-22 "SUPPLIER AND COORDINATOR PLANS AND THE ULTRA PACK BILL MONTHLY EVERYWHERE … REPLACES 'EVERY 4 WEEKS'" (3) and "NO YEARLY SUPPLIER/COORDINATOR PLAN ANYWHERE". The iPhone app already bills these plans through Apple by the calendar month; the web now matches it.

- **Migration `20271360344805_supplier_plans_bill_by_the_calendar_month.sql`:**
  - A new internal `vendor_plan_term_end(start, billing_cycle, period_days)` is the one place a plan term's end is worked out. Monthly = start + 1 calendar month on the Manila calendar (Jan 31 → Feb 28, or Feb 29 in a leap year). It is granted to no user role.
  - `create_vendor_subscription`: the rule "a purchase must cover the time you already have" now asks whether a month started today would end before the plan already held. The order row carries the days of that month.
  - `_apply_subscription_credit`: a first purchase, a renewal or an upgrade ends 1 calendar month after it starts. The purchase's `period_days` is rewritten to the days that month holds (28–31), so `vendor_unused_plan_value_php` (unchanged) reads the unused credit over the real month. An Apple row keeps Apple's own day count.
  - `sweep_vendor_tier_expiry`: a paid scheduled plan lands for 1 calendar month (it used to be `COALESCE(pending_tier_period_days, 28)` days) and stamps its days on the purchase.
  - The three monthly SKUs' titles become "Plus (monthly)", "Pro (monthly)" and "Ultra (monthly)" (they said "(4 weeks)"). Prices are untouched.
  - A shop already paying keeps its running 28-day period: no `tier_expires_at`, `expires_at` or paid `period_days` is rewritten. Its next renewal adds a month from that end.
  - Post-conditions check the month maths and that no plan path still adds 28 days.
- **The plan picker** (`plan-screen.tsx`) uses `monthlyTermIsTooShort` / `oneCalendarMonthOnMs` (`lib/vendor-plan-change-words.ts`), the TS copy of the same month. The admin comp hint ("1 month from today") uses it too.
- **Words:** every supplier/coordinator plan word now says month, per month or monthly. This covers /pricing (JSON-LD `P1M`), /for-suppliers (JSON-LD `P1M`, metadata, the stairs, the tools door, the plan table's "Every month" row, How we earn), llms.txt, the supplier feature page (en + tl), help, the plan sheet and plan screen, admin subscriptions, admin request cards, the personal-invite offer, `lib/feature-pages/price.ts` `subscription_monthly`, and the plan comments.
- **Not changed (not in this ruling):** add-ons (Papic challenge, 3D booth, AI, specialized tools, Ultra seat/branch), badge rewards and upgrades, Setnayan plan gifts ("28 days of a plan"), the Founders/verification reward sets, the launch-offer cycle, the couple `per_28d` billing period, and "last 28 days" analytics.
- **Guards:**
  - `tests/db/a-supplier-plan-bills-by-the-calendar-month.db.test.ts` covers a monthly order end to end, renewals across month ends (Jan 31 → Feb 28 / Feb 29, Mar 31 → Apr 30), a chained renewal, a running 28-day term keeping its end and its credit, the month-long credit maths, a scheduled plan landing, the month-shaped term boundary, the titles, and no EXECUTE for anon/authenticated.
  - `vendor-plan-change`, `a-verified-shop-can-buy-a-plan`, `personal-invite-offer`, `vendor-plan-change-words` and the /for-suppliers tests move with the month.
- Server actions: no new export.

SPEC IMPACT: None. It builds the existing 2026-11-22 DECISION_LOG rows. Open questions for the controller are in the PR.
