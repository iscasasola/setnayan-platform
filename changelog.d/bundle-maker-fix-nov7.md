## 2026-11-07 · feat(bundle-maker): [migration] the bundle maker is fixed to the approved design — cards first, More settings, swipe + Undo, and a Gift row

Owner, 7 Nov 2026 (DECISION_LOG "THE FOUR MAKERS ARE APPROVED — BUILD THEM AS FIXES TO THE SHIPPED SCREENS, NEVER NEW ONES"; prototype `makers_match_2026-11-07` § 4): *"all changes as this designs are to be fixed on the current design. we do not invent or create a new one, we just fix the old one."* And on the makers: *"where are the gifts?"*

The shipped `packages/_components/package-editor.tsx` is fixed in place (same fields, same copy, same `savePackage`):

- **Service cards first, as locked lines.** "Add a card" is one dropdown of the shop's service cards; each picked card is a line with its own from-price and a lock. The name is written from the cards until the supplier types their own. Extra inclusions come after, as lines (what · category dropdown · worth).
- **Spendable budget and "money freed" move under More settings** (the shipped `Fold`); the Off/On explanation moved into the ⓘ.
- **Lines remove by their swipe, with Undo** — `SwipeToDelete` + the shipped Undo toast. No trash icon on a line. Nothing is written until Save, so Undo puts the line back in the draft.
- **Gift row, new on bundles:** one dropdown — No gift · Setnayan gift · the shop's own packs (`lib/shop-gifts.ts` packs + stock, unchanged). A pack the stock cannot cover is listed with "Not enough in your stock · buy first"; the server re-checks stock when the gift changes and refuses on an unreadable stock.
- **Notes show after the first Save, as the prototype draws it.** Save stays pressable; pressing it with something to fix shows each note under its field and sends nothing (the same validator the server runs).
- **Thumb row:** the shipped `SupplierThumbRow` + `ActionButton` — Cancel grey · Preview (phone) · Publish/Unlist · Save bundle terracotta (main).
- **What the couple gets** sits beside the form from 768 px, drawn by the shipped `PackageCard`; on a phone it opens as a sheet.
- **The couple sees the gift** on `/v/[slug]` the way a card shows it: the card's own `SetnayanGiftLine`, or the quote's "Gift from … 🎁" headline for a shop pack.

Migration `20271320001366_a_bundle_carries_its_cards_and_a_gift.sql` (ships alone): `vendor_packages.includes_setnayan_gift` (same name as the card's), `vendor_packages.gift_pack_code` (CHECK: only giftable codes; one gift per bundle), `vendor_package_items.vendor_service_id` (which line is a card; ON DELETE SET NULL) + a same-owner trigger. RLS unchanged (row-scoped policies inherit). **Stored, not yet delivered:** a bundle lock does not bill or grant either gift — whether the Setnayan gift is once per bundle or once per cascaded row is an owner money ruling.

Guards: `app/vendor-dashboard/packages/the-bundle-maker-keeps-its-gift-and-swipe.test.ts` (swipe per line kind, Undo, no row button, the one Gift dropdown, the gift written on update and insert, budget inside the fold, the thumb row's tones, the couple card's gift line) and `tests/db/a-bundle-carries-its-cards-and-a-gift.db.test.ts` (giftable codes only, one gift, the owner writes it under RLS, another shop's card refused, SET NULL on card delete, the trigger function not callable by app roles). Lab: `/dev/bundle-maker-lab` (dev-only, 404 in production).

SPEC IMPACT: None new — implements the approved 2026-11-07 DECISION_LOG row. Open owner questions are in the PR (bundle gift delivery; card lines outside the package category map lock under misc).
