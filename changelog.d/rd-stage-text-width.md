## 2026-10-14 · feat(maker): Width on Style's last row — Colour · Size · Width ▾ per part (Narrow · Normal · Wide · Full)

Owner, 2026-10-14: *"what if there is a part where we want to have the text take up more width?"* → approved on
`prototypes/maker_text_width_2026-10-14_fable.html` with his answers (the word "Colour" leaves the row at phone width ·
the parts as drawn · the numbers as drawn). Width is free (no ◆).

- `lib/element-style.ts`: a `width` field (`narrow` · `wide` · `full`; Normal is an absence, like Size 100) on
  Names · Small line on top · Invitation line · Venue · Photo caption · Heading · Words (`HUB_ELEMENT_WIDTH_PARTS`,
  read off `HUB_ELEMENT_FIELDS`). ONE table, `HUB_ELEMENT_WIDTH_BOX`: 60 %/32ch · 90 %/60ch · 100 %/76ch.
  `hubElementDeclarations` draws `max-width: min(<share>%, <cap>ch)` and a `margin-inline` that follows the part's
  alignment — or, with none, the theme's (`--hub-el-mi`, set by the nearest `text-left/center/right`, globals.css).
  The sanitiser keeps the key only on those parts; the text reset (↺ Use the Event Hub style) takes it off;
  `HUB_ELEMENT_LOOK_PROPS` lists `max-width` + `margin-inline`, so the Maker's instant preview clears them on ↺.
- `lib/hub-look-pro.ts`: `width` is a FREE field.
- `stage-panel/part-look.ts`: `partLookFields` / `partLookNow` / `partLookNext` / `keepPartLook` carry `width` — the
  same one write, the same queue key, the same ↺ and put-back.
- `stage-panel/stage-look-row.tsx`: after Size, Width ▾ — the house two-line dropdown (`Dd stacked`, short:
  `SP_LOOK_ROW_DD` in `lib/maker-stage-room.ts`) with each width's hint and a small bar; the written "Colour" is
  drawn from `sm` only (the circle keeps "Colour" as its name). `Dd` saves nothing for the width already worn.
- No migration: `elements[el].width` is canvas JSON. The guest page already draws whatever the declarations emit
  (inline on a cover part, scoped `!important` on a scene).
- Guards: `lib/element-width.test.ts` (the approved parts and only those; the one table; Normal is an absence;
  nothing typed reaches CSS; inline + scene CSS for the guest; the preview clears it) · the worn-choice test
  extended to Width · `style-is-cards-colour-and-size.test.ts` and `free-vs-pro-redrawn.test.ts` updated.

SPEC IMPACT: DECISION_LOG.md — new 2026-10-14 row "WIDTH ON STYLE'S LAST ROW" (the owner's approval and his three
answers), appended to the corpus working copy.
