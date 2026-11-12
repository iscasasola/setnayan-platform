## 2026-11-12 · feat(chat, quote): the offer card the couple applies + "See every version · side by side" (Piece 1 · PR-4)

Quote + negotiation plan, PR-4 (owner 2026-11-12, approved design `quote-maker-polish.html`). Merges LAST, after
PR-1 → PR-3; the (+) registration of its two rows is left to the controller (see the PR body).

- **Migration `20271339379038_a_dropped_offer_is_a_card_the_couple_applies`** — `chat_messages.vendor_offer_id`
  (BIGINT → `vendor_offers.id`, ON DELETE SET NULL; the table keys on BIGSERIAL, so not UUID) + `offer_good_until`
  DATE, the `offered_service_id` precedent (partial index, per-column INSERT grant, RLS unchanged). Trigger
  `chat_messages_offer_is_this_suppliers` refuses a rival's offer, a drop by anyone off the shop's team, a drop with no
  (or a past) Good-until day, and an offer in a private line. `apply_dropped_offer()` (service role only) writes the
  quote's next version = the live quote + ONE offer line, with the PREDECESSOR'S STATUS, supersedes it directly, copies
  its shop-gift lines, re-prices an accepted quote's bench row, posts the new version's card — and refuses an expired
  drop, an ended offer, a non-couple, a reshaped version, a second / stacked offer and a moved paid row.
- **`lib/offer-drop.ts`** — the card's pure rules: open / applied / expired / ended / gone, refusal words, the
  offer's own card(s) only, priced ONLY by `offersForQuote` (9 Nov rule), paid plan rows frozen. "Applied" is derived
  from a later version's `line_items[].offer_id`.
- **`app/_actions/offer-card-actions.ts` · `applyDroppedOffer`** — the one new server action (+1 to the route budget):
  proves the couple in their own session, prices on the server, calls the writer.
- **`app/_components/chat/cards/offer-card.tsx` + `offer-calls.ts`** — the supplier's drop card (Which offer? · Good
  until → Drop into the chat) and the dropped card for both sides. Lazy (thread-parts) once registered.
- **See every version · side by side** — `versionsSideBySide` + `versionsOldestFirst` in `lib/quote-versions.ts`, on
  ONE line pairing shared with `quoteChanges`; `quote-versions-compare.tsx` (two pickers, changed rows marked) with a
  "Side by side" door on `quote-version-line.tsx`.
- Ugat: joint J70 (Thread → Proposal). Lab: `/dev/offer-card-lab`.

SPEC IMPACT: None
