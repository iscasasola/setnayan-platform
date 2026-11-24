## 2026-11-24 · fix(cards): the unread count on a Find supplier card is a small round dot beside the name again

On the couple's Find suppliers page the supplier card (Card 14, the mall face) drew its unread-replies count as a
full-width orange bar under the name. The count sat in the card's stacked column, which stretched the round pill
across the card. `MallFaceBody` now takes a `shopMark` that it keeps in the shop row, right after the shop name, and
the card hands the count there, so it reads as a small round number beside the name, as on the older card. Other
cards drawn with the mall face are unchanged. Guarded in `the-unread-badge-reaches-the-cards.test.ts`.

SPEC IMPACT: None
