## 2026-07-21 · revert(live-studio): restore the full-screen SETNAYAN overlay

Reverts #3439 (geometric shrink). **Owner picked the full-screen wordmark treatment** when shown
both side by side — and it is the more faithful reading of the original instruction:
*"SETNAYAN logo overlapping the whole screen."* The geometric version moved the mark **off** the
video and onto a letterbox bar, which quietly stopped being what was asked for.

Restored: the mark covers the whole picture, the video is **not** scaled, no corner marks, no
transform in the tree.

### One fix kept — legibility on bright frames

The council's 1.59:1 measurement was right about the symptom even though its proposed cure was
rejected. The restored mark used a **12px blurred drop-shadow**, which does nothing over a
blown-out white frame: it spreads across an already-white background and vanishes. That is the
worst case for a wedding — white dress under a window, outdoor noon ceremony — so on exactly the
shots that matter most, the paywall visually disappeared.

`markOutline()` replaces the blur with **four offset zero-blur shadows**, a genuine 1px keyline
(2px at `full` size) drawn *against* the glyph edge rather than behind it, so it survives any
background. The soft halo is kept as a final layer so the mark still sits into a dark church
scene instead of glaring. Mark opacity raised `cream/85 → cream`.

This changes **legibility only** — size, placement and full-screen coverage are exactly as
picked. Deleting the one style object returns it to the plain glow.

104 unit tests pass; typecheck + production build clean. Inert in production — streaming is
flag-gated off and both SKUs are still "In build".

SPEC IMPACT: Supersedes the overlay treatment in `Live_Studio_Trial_Council_Verdict_2026-07-21.md`
§2.2 for a second time. The council's geometric ruling AND its scrim+mark ruling are both now
retired in favour of the owner's pick; only the legibility finding survives.
