## 2026-09-07 · fix(moodboard): a stage drawing stops painting its own room over the couple's

`20271211370331` put the `stage` decor zone live. Every stage drawing is a picture of a draped
table **standing in its own cream room** — and `renderVenueSvg` already draws a room.
Composited opaque, each one lays a rectangle of foreign cream across the floor and the wall
behind the stage. On `modern minimalist`, whose background is 48% of its frame, the result
reads as a broken image rather than as decor.

Found by rendering a room and looking at it. Nothing in the suite was failing.

### The distinction the fix turns on

`backdrop` and `ceiling` drawings **fill** their zone — the panel behind the couple, the band
overhead. Every pixel of those files is meant to be drawn, background included, and clearing
their background would punch a hole in the backdrop. A `stage` drawing is an **object standing
in a room**. New `SCENE_DECOR_ZONES` names that second kind, and `renderDecorLayerDataUrl`
clears the background for those zones only — **after** the retint, never before, so the
existing "the background never wears the palette" measurements still run against the opaque
file rather than against pixels this step has already removed.

⚠ **Every remaining reception zone is a scene zone.** `tables`, `feast`, `program`, `booths`,
`photo_wall`, `tunnel` and `welcome_signage` are all objects standing in a room, exactly like
`stage`. Fixing this before the next zone ships is the difference between one correction and
eight repeats of the same rectangle.

### Two ways this could have failed silently, both closed

- **The background colour is sampled from the drawing's own corners**, not passed in or
  hardcoded, so a re-cut or a newly generated file needs no constant updated anywhere. If the
  corners **disagree**, the image is not the full-bleed shape the function assumes and it
  returns the source untouched — compositing a background that should have gone is cosmetic;
  erasing a table because the function guessed a "background" out of the middle of it is not.
- **It samples the opaque CONTENT box, not the frame corners.** A 16:9 drawing rasterised into
  a square with `fit: 'contain'` is letterboxed with transparent bands, so the frame's corners
  carry no colour at all — sampling those would make the function a silent no-op with no error
  and no log. The server renderer uses `fit: 'inside'` and has no bands, but a caller that
  letterboxes would have hit exactly that.

### Verification

Five guard cases in `reception-decor-layers.test.ts`, beside the function they cover: the zone
list is pinned (adding `backdrop` is the mirror-image mistake), the knockout clears each of the
five served stage drawings' own background while keeping its furniture, it refuses when the
corners disagree, a letterboxed raster is still cleared, and — asserting **bytes**, not a null —
the served layer really does come back transparent through `renderDecorLayerDataUrl`.

**Five sabotages, all red:** the server stops calling it; the tolerance widened until it eats
the drawing; sampling the frame corners instead of the content box; `backdrop` added to the
scene list; the corner-disagreement refusal removed.

SPEC IMPACT: None. Rendering fix on a shipped zone; no locked decision changes.
