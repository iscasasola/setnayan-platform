## 2026-09-25 · feat(event-hub): media — compress first, 15-second clips, 1080p, a 100 MB meter

Event Hub Maker Phase 4 (the media pipeline), per `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`
§ Phase 4 and `DECISION_LOG.md` 2026-09-25:

- **Compress first, then check.** `app/_components/file-upload.tsx` checked `file.size >
  maxBytes` on the ORIGINAL file, before compression ran — rejecting a raw phone photo/clip
  that would have shrunk well under the cap. The raw-size gate is now skipped for anything this
  instance will compress (`compressImage`/`compressVideo`); `uploadOne` re-checks the size
  AFTER compression, against the bytes that actually reach R2.
- **No trimmer — a clip over 15 seconds is refused before any upload.** New
  `lib/maker-media-limits.ts` (`MAKER_MAX_CLIP_SECONDS`, `MAKER_CLIP_TOO_LONG_MESSAGE`,
  `makeMakerVideoDurationValidator`) — the exact owner sentence, "Please pick a video under 15
  seconds.", read on the device before any compression or network call.
  `maxVideoDurationS`/`compressVideoForWeb`'s output trim stays the backstop for an unreadable
  codec.
- **A `'maker'` video-compress profile** (`lib/video-compress.ts`): 1080p (1920 long edge),
  H.264 CRF 23, maxrate ~1.9M, faststart — the theme-loop setting. A clip used as a BACKGROUND
  strips its audio entirely (`-an`, `silent: true`); a clip placed as CONTENT keeps a small
  (96k) audio track. Added as its own profile — the existing `'quality'` (Save-the-Date, 4K/CRF
  21) and `'web720'` (Papic storage copy) paths are unchanged.
- **The 100 MB/event meter.** `events.couple_media_bytes` (new column, migration
  `20271245678627`) — a running counter of the couple's own compressed upload bytes, incremented
  server-side by `app/api/upload/route.ts` (via the new `increment_couple_media_bytes()`
  SECURITY DEFINER function, `service_role`-only) for the couple's own Event Hub media paths
  only (`events/<id>/{landing-page-hero,landing-page-hero-video,hero-video,our-photos,
  site-music,std-video,std-background}` — an explicit allowlist, never Papic/guest captures,
  never a vendor's own uploads, never a payment-proof/paperwork/dispute upload that happens to
  name the same event). NOT couple-writable — only `increment_couple_media_bytes()` (granted to
  `service_role` alone) can move it. New `app/_components/maker-media-meter.tsx`
  (`<MakerMediaMeter usedBytes capBytes? />`) and `lib/maker-media-limits.ts`'s
  `makerMediaMeterState`/`formatMakerMediaMeterLabel`/`readCoupleMediaBytes` — exported for the
  Maker shell (Phase 1) to mount in its inspector.
- **Closed the hero-video snippet bypass (SEC-6).** `setWidgetBackground`'s only snippet source
  is the couple's own `landing_page_hero_video_r2_key` — the same unscreened clip
  `GUEST_HERO_VIDEO_PLAYBACK`/`heroVideoRefForGuests` exists to keep off every other guest
  surface. `app/[slug]/_components/hub-canvas-frame.tsx` played it with no gate at all. Now
  gated identically to every other hero-video read site: a blocked snippet renders as a ref
  whose signing failed (no picture, not a styled plate), never as an error. Updated
  `lib/a-ground-kind-meets-the-arrangement.test.ts`, the one existing test that assumed the old
  (bypassed) behaviour, to pin the new, correct one.
- Mounted `<MakerMediaMeter>` on `app/dashboard/[eventId]/website/living-hero/page.tsx` (reads
  `couple_media_bytes`) so the meter has a real runtime importer today, ahead of the Maker
  shell's own inspector mount — `tests/db/ugat-both-ends.db.test.ts` requires every component
  to be reachable, not merely exported.
- Fixed a discarded-Supabase-error caught by `lib/a-database-error-is-never-ignored.test.ts`: the
  meter's RPC call now reads `{ error }` instead of only awaiting it. Fixed the migration's own
  proof insert tripping `events_wedding_fields_consistency` (supply `ceremony_type`/
  `venue_setting` since `event_type` defaults to `'wedding'`) — caught by
  `papic-dedicated-camera-metering.test.ts` / `papic-pool-metering.test.ts`'s PGlite replay.
  Regenerated `supabase/security/exposure-surface.baseline.txt` for the one expected new fact
  (`col public.events.couple_media_bytes anon=- authenticated=S`).

SPEC IMPACT: None — DECISION_LOG 2026-09-25 already states every rule this PR implements; no
corpus edit needed.
