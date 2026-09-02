# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-03 · fix(demo-capture): all 13 clips recaptured — the frames are full

The other half of #5109. That PR fixed the recorder; **this one repairs the
assets**, which had been three quarters flat grey.

Every `.mp4` and `.jpg` under `public/add-ons/demo/` re-recorded with the
corrected geometry (viewport = video size, reel stage zoomed to fill).

### Verified per clip, not in aggregate

The padding was a flat fill, so it compressed to nearly nothing — which is what
makes it measurable. Cropping each frame's right half and encoding it as PNG:

| | right half of frame |
|---|---|
| before | **3,403 bytes** — a solid grey rectangle |
| after | **13,555 – 44,204 bytes** — real UI |

**13 of 13 clips full. Zero padded.** All still 460×972; every poster is
460×972 too, confirming the `scale: 'css'` fix (they would otherwise be
920×1944 under `deviceScaleFactor: 2`).

### The files got bigger, and that is correct

939 KB → 2,068 KB across 26 files; per clip ~50 KB → 54–114 KB (avg 80).

🔑 **The old files were small because they were broken.** Three quarters of each
frame was a solid fill, which is nearly free to encode. A full frame of real UI
at true 2× costs more, and that is the honest price of the clip actually showing
the product. The README's stated `~40–70 KB` is updated to `~54–114 KB` with
that reasoning recorded beside it — if the range ever drops back, the geometry
is the thing to suspect, and `lint-demo-capture-geometry.mjs` guards it.

### What this unblocks

`/papic`'s *"The app itself — this is all of it"* section, and every Studio app
card, now show the whole product instead of a quarter of it.

⚠ `app/(shell)/pa3d/_pa3d-parts.tsx` (PR #5101) still crops to the left half.
That crop is now **unnecessary but harmless** — on a full frame it simply shows
the left half — and simplifying it is a one-line follow-up once #5101 lands,
noted in that file's own docblock.

Verified: typecheck ✅ · lint ✅ · guards ✅ (incl. demo-capture geometry) ·
per-clip frame measurement ✅

SPEC IMPACT: None.
