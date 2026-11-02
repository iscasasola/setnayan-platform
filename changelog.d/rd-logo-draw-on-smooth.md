## 2026-09-28 · fix(maker-logo): Draw on is smooth, a crossing is not drawing, and layers can be renamed

Owner, after #6083 went live: *"i see unsmooth effects"* · *"on this part of the C i have to pass the big stroke but it cannot build yet. can't you predict the size of the previous stroke and connect them first before we turn and scope that bigger loop?"* · *"we should be able to rename these layers so we can identify them easier"*.

- **Smooth.** The pen's reveal was an animation per cell — ~240 per part, 465 for the owner's I+C — each re-rasterising the mask (a phone dropped frames), and neighbouring cells at different opacities with seams between them drew the letter in stripes. Now each part's reveal is ONE path of the cells the pen has passed (`revealD` / `revealLayersAt`; abutting polygons of one path have no seam), redrawn once a frame from a single clock animation, with a soft two-band tip ahead of the pen. Measured in the browser: 13 animations and 18 mask paths for the whole logo.
- **Crossing is not drawing** (`penAlong`): a pen pass over a part that is `LOGO_CROSSING_RATIO` (3)× shorter than that part's longest pass is the pen crossing it, and is dropped — the big stroke waits for its own pass; the thin stroke carries on across its gap. Same rule for the editor's part numbers.
- **Rename.** Every layer has a Name field; the navigator shows it (an emptied name falls back to Image/Text/Frame).

SPEC IMPACT: `DECISION_LOG.md` 2026-09-28 row "THE LOGO'S DRAW ON IS SMOOTH, A CROSSING IS NOT DRAWING, LAYERS HAVE NAMES".
