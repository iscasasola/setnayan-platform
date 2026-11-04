## 2026-11-05 · feat(supplier-gifts): slice 1 — gift stock, Buy, a gift on a quote, given at the first payment, admin ledger

Owner rulings DECISION_LOG 2026-11-04 ("SUPPLIER GIFTS: BOUGHT IN QUANTITY, KEPT AS STOCK" and the gift-limit rows);
build notes `SUPPLIER_PLANS_GIFTS_QUOTES_BUILD_NOTES_2026-11-04.md`; prototype supplier dashboard v59 ("Your gifts", the
quote's "Gifts from you"). Papic credits only in this slice. Stacked on #7262 (the final price sheet: `gift_price_php`,
`vendor_pays_gift_price`, the shop's Papic packs).

- **Migration `supplier_gifts_stock_quote_lines_and_delivery`** (RLS at CREATE TABLE): `shop_gift_purchases` (how many
  of which pack a gift order bought — `orders` has no quantity), `shop_gift_stock_entries` (the shop's signed gift
  ledger: bought + · given − · reversal −, sign tied to kind, one bought/reversal per order), `vendor_proposal_shop_gifts`
  (the gift lines a sent quote carries). `shop_gift_stock_status` (balance · held on live quotes), and the ONE door
  `shop_gift_deliver_for_booking` (service role only): gives the accepted quote's credits, minus what that event already
  got from that shop, into the event's SHARED Papic pool (new pool source `'shop_gift'`), under a per-shop lock;
  refuses and writes nothing when the stock is short. Kept apart from the shop wallet on purpose — gift stock can only
  reach a couple's event.
- **Supplier · Plan › Your gifts** (`subscription/_components/shop-gifts-section.tsx`): the stock row ("N free to offer
  · M on sent quotes", never "0" on a failed read), **Buy gifts** sheet (Gift ▾ · How many − n + · Total · Pay with ▾ ·
  Pay ₱X), the Bought list (Checking / Refunded). Buying reuses the shipped `buyVendorPapicPortfolioPack` with `for=gift`
  + `quantity` (the server-action budget is full): order key `vendor_gift__<code>`, the catalogue's gift price for
  Verified-and-up, the list price for Free. Approval lands the stock (`grantShopGiftPurchase`), a refund takes it back
  (`reverseShopGiftPurchase`).
- **Supplier · the quote › Gifts from you** (`app/_components/quote-shop-gifts.tsx`, under the money rows): the limit
  (40% of this booking's fee — `GIFT_SHARE_OF_FEE_PCT`, reused — Papic 150 always allowed), gift rows (swipe left →
  Remove, Undo), the worth / over-limit / short lines, "＋ Add a gift from your stock" (each pack says why it can't go
  on), "Buy more gifts…". Sent as `shopGiftCodes`; `sendCustomProposalCore` re-judges them on a fresh read and writes
  the lines while the quote is still a draft, so a refusal deletes it (new notice `proposal_gift_refused`).
- **Couple · the quote page**: "Gift from <shop> 🎁 · N Papic credits" — "added when your first payment is confirmed",
  then "added to your event's Papic credits" (`app/_components/quote-shop-gift-note.tsx`).
- **The first payment** (`runDepositAcknowledgedEffects`, every door): gives the gift. Independent of the fee; logged
  every time, Sentry on `short` / `error`.
- **Admin › Gifts & comps › Supplier gifts** (`admin/gifts/_components/shop-gifts-ledger.tsx`): the ledger (bought ·
  given · reversed, with order refs and whether it reached the pool) and what live quotes still promise.
- Dev labs: `/dev/supplier-plan-lab?s=gifts|gifts-couple|gifts-admin`, `/dev/supplier-chat-lab?m=quote&gifts=1|over|short`.
- Tests: `lib/shop-gifts.test.ts` (3 sabotages, each red), `tests/db/a-supplier-gift-lands-once.db.test.ts`. Ugat J20
  claims the three tables.

SPEC IMPACT: None to the decisions — builds the 2026-11-04 rulings. Open questions are listed in the PR body, not
decided here: two Event Plus on one quote → one Event Pro (not ruled; Plus/Pro gifts are the next slice); the brief's
"accepted → lands" vs the log's "leaves stock at the first payment" (built to the log; promised at accept); the brief's
"admin-editable 40%" vs the log's "the SAME 40% as the Setnayan gift" (built to the log, shown read-only on admin).
