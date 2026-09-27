## 2026-09-27 · fix(event-hub): glass reads as glass, and every scene word stays readable on any background

Owner, editing his own Event Hub: "opaque glass, frosted glass does not work." On prod, Opaque glass
painted the same solid colour as Full colour, both glasses started from the couple's darkest swatch,
and on that dark ground the Countdown's numerals kept the page's dark ink.

- **Glass looks like glass.** Opaque glass is a milky pane (at least 86% solid, with a sheen, a bright
  edge and a shadow). Frosted glass is a see-through pane (from 50%) over a real 22px blur. Each pane is
  only as solid as its words need: `lib/scene-legibility.ts` `sceneTintGround` measures it over black
  and white behind the pane and passes the result as `--hub-glass-fill` / `--hub-glass-sheen`.
- **A glass starts light.** Opaque glass and Frosted glass now start at `#ffffff`, and switching
  between the two glasses keeps the tint. A light swatch comes first in the colour row. A Pro couple
  with no photos now gets the swatches too.
- **Words follow the ground.** The scene frame now sets `color` to the scene's ink, so words with no
  colour of their own follow it (this fixes the Countdown numerals). The scene's surfaces
  (cream/paper/veil/paper-deep) become shades of its ground. Muted words (`text-ink/40…80`, template
  body text, eyebrows) are held to a per-scene AA floor (`--hub-mute-floor`). A photo or snippet scene
  uses the ink measured for its light scrim. The dark-mode photo scrim is gone. The Countdown units
  went from `/50` to `/70` (they measured 3.2:1 on the page).
- **Guard:** `apps/web/lib/scene-words-follow-the-ground.test.ts` checks the contrast math over every
  theme, every ground kind and dark, light and mid tints. It also renders every scene widget (and all
  25 templates) through the real dispatcher on 8 grounds and fails any word painted with a fixed
  colour class, stylesheet rule or surface. Each part was seen to fail by sabotage.

SPEC IMPACT: `DECISION_LOG.md` gets a 2026-09-27 row "GLASS READS AS GLASS; EVERY SCENE WORD FOLLOWS
ITS GROUND". The glass-starts-light default is flagged for owner sign-off because it narrows the
"same background color with or without effects" row.
