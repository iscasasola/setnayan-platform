## 2026-11-21 · feat(cake-maker): the Cake Maker — Your cake options · Design your cake · A design arrives

Built from the owner-approved drawing `prototypes/cake_maker_2026-11-21/cake_maker_fable.html` (specs `0acc074a`) and
the DECISION_LOG row "CAKE MAKER — APPROVED TO BUILD" (10 calls). Cakes only (`wedding_cake`, `cake`).

- **Supplier · Your cake options** (Card Maker, after "How clients book"): tiers with a Standard size and extras ≥ ₱0,
  flavours written once and asked per tier (an extra charged per tier), finish, colours "Choose 1–N" (max 3), design
  options with one photo each from the shop's own portfolio, topper, and the message's letter cap. Stored as the
  card's own ★ Customization package lines (`vendor_package_items.cake_part`) — no new money path; the message is a
  Form Maker short-answer question linked to the card (`vendor_questions.max_letters`). Editable on a saved card.
- **Couple · Design your cake**: for a cake card's package the shop page's Book sheet becomes the designer — a live
  picture assembled from the picks, 3 tiers to start, the couple's Mood Board colours first (a 4th is refused with
  "Pick up to 3 — untick one to send your design."), the total from the shipped `choiceTotals` with the same flag and
  selection `lockPackage` commits. "Send to [shop]" posts the design through `startServiceInquiry` (re-read and
  re-priced on the server; a design that cannot be built is refused before anything is created); the not-delivered
  state says so. "or Book at this total" books through the shipped `lockPackage`.
- **Supplier · A design arrives**: a "Cake design" card in the chat (lazy, `thread-parts`) and on the order's Details
  ("Their design from the chat" + Making time). "Make a quote" opens the shipped Make a quote card prefilled with the
  card, the estimate and the picks. A failed read says "Couldn't load this cake design" with Try again.
- Migration `20271356877338_cake_maker_parts_photos_and_letters.sql`: three nullable columns with CHECKs.

SPEC IMPACT: None — builds an approved drawing and its logged rulings; no ruling changed.
