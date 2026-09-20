## 2026-09-20 · fix(monogram): "follow our mood board" painted the mark BLACK on every chip

Found by driving production as a real couple and sampling the chip's pixels:
`rgb(0,0,0)` where the reception colour was `rgb(79,107,74)`.

**Why.** The first version rewrote every fill to `currentColor` so a mark would
inherit whatever ink its surface was themed with, and no caller would need to
learn about palettes. That is true for an inline `<svg>` and false at the
boundary that matters: `EventMonogram` renders the mark as a **data-URI
`<img>`**, and an `<img>` is an independent document — it inherits nothing, so
`currentColor` fell back to its initial value. The account switcher, album
shelf, photos tab and public `/u/` profile drew a black silhouette.

**The fix is to stop depending on inheritance.** The ink is now SUBSTITUTED — a
concrete hex goes into the bytes, which renders identically inline and inside a
data URI. `markToCurrentColor` is replaced by `repaintMark(svg, ink)`, and
`applyMarkInk(svg, mode, ink)` degrades in the only safe direction:

    palette + a usable ink  -> repainted in that ink
    palette + NO usable ink -> THE FILE'S OWN COLOURS, byte-identical

A surface that cannot supply the couple's colour shows the mark they uploaded,
which is always defensible. Degrading to `currentColor` was invisible when it
worked and wrong when it didn't — which is exactly why it shipped.

`role_palette` joins `HERO_MONOGRAM_COLUMNS`, so all 16 surfaces on the shared
resolver get the right ink from one added column; `get-switcher-data` passes it
too, since that is the chip that was measured black.

Guarded: `applyMarkInk` must return the input unchanged for every unusable ink
(`undefined`, `null`, `''`, `red`, `currentColor`, `rgb()`, `#12`,
`javascript:x`), and no render path may emit `currentColor` at all — if it
reappears the inheritance assumption is back and the chips go black again.

### Also: the price printed twice on a money button

The unlock read **"Animate & apply · ₱500 · ₱500.00"**. `InlineCheckoutDrawer`
appends the formatted price to whatever label it is given, so passing one
duplicated it. The label no longer carries a price.

Invisible to `tsc`, ESLint, 56 tests and two source guards — the appending
happens inside the drawer, and nothing compares a button's rendered text against
the catalogue.

SPEC IMPACT: None.
