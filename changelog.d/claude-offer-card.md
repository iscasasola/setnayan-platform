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

### 2026-11-13 · owner rulings on the offer card (better only · active only · the supplier's picker)
- **Better only** ("We only show offer cards that are better than the current offer"): offers still never stack. An
  offer that saves the couple no more pesos on THIS quote (centavos, never percent) than the offer already on it is
  refused (`NOT_BETTER`, replacing `ANOTHER_OFFER`) and is not shown to the couple; a better one REPLACES the current
  offer line in the next version. `offerVersion` (lib/offer-drop.ts) and `apply_dropped_offer` (migration
  20271339379038, unmerged, edited in place) enforce it.
- **Active only** ("These offer cards must be active"): `coupleSeesDrop` shows the couple only an open drop of a
  running offer (or an applied one, as history); paused, ended, expired and removed drops are not shown. Apply still
  refuses them on the server (`applyRefusal` + the SQL `OFFER_ENDED` / `OFFER_DROP_EXPIRED`).
- **Supplier's picker** ("Grey out the offers that are worse instead"): `dropPicks` lists every running offer; one
  that does not lower the live quote's total cannot be picked. A better pick reads "<couple> will save ₱X more than the
  current quotation" and "New total is ₱Y" (`dropSavesWords`).
SPEC IMPACT: owner rulings 2026-11-13 on the offer card, relayed by the controller session for CHANGE_TRACKER.md.
