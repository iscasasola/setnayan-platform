## 2026-11-07 · fix(service-card-maker): the shipped card maker in the approved house shape, with one Gift dropdown

Fixes the SHIPPED maker (`canvas-maker.tsx`), not a new screen — owner, 7 Nov: *"all changes as this designs are to be
fixed on the current design. we do not invent or create a new one, we just fix the old one."* Approved design:
Setnayan-specs `prototypes/makers_match_2026-11-07/makers-match.html` §3 · DECISION_LOG 2026-11-07 "THE FOUR MAKERS
ARE APPROVED".

- **House shape.** A pinned row (the service this card is for on the left, Preview and ⓘ rounds on the right, no page
  title) → the card's name + one line → Name · Specialties (optional) · Price (the basis dropdown with its hint, the ₱
  box, “Price · more”) · What's included (at least one line) · Extras · Gift · Photos → the thumb row: Cancel (grey) ·
  Save card (the brand main), the shipped `ActionButton` at equal heights. One rhythm: 48 px boxes, 40 px pills, the
  same gap between topics, dividers between them, no boxes around groups. From 820 px the surface and "As couples see
  it" split evenly; the preview is sized to its words.
- **More settings lives on the SAVED card.** Discounts, Booking terms, Payment schedule, Crew, Who it is for, Details,
  Comes with, Record, Portfolio, Live · delete · copy and Schedule wait until the card exists, and are all still there
  on `/vendor-dashboard/services/[id]`. Nothing deleted. A new card still posts what it always defaulted
  (book-ahead months for its type; a crew-meals card is the crew meal).
- **What's included needs a line on a new card** — Save card says “Add what's included — at least one line.” under the
  field instead of saving a card couples are never shown.
- **Gift = one dropdown.** No gift (default) · Setnayan gift (posts `includes_setnayan_gift`, as the switch did) · the
  shop's own packs from `lib/shop-gifts.ts` (Papic credits · Event Plus · Event Pro), read from the live catalogue and
  stock (`fetchCardGiftMenu`). A pack the stock cannot cover is listed, not pickable: “Not enough in your stock · buy
  first”. The preview shows `SETNAYAN_GIFT_CARD_COPY` or the couple's headline (`coupleGiftHeadline`). No price or
  count is typed anywhere.
- **Rows swipe left to remove, with Undo** (What's included · Extras) — the shared `SwipeToDelete` + `deleteWithUndo`;
  the ✕ on those rows is gone. Extras rows are controlled now, so Undo brings back what was typed.
- **Migration `20271320363790_a_card_can_carry_a_shop_gift`** — one nullable column `vendor_services.card_gift_code`
  with a CHECK naming the giftable codes; RLS unchanged (the row's own policies). Written after `save_vendor_service`
  by `writeCardShopGift`, owner-scoped, only while the stock covers one. Shop gifts on a CARD are new: it advertises
  the gift; stock still leaves only through the quote door. Ugat map claims it on the Papic ↔ Vendor joint.
- Maps regenerated: `port-control-baseline.json`, `lib/ugat/screens.generated.json` (the design-rules baseline did
  not move). Tests that pinned the old layout now pin the approved one.

SPEC IMPACT: None in the corpus — implements the already-logged DECISION_LOG 2026-11-07 row. Flag for the owner: a
card's shop gift is ADVERTISED on the card; carrying it onto the quote automatically is not built (the quote's
"＋ Add a gift" still adds it by hand).
