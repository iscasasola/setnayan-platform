## 2026-09-18 · fix(service-cards): a couple meets the Setnayan gift while choosing, not only in chat (SUP-4, first half)

"Includes a Setnayan gift — free Papic photos for your celebration, sized to the booking" rendered only in `ServiceCardFace`. A couple meets that component only when a supplier has already offered them the card in chat. The card they browse (`ServiceCardView`, on `/explore` and on the shop page) never said it.
- The line is now one component, `app/_components/setnayan-gift-line.tsx` (`SetnayanGiftLine` + `SETNAYAN_GIFT_CARD_COPY`). Both cards mount it, so the wording cannot drift between the card a couple browses and the card they are offered. Each surface keeps its own palette.
- `ServiceCard.givesSetnayanGift` comes from `vendor_services.includes_setnayan_gift`. The marketplace query (`lib/marketplace-service-cards.ts`) now selects that column. Without it every marketplace card would read `undefined` and show no gift, silently.
- The line still carries no number. The photo count belongs to the quote, and "starts at" is only the floor for earning the gift (BENCH-C5, ruled; the quote side shipped in #5522).
- New guard `lib/the-gift-reaches-couples-while-choosing.test.ts` pins the whole chain: the column read, the builder (executed), both mounts, and the sentence existing exactly once in `app/` + `lib/`. `lib/the-gift-is-a-yes-or-no.test.ts` now follows the words into the shared component, so its no-number check covers the copy wherever it lives. It went red when a number was typed into the shared copy.

SPEC IMPACT: None. (Closes register row SUP-4, first half. The second half shipped in #5522.)
