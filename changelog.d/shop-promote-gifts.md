## 2026-11-05 · feat(shop): Shop › Promote — Your gifts moves from the Plan page (part 2)

Owner ruling 5 Nov (DECISION_LOG "SHOP › PROMOTE IS THE HOME OF THE SUPPLIER QR CODES, PRINTS AND GIFTS"): one Promote
place for every marketing tool. Part 2 brings the shop's gifts.

- **Your gifts** (the gift stock · Buy gifts · Bought) now draws on **Shop › Promote**, under the QR codes — the same
  `ShopGiftsSection`, same words, same behaviour, moved to `shop/promote/_components/shop-gifts-section.tsx` (now
  addressable as `#gifts`). Its reads moved with it, unchanged, into `shop-gifts-data.ts` (`loadShopGiftsSection`).
- **The Plan page no longer draws or reads it** — and does not link to it (no "Edit in X ↗"). No in-app link pointed at
  the section on Plan (it had no anchor), so none needed re-aiming.
- **Promote's pinned row gets its first figure: gift credits** (`promoteFigures` in `lib/shop-section-figures.ts`),
  the stock balance from the SAME read the section draws — unread → "—", never 0. The Shop ▾ hint reads
  "QR codes · gifts for couples".
- Buying a gift now refreshes Promote (`revalidatePath`) instead of the Plan page it left.
- Unchanged, by design: giving a gift on a quote (`quote-shop-gifts.tsx` reuses the section's Buy sheet from its new
  path; `proposal-maker.tsx`), and Admin › Gifts.
- Guards: `shop/promote/gifts-live-on-promote.test.ts` (new); `the-shop-sections-are-v13.test.ts` now requires the
  Promote row's `promoteFigures(` fed by the gifts read; `lib/shop-section-figures.test.ts` covers `promoteFigures`.
- Ugat screens regenerated.

Not in this change: Prints · Booked · one-use onto the customer card (later parts).

SPEC IMPACT: None beyond part 1's DECISION_LOG row, which already rules gifts into Promote.
