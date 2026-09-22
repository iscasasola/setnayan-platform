## 2026-09-22 · feat(chat): a quote replaces the offer, and the offer stays as history

Owner ruling, carried into wave 2: **the quote card REPLACES the offered-service card in the
thread**, with the mitigation that the replaced card stays reachable as history — removing it
destroys a view, and "both stay" was the reversible option the owner declined.

**New:** `apps/web/lib/offered-service-card-state.ts` — a pure decision module
(`offeredServiceCardState`, `latestQuoteAtFrom`), the sibling of the shipped
`lib/quote-card-state.ts` and deliberately in its voice, so two cards that mean the same thing do
not say it two ways. Executed by `apps/web/lib/offered-service-card-state.test.ts` (8 tests).
`chat-message-stream.tsx` decides once and hands the result down;
`chat-offered-service-card.tsx` only draws it — dimmed, labelled *"Replaced by a quote"*, and
carrying nothing to act on.

Two judgement calls, both written into the module rather than left implicit:

- ⚖ **A tie goes to the quote.** Equal timestamps supersede, because the quote is the card that
  carries money and only one of the two possible mistakes — showing a stale offer as live — can
  make someone act on the wrong number.
- ⚖ **Unreadable or missing data leaves the card LIVE.** An absence is not evidence of a quote;
  retiring an offer on a `null` would destroy a view no quote ever replaced, which is exactly what
  the mitigation forbids.

Sabotages watched red: (1) a superseded card stays actionable; (2) drop the tie case (`<` → `<=`);
(3) unreadable data supersedes; (4) drop the history note. The runner was probed with a
deliberately failing assertion first.

🪤 **One sabotage did not break the property and had to be redone** — removing the `null` guard left
the card LIVE anyway, because `null < number` coerces to `0`. A sabotage that does not invert the
rule proves nothing about the guard; it was rewritten to return the superseded state on unreadable
data, which genuinely inverted it and went red on the right two tests.

⛔ **NOT BUILT, BECAUSE IT ALREADY SHIPS — the frame port and the supplier's brief.**

- **The frame is already the approved layout.** "One Chat Box" landed 2026-09-18: `chat-box.tsx`
  with its six slots, `ConversationColumn`, `ThreadToolPanel` (`[&:not([open])]:hidden`), the
  composer affordances, the `All · Decisions · Files` switch, and the quote inside the
  conversation. Re-porting `chat_interface_v2` over it would recreate a working screen, which
  RULE 0 calls a defect rather than a deliverable.
- **The supplier's "their event" brief already renders.** `buildCustomerEventSummary` →
  `railProps.summary` → the customer rail draws `summary.sentence` and `summary.facts`. A second
  copy in the composer would be a second source for one fact.

SPEC IMPACT: None. The ruling this implements is already recorded in `DECISION_LOG.md`
(2026-09-22, the quote-maker row: *"approved. per-quote switch, replace the card, apply the
discount"*). Nothing decided here that is not already written down.
