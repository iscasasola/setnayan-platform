## 2026-07-03 · feat(marketing): Suri comparator — fixed maxima, both bars rise with the slider

- Each compare mode in the Setnayan AI pop-up is now anchored to an owner-set
  ceiling reached at the slider's 26-month end: **vs hiring ₱1,213,333 · vs
  other AI apps ₱100,000 · vs DIY 1,213 hours** — every slider position is
  ceiling × months/26.
- The alternative's bar previously sat at a static full width; both bars now
  draw against the mode's fixed scale, so dragging the months slider makes
  BOTH values and BOTH bars visibly rise (them bar gains the same .35s width
  transition the Setnayan bar had).
- "vs other AI apps" implied monthly rises to ₱3,846/28d (₱100,000 ÷ 26) —
  printed in the sub copy, still labeled top-of-range illustrative.

SPEC IMPACT: DECISION_LOG row (comparator maxima owner-locked 2026-07-03).
