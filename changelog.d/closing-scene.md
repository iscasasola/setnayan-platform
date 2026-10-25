## 2026-10-17 · feat(maker): the Closing ("See you soon") is its own scene, with Style › Accent ◆ ▾ (None · Oval frame)

Owner, 2026-10-17 (DECISION_LOG "THE CLOSING ('SEE YOU SOON') IS ITS OWN SCENE IN THE MAKER, WITH STYLE › ACCENT ◆ ▾
(NONE · OVAL FRAME)"), verbatim: *"Make the closing (See you soon) its own scene in the Maker, with Style › Accent ◆ ▾:
None · Oval frame. Black and white photo is fine."*

- **A part of the Maker** — `closing` (`lib/maker-parts.ts`, canvas `f:closing`), the last part of every page of the
  four stages the shell draws (`MAKER_STAGE_PAGES`; the RSVP stage's reply routes have no closing), and a fixed row the
  selection knows (`lib/maker-scene-list.ts` `MakerFixedKey`, label "Closing", its source line said, never a tile).
- **Tap to select** — `site-body.tsx` hands the shell `makerMark('f:closing')`; `invitation-shell.tsx` sets it right
  before the footer, so #6582's canvas binder listens to the footer as the Closing. Guests get no marker.
- **Style › Accent ◆ ▾** — the work area answers the Closing's Style with the scenes' one Accent row
  (`accentRowFor('sign-off')`, `accent-row.tsx`): None · Oval frame, written to `style_preferences.scene_accents` like
  the cover's, the countdown's, E-Gifts' and the reply card's. Pro (◆, priced at Apply; None is free), Vintage starts on.
- **None keeps the band** — on a kit look the page now mounts the kit's closing at None too (`artKit.look ||` the
  oval's pick): "See you soon." and the Narra Brown band, no oval. The photo in the oval stays black and white.
- **Maker lab** — draws the closing under its pages with its marker, from the drafted `lab_accents` (the lab draft's
  stand-in for `scene_accents`); `lab_kit=vintage` (a cookie) puts the Vintage look on so the Closing starts at Oval.
- **Guard** `lib/the-closing-is-its-own-scene.test.ts` — selectable (every page, the fixed row, the marker, the binder
  driven), Accent offers only None · Oval frame, None draws no oval but keeps the band, Pro both ways.

SPEC IMPACT: None — the ruling is already recorded in the corpus DECISION_LOG row "THE CLOSING ('SEE YOU SOON') IS ITS
OWN SCENE IN THE MAKER, WITH STYLE › ACCENT ◆ ▾ (NONE · OVAL FRAME)" (corpus commit cf1f8009).
