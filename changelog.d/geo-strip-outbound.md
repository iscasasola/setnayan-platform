## 2026-07-16 · fix(privacy): strip geo/EXIF on outbound photo shares & downloads (RA 10173)
SPEC IMPACT: Reconciles code with CLAUDE.md "geo stripped on outbound shares" claim. Clip-strip deferred — logged in DECISION_LOG.

Owner sign-off #1 (BLOCKING) of `Social_Share_Settings_Council_Verdict_2026-07-16.md`.

PROBLEM: CLAUDE.md promises "geo is stripped on outbound shares; original on R2
retains it," but the outbound paths fell back to the geo-bearing ORIGINAL
(`r2_object_key`) whenever a metadata-stripped derivative was absent — so a
downloaded/shared Papic photo could leak the venue's/home's exact lat-lng in its
EXIF GPS.

PHOTOS (fixed): every outbound path now serves a metadata-stripped derivative and
NEVER the raw original:
- Couple ZIP (`.../studio/papic/gallery-zip/route.ts`) and guest ZIP
  (`/papic/me/[token]/download/route.ts`): prefer `display_r2_key` (AVIF web copy
  sharp already built with all metadata dropped); when no derivative exists yet,
  fetch the original and run a new `stripPhotoMetadata()` sharp pass on the fly
  (rotate → strip EXIF/GPS → full-res JPEG) before it enters the zip. A raw
  original is never zipped; if the strip fails the item is dropped.
- Per-tile "save to phone" (couple gallery grid): new `GalleryPhoto.saveUrl`
  points only at a stripped derivative (display → thumb); the save button hides
  for the few seconds until the derivative renders rather than offering the
  original.
- Guest "open full size to save" grid (`lib/guest-live-gallery.ts`): outbound ref
  no longer falls back to the original.
- Added `stripPhotoMetadata()` to `lib/papic-derivatives.ts`.
- Already-safe (verified, unchanged): live photo wall (`wall_safe_r2_key` is a
  sharp-baked JPEG) and the Kwento Magazine PDF (sharp re-encode strips EXIF).

CLIPS (deferred): video/MP4 container GPS strip needs an ffmpeg
`-map_metadata -1` pass, which Vercel can't run on the serving path (no ffmpeg).
Standing up the render/worker pipeline for this is out of scope. Mitigation: all
Papic clips are recorded in-browser via `MediaRecorder`, which writes no GPS, so
current exposure is nil; only future camera-roll/DSLR-origin clips could carry
GPS. Documented inline at the clip-save sites.

Confirmed no public/OG/editorial route selects `geo_lat`/`geo_lon`. R2 originals
are untouched (still retain geo per spec) — only what OUTBOUND paths serve changed.
