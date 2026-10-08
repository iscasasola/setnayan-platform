## 2026-10-08 · feat(studio): the style card is ONE size with a terracotta ring and no frame

Owner, verbatim (2026-10-08, the template gallery; `INTERACTION_RULES.md` § 9):
*"Style Card should be limited to that height and width. Adjust it always to
that. no framing"* · *"Selected Card needs to be highlighted with same
terracota"*. Stacked on `rd/background-fade-bar`.

- `.sn-phone-card` is 112 × 149 everywhere (it was 136 by default); the picture
  fills it edge to edge — a card that is not picked has no ring and no border.
- The picked card wears a 3-px ring in the selector's terracotta (`mulberry`,
  #C24E25 — it was the gold `terracotta-700` token), hugging the picture, and
  its name turns terracotta.
- ⚠ At 375 px exactly three 112-px cards fit (16 + 3 × 112 + 3 × 8 = 376): no
  fourth card peeks, so the strip no longer shows that it scrolls. Said to the
  controller; not changed (the size is the owner's).
- NOT in this commit (next): the 0–100 pie for a pick whose file must load, the
  strip lock while a card loads, cancel by tapping the loading card.

Guards re-aimed with the reason: `picture-cards-are-phone-shaped` (the size),
`the-background-has-one-source` (9), `a-background-pick-shows-at-once` (2).
4 sabotages seen red.

SPEC IMPACT: None.
