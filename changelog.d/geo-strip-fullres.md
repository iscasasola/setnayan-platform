## 2026-07-16 · fix(privacy): outbound Papic photo saves are FULL-RES, geo-stripped (RA 10173)
SPEC IMPACT: Refines the 2026-07-16 geo-strip landing (PR #3293) per owner "Download all / per-tile save stay full-resolution." No new spec claim; reconciles with CLAUDE.md "geo stripped on outbound shares."

Owner 2026-07-16 correction to PR #3293: the couple's/guest's "Download all" ZIP
and the per-tile "save to phone" must stay FULL RESOLUTION (whatever the original
is) — do NOT downgrade to the 1280px AVIF web copy. Just strip the geo/EXIF at
full res.

What each outbound path now serves (PHOTOS):
- Couple ZIP (`.../studio/papic/gallery-zip/route.ts`) + guest ZIP
  (`/papic/me/[token]/download/route.ts`): the FULL-RES original run through the
  on-the-fly `stripPhotoMetadata()` sharp pass (rotate → drop EXIF/GPS → full-res
  JPEG, `.jpg`). The stripped AVIF `display_r2_key` web copy is used ONLY as a
  fallback when the original's R2 pixels were dropped after 3 months (so the
  download never 404s). Resolution is never downgraded while the original exists;
  the raw geo-bearing original is never served. Zips already stream one object at
  a time (strip per-item as it's appended → bounded memory).
- Per-tile "save to phone" (couple gallery): new same-origin route
  `.../studio/papic/save-photo` streams the full-res original stripped on the fly
  (couple-auth + event scope re-checked server-side). `GalleryPhoto.saveUrl` now
  points at it instead of a presigned derivative.
- Guest "open full size to save" (`/papic/me/[token]/photo`): new token-scoped,
  tag-verified route streams the full-res original stripped on the fly, served
  inline for long-press-to-save. The grid thumbnail stays the light derivative.

Unchanged (correctly): the public live photo wall save stays the face-blurred
`wall_safe_r2_key` derivative — blurring faces there is intentional; a full-res
unblurred original would leak faces + geo. Kwento Magazine PDF already sharp-strips.

CLIPS: unchanged / still deferred — MP4 container GPS strip needs an ffmpeg
`-map_metadata -1` pass Vercel can't run on the serving path. Browser-captured
Papic clips carry no GPS; only future camera-roll/DSLR-origin clips could.

R2 originals untouched (retain geo per spec). CPU: full-res strip is heavier than
serving derivatives, but each item is streamed incrementally within the 60s ZIP /
30s single-photo function limits; a hard timeout on a very large (500-1000-item)
gallery would surface as skipped items, never a silent resolution downgrade.
