## 2026-11-15 · feat(gifts): gift for services — the supplier picks the couple's gift when they agree; the photo gift retires

Owner rulings: DECISION_LOG 2026-11-15 "GIFT FOR SERVICES DESIGN — DECISIONS" (specs 7fbff0cd), on top of the 14 Nov gift rows. Built on #7678 (G1: packs, one price per gift, Ultra at list), which is merged into this branch.

- **The Agree step** (the customer card and the chat's booking-ask panel) now shows three lines and a total: Booking fee · Setnayan gift for the couple's event services · You pay if you agree. The gift row opens a sheet:
  - one row per pack on sale, at its list price from `platform_retail_catalog_v2`, with − / +;
  - "In your stock (N)" when the shop holds that gift;
  - the limit, "₱X of ₱Y · your gift limit";
  - "Most credits for your limit", shown only when the gift is all Papic and a better mix exists.
- **The picks post with the yes.** Each is a `gift` field on the shipped Agree form, and `vendorAgreeToLock` hands them to the new SQL door `booking_gift_pick` after the fee is minted. No new server action.
- **The door re-judges every pick.** It prices every code at the list price and refuses:
  - a plan the event already holds (Ultra still upgrades Plus or Pro);
  - more than one plan;
  - a pick over the gift limit of this booking's billed fee, with stock lines counted. The smallest Papic pack alone always fits.

  It takes from the shop's gift stock first, and adds the rest to that booking-fee bill (fee + gift). The bill names the items.
- **Delivery:**
  - Bought Papic lands through the shipped grant door when the bill is paid.
  - A bought plan lands then too, through `booking_gift_give_bought_plans`, as a bought/given pair the entitlement chain reads. A plan the event already holds stays in the shop's stock.
  - Stock gifts are held, and given at the couple's first payment by the shipped stock doors (which now also read the agree picks).
- **The old automatic "N free Papic photos" gift retires.**
  - A new charge is never offered it, and a bill that already carries it keeps it.
  - The quote readers, the composer, the card's gift line and the card's Gift dropdown no longer promise it. A card saved with it keeps the value, and it is labelled retired.
- **Tests:**
  - `lib/the-gift-is-picked-when-the-supplier-agrees.test.ts`: 7 tests.
  - `tests/db/a-gift-is-picked-when-the-supplier-agrees.db.test.ts`: 8 tests, sabotage-checked.
  - Five DB tests that pinned the photo gift on new charges now stand up a charge raised before the retirement (`tests/db/a-charge-from-before-the-photo-gift-retired.ts`).
  - The badge-reward test 8 follows the retirement.

- **No bill, stock only** (owner 16 Nov, DECISION_LOG `03e465e1`). On a free, promo, badge-paid or imported booking the picker offers only gifts the shop already holds, sized on the fee the booking would have carried. `booking_gift_pick` takes stock-only picks there: it answers `stock_only` when anything would have to be bought, and never makes a bill.

SPEC IMPACT: None. This implements the 15 Nov DECISION_LOG row and the owner's 16 Nov answers (`03e465e1`): the gift is items picked at Agree, every shop pays the list price, and a booking with no bill gives stock only.
