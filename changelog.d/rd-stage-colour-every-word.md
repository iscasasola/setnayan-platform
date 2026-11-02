## 2026-10-15 · fix(maker): Stages › Style › Colour colours every word of a scene; Dress code's chip names and do/don't lines follow Size and Colour

Owner, 2026-10-15, on the two follow-ups of #6539 — Colour on a scene part: *"All the words"*; Dress code's colour-chip
names and do/don't lines: *"Yes, include them"* (venue map buttons, pins and credit stay fixed).

- `stage-panel/part-look.ts` — `partLookSizeEls` becomes `partLookEls`, used by BOTH fields: a scene's Colour is one
  colour on its label, heading and words, in the same one write (same queue key, same ↺, same put-back on a refused
  save). The row shows the part's own colour first, else the first of its words that has one. Stages that coloured the
  heading only now colour every word (accepted by the owner).
- `lib/scene-words-class.ts` — `HUB_SCENE_WORDS_CLASS` (`hub-el-words`), reached by `HUB_SCENE_ELEMENT_SELECTOR.body`,
  worn by Dress code's chip names (every palette look) and do/don't lines (every do/don't look). Never inside a `p`.
- Measured on the Maker lab (Invitation, computed colour + glyph height per word): Countdown colour 0/9 → 8/9 (the
  ninth is the ticking seconds digit); Message 0/2 → 2/2; What to bring and Love Story 0/3 → 3/3; Schedule 1/16 → 16/16;
  Dress code colour 1/24 → 24/24 and size 11/24 → 24/24; Venue 2/15 → 9/15 (the six left are the map-app buttons).
- Guard renamed and widened: `lib/a-scene-look-reaches-every-word.test.ts` — Size AND Colour, Dress code in all
  5 palette × 3 do/don't looks; the only named exceptions left are the venue map's furniture. Sabotage: Colour back to
  heading-only → red; the Dress code mark off the selector → red.

SPEC IMPACT: None — the owner's rulings are the 2026-10-15 answers relayed by the controller; recorded here.
