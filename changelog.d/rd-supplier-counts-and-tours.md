## 2026-10-22 · feat(supplier): a new shop is counted for what it was asked · first-visit tours for Shop, Dates, Money and the Hub

Owner "Yes to all", 2026-10-22 — `Setnayan/prototypes/journey_fixes_2026-10-22.html` § Supplier 2 (Option A)
and § Supplier 3.

**Supplier 2 · A — ask what we count.**
- Open-shop step 2 asks "In business since · optional" as ONE dropdown ("Just starting" first, then the
  years); a shop that already has a year is never asked again, and the action writes it only when the shop
  has none (`lib/in-business-since.ts`).
- The logo leaves the hidden "N fields left" (`profileGaps`) and becomes its own Today first step, second:
  "Add your logo — Needed to go live — couples see it on every card." Approval still needs it: the submit
  gate says "Add your logo" when it is the one thing left (`verificationSubmitMissing({ onlyLogoMissing })`).
  Today is now "N of 7".
- One document count everywhere — the four required papers: "n of 4 required" on the Get-verified stepper,
  Today and Your details; "Required · n of 4" or "Optional" on a card (never "Item n of 8").
- Contacts: until a VALIDATE text number exists the step is email alone — "0 of 1", it can finish, and the
  "Text number coming soon" line is gone.

**Supplier 3 — tours.** The written Shop and Hub tours (`vendor_shop_v1`, `vendor_hub_v1`) become
spotlights with the drawn stops (3 · 3); `vendor_dates_v1` (3) and `vendor_money_v1` (4) join them. Each
waits for `supplier_spotlight_v1`, none repeats its stops, and they are mounted ONCE in the supplier layout
and chosen by address (`lib/supplier-page-tours.ts`) so the Shop tour survives its walk into Page. Anchors
are `data-tour` on elements that already exist. The Money tour's free count is `FREE_BOOKING_LIMIT`.

Guards: `app/vendor-dashboard/a-new-shop-is-counted-for-what-it-was-asked.test.ts`,
`app/vendor-dashboard/_components/each-supplier-page-has-its-tour.test.ts`; `vendor-first-steps.test.ts`,
`the-simpler-today-keeps-every-door.test.ts`, `the-supplier-foundations-hold.test.ts` and
`spotlight-anchors-exist.test.ts` changed on purpose citing the ruling.

SPEC IMPACT: DECISION_LOG.md 2026-10-22 "A NEW SHOP IS COUNTED FOR WHAT IT WAS ASKED" and "FOUR SUPPLIER
PAGE TOURS".
