# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-02 · fix(demo-capture): the recorder stops padding three quarters of every clip

Every looping demo clip under `public/add-ons/demo/` has been shipping **three
quarters empty**, for an unknown length of time.

### What was wrong

`capture-demo-videos.mjs` gave Playwright a **230×486 viewport** and asked for a
**460×972 video**. Playwright's contract is explicit that it only ever scales a
page **down**:

> Actual picture of each page will be scaled down if necessary to fit the
> specified size.

So it never enlarged anything. Each frame was composited 1:1 into the **top-left
corner** of a larger canvas and the remaining three quarters were padded flat
grey.

### How it was found, and why nothing found it sooner

Not by looking at the files — by looking at the **pixels**. A frame drawn to a
canvas and scanned across a row: content ends at **x=229 of 460**, on every clip
tested (`papic`, `mood-board`, `indoor-blueprint`, `custom-qr-guest`,
`save-the-date`). Extracting a frame with ffmpeg confirms it: the content is the
top-left 230×486 quadrant, and the two halves of a frame compress to 36 KB and
3.4 KB.

🚨 **It was live.** The deployed `papic.mp4` is byte-identical to the repo's
(sha256 `70d86eff63cd93bb…`, 50,863 bytes both), and `/papic` renders it at
`aspect-[460/972]` with `object-cover` — so that page's own *"The app itself —
this is all of it"* section has been showing mostly nothing. The Studio app
cards use the same files.

🔑 **Every check anyone would think to write passed.** The files existed, were
the right dimensions, played, looped, and weighed the documented ~50 KB.
`cropdetect` says the frame is full — because it looks for *black* borders and
the padding is grey. The defect was invisible to everything except a pixel.

### The fix

- **The capture viewport now equals the video size** (460×972), so there is
  nothing left to pad.
- **The reel stage fills it with CSS `zoom: 2`**, not `transform: scale`. `zoom`
  re-lays-out at the larger size, so type is rasterised at true 2×; a transform
  would upscale an already-rasterised bitmap. The stage stays authored at the
  in-app 230×486 content box.
- **The poster screenshot is pinned to `scale: 'css'`** — otherwise
  `deviceScaleFactor: 2` writes a 920×1944 JPEG beside a 460×972 video.

### The guard

`scripts/lint-demo-capture-geometry.mjs`, wired into `ci.yml`. It guards the
**cause**: the viewport, the video size and the reel's zoom are one measurement,
and it fails if they stop agreeing.

Deliberately source-level, not pixel-level. The honest check needs ffmpeg, and
this folder's own README says a real libx264 build is NOT present by default
(Playwright's is VP8-only). **A required CI step that needs a binary CI lacks is
a step that gets skipped or deleted.**

| Sabotage | Caught |
|---|---|
| viewport back to 230×486 (the original bug) | ✅ with that bug's exact message |
| drop the reel's `zoom` | ✅ |

### ⚠ The clips on disk are still the old ones

**Nothing has been regenerated.** This change means the *next* capture produces
correct output; it does not repair the 14 files sitting in `public/add-ons/demo`.
Regeneration is manual (see that folder's README) and needs a quiet machine —
attempted here and abandoned: `/demo-capture/[slug]` never finished compiling,
with system load above 100 from concurrent work.

The guard says so in its own docblock: **it cannot see stale assets.** Until the
clips are recaptured, `/papic` and the Studio cards keep showing the padded
frames, and `app/(shell)/pa3d/_pa3d-parts.tsx` keeps its documented crop to the
live half (harmless once the clips are full-width — it would simply show the
left half of a full frame).

SPEC IMPACT: None.
