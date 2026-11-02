## 2026-10-23 · fix(money): "booked, amounts not set" is not "No payment plans yet"

From the coordinator walk (owner, 23 Oct: "Keep what we have first and make them run smoothly"). On Customers › Money,
a shop whose bookings' instalments are all a % of a total that was never set has nothing to sum (`pct` null), and was
told "No payment plans yet — a couple's plan shows here once they book you" above its own Next-in rows. It now says
"N payments have no amount set yet, so they are not counted above"; "no plans" is kept for nothing booked.
One decision, `moneyTopLine` (`lib/vendor-money.ts`).

Guard: `app/vendor-dashboard/customers/no-amount-set-is-not-no-plan.test.ts`.

SPEC IMPACT: None.
