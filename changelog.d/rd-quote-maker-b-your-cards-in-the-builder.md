## 2026-09-22 · feat(quote): "Your cards" — the builder loads one or several service cards

Owner, 2026-09-22 (prototype approved): the quote maker loads 1+ service cards combined, and
the card's discount is APPLIED with its reason.

- `ProposalMaker` gains `cards` (the shop's ACTIVE cards, with add-ons and "comes with") and a
  "Your cards" picker mounted once above the package picker (which stays). Picking one or
  several re-seeds through `loadServiceCardLinesForQuote` on the server; add-ons are ticked under
  the picked card; "comes with X · add" offers the shop's card of that kind; lead-time and
  last-minute warnings print under the picker.
- NEW pure `applyCardSeedToDraft` (`lib/quote-from-service-card.ts`) decides what a card
  overrides and what the supplier keeps: lines replaced; crew MODE from the card, size only when
  stated, per-head price never; a couple's own crew-meal booking keeps `offset`; the discount
  applied WITH its reason (the reason reaches the couple as the Discount line's detail, and is
  cleared the moment the supplier types over the figure); schedule + reservation terms from a
  card that has them. 5 more subtests, four sabotages watched red.
- The thread page feeds the cards (`fetchAddonsByService`, `vendor_service_links`), labelled by
  the kind — never the raw key, never "Untitled".
- Guard `app/_components/the-quote-loads-the-card.test.ts` pins the mounts (count 1) and that the
  seed path reads the event date on the server; two sabotages watched red.
- Per the controller's note: NO per-quote gift switch is drawn yet — the card's switch state is
  carried on the option only (`giftOn`), and the Papic row keeps the shipped copy. Slice G flips
  the source of truth in one commit.

SPEC IMPACT: None beyond the 2026-09-22 DECISION_LOG row.
