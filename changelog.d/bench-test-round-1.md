## 2026-09-11 · fix(bench): a bench save keeps the card it was made from; the thread and the perk line say what it is

Four findings from the owner's live test round 1 (couple testnayan4, supplier
Saysay — two untitled cards, Live Band with a cover and Host / MC without, no
shop logo).

- **A save from a bench row records the card.** "More in X" and the search
  sheet now post the tile. `saveVendorToPicks` picks the shop's active card in
  that tile (`lib/bench-save-card.ts`: earliest, then by id; it matches the tile
  id as well as the tile's canonicals, because shops store `host_mc`, not
  `host_emcee`). The pick is filed under that card's category and records
  `service_id`, so the saved card keeps that card's cover, price and inclusions.
  A re-save fills a missing `service_id` only when the card agrees with where the
  row already sits, so it never moves a pick. `/explore` sends no tile and is
  unchanged.
- **The inquiry's fallback card is ordered.** `contactShortlistVendor` used to
  pick "the first active service" with no ORDER BY, over two cards sharing a
  timestamp. It now orders by `created_at, vendor_service_id`.
- **The search card shows the card's cover.** The bench search returns
  `primary_photo_url`. Both cards use `lib/bench-card-image.ts`
  (cover → logo → initials), the same ladder the saved card already uses.
- **"Inquiring about" asks the card first.** `interestChipLabel` now tries the
  card's title, then the card's own category, then the interest's coarse key.
  `lib/thread-interest-labels.server.ts` batch-reads the cards for the chips,
  the couple's thread list and the supplier's thread and inbox. Old rows that
  read "Band / DJ" or "Miscellaneous" now show "Live Band", at render time,
  with no data change.
- **The perk line.** `lib/perk-unlock-message.ts` owns the system message for
  a card's perk. New lines read "🎁 A perk for Setnayan couples · Live Band —
  …", and previews read "🎁 Perk: Live Band". Older lines stored as
  `**Setnayan Exclusive unlocked 🎁** live_band: …` are **parsed and shown in
  the new words by the chat stream and the preview; the stored text is not
  rewritten.** The line is not called "the Setnayan gift": it carries the
  supplier's own `exclusive_perk_text`, while the gift is Papic credits on the
  quote.

Guarded by `apps/web/lib/a-bench-save-is-for-the-card.test.ts`. The two tests
that pinned the old wording now test the single owner.

SPEC IMPACT: None. This is copy and wiring, and no decision changes. The perk
line's wording ("A perk for Setnayan couples" rather than "the Setnayan gift")
is flagged for owner override.
