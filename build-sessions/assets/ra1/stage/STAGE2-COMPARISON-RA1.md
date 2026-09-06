# RA1's measurement of the STAGE2 bridgerton — and why RA1 shipped its own

Written by RA1, 2026-09-06, after MB Oversight pointed at the duplicate session's
`claude/stage-decor-artwork` work in `/private/tmp/wt-stage2`. The STAGE2 session had not yet
handed its file into this directory, so RA1 read it directly from that worktree (read-only,
sha256 `e1caa25f209fc89a2641f20202434dfcbb71396cf39384ca6ca4c103d468014e`) and measured it on
the same instrument as its own candidates.

## The verdict: STAGE2's drawing is better art and is NOT seedable

**It is the nicer picture.** 286 paths against RA1's 43: a candelabra, panelled Regency walls,
Louis chairs, laid place settings. If artwork alone decided this, STAGE2 wins.

**Its seeded tolerance of 12 bleeds.** Measured through the real `recolorRGBA` on a 520px
raster (`fit: 'contain'`, the component's own `MAX_PREVIEW_PX`), against four unrelated
targets, counting opaque pixels OUTSIDE a 2px dilation of the tagged cloth:

| tolerance | px outside the cloth that recolour |
|---|---|
| 8 | **0** |
| 9 | 806 |
| 12 (STAGE2's seeded value) | **2572** |

At 12 the wall panelling's mouldings turn the couple's colour — plainly visible in a rendered
card, not a subtle fringe. The largest clean tolerance for STAGE2's file is **8**, the same
value RA1 measured for its own.

**And at 8 the drawing fails the `farthestTone` check.** STAGE2's cloth is drawn in TWO
purples: `#8C6BA6` (27.2% of the frame, the body) and `#69507C` (0.209%, 323 px). The second
is 12.35 from the first in the engine metric, and it traces the cloth's own outline — the
table edge, the front lip, and every vertical fold stroke. At tolerance 8 it does not move, so
a gold recolour renders a gold tablecloth with **purple piping along every fold and edge**.
Zoomed and confirmed by eye, not inferred.

🔑 **So the two constraints cross, and nothing sits between them.** The cloth outline needs
≥13 to move; the wall moulding's antialiased blends start bleeding at 9. There is no legal
tolerance that recolours the whole cloth without repainting the room — the same structural
defect that kept `tropical heritage` out of RA1's migration (skirt at 15.6% and tabletop at
2.95%, 24.65 apart, background at 20.48 between them).

## What RA1 shipped instead

`bridgerton-regal.svg`, sha256 `2086af45f281c355496205845477c7b537e804f854415091dbf4da70bfc34e36`,
job `755b04e0-e19c-439d-bad1-b51e8447acee`, seeded `#8C6BA6` ± **8**.

Plainer artwork — a draped sweetheart table in a panelled room, no candelabra. But its second
purple (`#5A4D78`, 15.26 away) has **zero exact pixels at 520px**: it is a hairline that the
rasteriser never resolves at the size the engine actually runs. So there is no second tone to
strand, the whole cloth moves at 8, and nothing outside it does.

**If someone wants STAGE2's richer frame, the fix is a re-cut, not a tolerance.** Collapse
`#69507C` into `#8C6BA6` (or move it inside 8 of it) in the SVG and the file becomes seedable
at 8 with all its detail intact — the MB28b move, applied to a drape instead of a driftwood
arch. RA1 did not do this because it would break the byte-for-byte provenance the RA1 brief
required of its keepers, and because 4 of 5 families were already shipping.

## Two corrections to the message that prompted this

1. **"editorial cream's nearest neutral is 14.0 in the engine metric."** 14.0 is `#B76C6D`,
   which is a fold-shadow tone of the CLOTH ITSELF and has zero exact pixels at 520px — it is
   part of the tagged region, not a neutral. The nearest actual neutral is `#A9A49F` at
   **12.80**, the chairs' and plates' line-art grey. The conclusion still holds (15 cannot be
   seeded), but the reason on record was wrong, and RA1 seeded **12**.
2. **"your worktree has no tropical-heritage file yet."** Correct, and deliberate — it was
   copied in, measured, rendered, and REMOVED. The staged keeper (`6d412755…`) is a defect:
   its tablecloth skirt `#9CB29A` and its tabletop plane `#B0FED8` are 24.65 apart with the
   cream background at 20.48 between them, so the skirt recolours and the tabletop stays mint
   green. Three regenerations on the finding-3 recipe all painted the wall, floor or riser
   sage and left the cloth cream or mint. Four generations, zero keepers — past the plan's
   stop rule. That cell ships uncovered and renders flat SVG.
