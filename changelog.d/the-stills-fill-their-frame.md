## 2026-09-08 · fix(demo): the Setnayan AI stills stop shipping two-thirds blank

Owner, on the Setnayan AI spotlights: *"reframe it"*.

`capture-demo-stills.mjs` photographs each demo scene into a 460×972 frame and
`_spotlights.tsx` renders that frame at its full 9:19 — on eight public product
pages and on the Setnayan AI buy page. Scenes 1 (ranked shortlist) and 3
(deadlines) were laid out `absolute inset-0 flex flex-col`, so their short
content sat at the top and every pixel of slack fell below it. They now centre,
and both stills are re-captured against a real dev server and **looked at**.

⚠ **NOT the defect `lint-demo-capture-geometry.mjs` guards, and telling them
apart is the point.** That one was a viewport SMALLER than the recorded frame,
so Playwright composited 1:1 into the top-LEFT and padded the right as well —
content ended at x=229 of 460. Here the geometry is correct (460×972 in, 460×972
out) and content spans the FULL WIDTH; only the vertical slack was wrong. Two
different bugs that draw a similar-looking picture. **Check the width to know
which one you have.**

🔎 **It is not two pictures, it is twenty-five.** Measured across
`studio-card-demo.tsx`: **25 of 52 scenes, in 12 of 13 products**, top-align the
same way — so every doorway using stills has been showing half-empty frames.
Two are fixed here; the remaining 23 are BASELINED, not swept up, because
fixing one is a look-at-it job: centring a scene whose content OVERFLOWS clips
its first row instead of its last, which is worse, and no source check can tell
a short scene from a tall one.

`lint-scene-fills-its-frame.mjs` refuses a NEW top-aligned scene and also fails
on a STALE baseline line — a rule that cannot fire protects nothing. Wired into
CI beside the geometry guard. Verified in both directions by sabotage.

⚖ **Still open, and an owner call, not a mechanical fix:** even centred, these
scenes fill roughly 40% of a 9:19 frame. Making the picture actually FULL means
shortening the capture (and `_spotlights.tsx`'s `aspect-[460/972]`), which
re-crops all 52 stills across 13 products through `object-cover`. Flagged rather
than done.

SPEC IMPACT: None. Two re-captured images and a new guard; no copy, price or
locked decision changed.
