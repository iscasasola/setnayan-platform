## 2026-11-10 · fix(shop): tapping a card's switch without a cover no longer crushes the card

Owner screenshot ("Toggle issue"): on Shop › Your services, tapping the switch on a card with no cover printed "Add a cover photo before you publish this card…" INSIDE the card row — `StayForm` renders its refusal as a sibling of the form, i.e. a flex child of the row — so it took half the width, the card face collapsed into a one-word column and the switch was drawn over the chips. The row now wraps and gives `[data-stay-error]` its own full-width line under the card. Guard `card-row-refusal-own-line.test.ts`.

SPEC IMPACT: None.
