## 2026-11-12 · feat(service-card): one service card everywhere — the Find card is the template

Owner, 12 Nov: *"service cards needs to stay and look consistent all throughout the app"*; the shop page's cards were
*"Something else"*; on the Now-beside-Proposed prototype: *"Yes, build it"*.

- New `app/_components/service-face.tsx` (`ServiceFace`) is the ONE face: cover 80 × 112 on the left; name (+ offer),
  path line, shop line (away from the shop only), city / rating, price in the app font, one "Includes:" line (words
  only), one "Not included:" line (crew meal said once), the gift line. The caller owns only the door and the footer.
- `ServiceCardView` (shop page, Explore, suppliers landing, the supplier's Shop list) and `ServiceCardFace` (Card Maker,
  chat, bundles, Find's sheet, offers, packages) are now adapters that map their data into the face. Find's "to compare"
  card (`InlineMoreCard`) renders the face inside its own frame and verbs.
- Retired from the small card (they live in the Service card grown, which the face opens): the photo strip, the clip,
  looks, couples' photos, reviews, "crew meal required", Serves, the card record, the mono "VIEW DETAILS".
- Shop page: all services in ONE grid (1 / 2 / 3 columns) with the group said on each card's path line, so a one-card
  group no longer leaves half a row empty. The viewer's extra couple photos now travel into the grown card.
- Marketplace query carries `verified` for the shop line's Verified pill; Explore / landing pass the card's own cover.
- Guard: `lib/one-service-card-face.test.ts` fails if any `app/**/*.tsx` reads a card's price and inclusions without
  the face. Old pins on the text-first card retargeted to the face or to the grown card (bench element list 15 → 19:
  four new "through the face" pins for the to-compare card).
- Not moved: Find's bench `VendorCard` (a supplier already on the couple's event, with Payments / Workspace) — it is the
  shape the face copies, and it is not a service advertisement.

SPEC IMPACT: DECISION_LOG row "ONE SERVICE CARD, EVERYWHERE — THE FIND CARD IS THE TEMPLATE" (12 Nov, specs 01d5b0ec),
prototype `prototypes/service_cards_one_template_2026-11-12/`, CLOUD_BOARD shared fact. Amends the 11 Nov service card
row prototype's card face (the row stands).
