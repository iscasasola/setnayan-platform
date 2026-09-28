## 2026-09-28 · feat(qr): Shape = Circle is a circular code — the modules fill the disc

Owner, verbatim, on the shipped Circle (a square code inside a round cream
badge): *"the QR should be Circle following the shape and not just the frame"*.
`styledQrSvg` (`apps/web/lib/qr-style-svg.ts`, the one renderer) now draws a
circle as a disc of modules: the real level-H code in the centre, a clean
`CIRCLE_GAP`-module light ring round it, and filler modules in the chosen
pattern (Classic / Rounded / Dots) and ink out to a thin ink ring. Finders stay
solid squares; the centre (Setnayan mark free / couple's logo Pro) is unchanged.
The filler is seeded from the payload (FNV-1a → mulberry32, `circleFillerCells`),
so screen, print and saved file carry the same picture. The canvas stays a
square viewBox at the same width, so no surface's layout moves.

`CIRCLE_GAP = 2` / `CIRCLE_REACH = 1` were MEASURED (80-payload sweep, 3
patterns × 2 centres × 5 raster sizes, repo jsQR): that pair matches the square
code's own score, beats the old badge circle, and Apple's Vision detector read
360/360. `lib/every-qr-look-decodes.test.ts` now also decodes every look at the
900-px print size (+ its forwarded 320-px JPEG), and adds: the disc is inked in
all eight sectors, the light ring carries no ink, finders are clean in BOTH
shapes, and the filler is identical per payload / different across payloads.
Each new assertion was seen to fail under sabotage (filler off · filler into
the ring · filler over the code · seed ignores payload · Math.random filler).

Note: a Pro circle SVG is ~2× a square one (disc area ≈ 2× code area; e.g.
rounded ~87 KB vs ~47 KB) — matters only for the seating print's per-guest
inline SVGs.

SPEC IMPACT: `DECISION_LOG.md` — "as built" note appended under the 2026-09-28
row "SHAPE = CIRCLE MEANS THE CODE FILLS THE CIRCLE". No migration.
