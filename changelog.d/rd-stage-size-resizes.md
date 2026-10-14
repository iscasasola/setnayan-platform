## 2026-10-15 · fix(maker): Stages › a part › Style › Size moves a scene's words, not the heading alone

Owner, live (2026-10-14): *"on the stages. Style Size is inconsistent"* → *"when we where changing size, the text did
not shrink, the highlight just moved"*.

- **Root cause** — `stage-panel/part-look.ts` `partLookTarget` gives every scene part the element `heading`, and
  `partLookNext` wrote `elements.heading.size` only. The Countdown, the Message, What to bring and the Love Story draw
  **no heading**, so the slider moved, the size saved, and not one word changed; on Schedule, Venue and Dress code only
  the heading moved. Every cover part (Title · Logo · Names · Date · Place) was already fine.
- **Fix** — `partLookSizeEls`: a scene's Size is written on its label, heading and words (`HUB_SCENE_ELEMENT_KEYS`,
  the three the page stamps and styles) in the same one write; each keeps the theme's proportions and is pulled to its
  own bounds by the shipped sanitizer. The row reads the part's own size first. Colour is unchanged (heading only).
- **Measured on the Maker lab** (glyph heights from a Range over each word, Chromium and WebKit, 100 % → 120 %):
  Countdown 0 % → 100 % of its words moved (digits 37 → 44 px); Message, What to bring, Love Story 0 % → 100 %;
  Schedule heading-only → every word; a fresh server render of the canvas (the guest page's path) draws 37 → 44 px.
- **Guard** — `lib/a-scene-size-reaches-every-word.test.ts` renders every scene the Maker offers a Size on through the
  real dispatcher and fails on any word no size rule reaches (red on the old heading-only rule). Named exceptions:
  the venue map's furniture, and Dress code's colour-chip names and do/don't rows (`li` — outside the shipped
  `p`-only body selector; open follow-up).

SPEC IMPACT: None
