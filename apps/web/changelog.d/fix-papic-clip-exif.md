## 2026-07-22 · fix(papic): clips carry no capture metadata on delivery + accurate /privacy notice

VERIFY-FIRST privacy pass on Papic video clips (parallel to the existing
still-photo EXIF/GPS strip). Established the real exposure before changing
anything, then applied the proportionate CASE-A fix.

**Exposure findings.** On every OUTBOUND / gallery / guest / public play surface a
clip resolves through `resolvePlayRef(row)` = `clip_web_r2_key ?? raw` (`lib/
papic-display-ref.ts`, used by `lib/papic-gallery.ts`, `app/[slug]/_components/
editorial/data.ts`, `lib/alaala-orb.ts`, `lib/life-story-moment-graph.ts`) — i.e.
the served/shared clip is the small re-encoded WEB COPY, not the raw capture. The
web copy is produced client-side by `compressVideoForWeb(..., { profile: 'web480' })`
(`lib/video-compress.ts`) on the seat + guest capture paths. The couple's own
"Download all" originals path (`app/papic/me/[token]/download/route.ts`) is the
ONLY surface that hands out the raw clip `.mp4`, and only to the couple who owns it
— left untouched. Today's raw clips are browser MediaRecorder captures that embed
no GPS, so the live exposure is minimal (matching the earlier "deferrable" rating).

**Why a real (not cosmetic) fix.** The pre-fix web-copy re-encode set no
`-map_metadata`, and ffmpeg's DEFAULT is `-map_metadata 0` (COPY global metadata
from the first input). So the "a re-encode drops metadata" assumption was WRONG —
a future GPS-bearing source (native app / DSLR bridge, Phase 2) would have its
QuickTime location atom + `creation_time` COPIED through into the served web copy.

**Changed.**
- `apps/web/lib/video-compress.ts` — added an explicit `-map_metadata -1` to the
  shared ffmpeg exec args so BOTH the `web480` (Papic served clip) and `quality`
  (couple STD-film upload) re-encodes drop all container/global metadata by intent,
  not by accident. Does not touch the download-originals path (that streams the raw
  R2 object directly, never through this function).
- `apps/web/app/privacy/page.tsx` — reconciled the stale "(Video clips retain their
  embedded metadata for now…)" line to the true behavior: shown/shared clips are a
  re-encoded web copy produced without the capture device's location/embedded
  metadata; the couple's own full-res clip originals stay private and keep what the
  camera recorded.

SPEC IMPACT: None to the corpus schema/SKUs. Reconciles the /privacy public notice
(RA 10173 disclosure) to match shipped behavior — served/shared Papic clips no
longer disclosed as metadata-bearing; couple-owned download originals correctly
disclosed as retaining metadata. No DECISION_LOG-locked decision affected.
