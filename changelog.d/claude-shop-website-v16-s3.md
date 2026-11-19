## 2026-11-16 · feat(shop): v16 S3 — Add to quote and Inquire on each service card, and the quote tray

- **Each service card** now has "Add to quote", which becomes "In your quote" once added, and "Choose this service". Choose this service opens the shop's one Inquire pop-up with that card already picked. A card in the quote is outlined.
- **The quote tray** is v16's dock line. It appears at the foot of the screen while the quote has anything in it and reads "2 services · from ₱45,000", the names, and Clear.
  - The page's ONE Inquire, the same button that floats on a phone, now opens with every service in the quote picked, in the order they were added. It reads the quote through `shop-quote-store.ts`.
  - On a phone the tray leaves the floating Inquire's corner clear.
- **Kept: one Inquire per page.** v16 draws "Inquire" on each card and in the dock, but the owner's 13 Nov ruling ("Yes, only one", held by `one-inquire-button.test.ts`) stands. So the card's door uses the shipped words "Choose this service", and the dock's Inquire is the page's own.
- **The sum adds only prices the shop shows** (the same `starting_price_php` behind the card's "from ₱X"). A service with no shown price is said as "price on request", never counted as ₱0.
- The quote stays on the device until the Inquire is sent. There is no new server action: the pop-up's shipped `startServiceInquiry` sends it.
- The Services heading reads "Add the ones you want to one quote — final quotes happen in chat." wherever the quote is offered, which is only where the Inquire pop-up is.
- The drawing's "First booking · ₱5,000 off" ribbon is the shop's own best offer, already drawn by the card face (`discountLabel`). Nothing is typed.

SPEC IMPACT: None. This builds the 15 Nov v16 drawing (`prototypes/shop_website_two_looks_2026-11-15`), owner-approved for S3 on 16 Nov.
