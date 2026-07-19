## 2026-07-16 · feat(creator): owned-music teaser render for Adventure Chapters

Wired the deferred CP-2 teaser onto the PR #3304 foundation (the previously
dead `creator_chapters.teaser_r2_key` column). A creator can now generate a
short (~6s) Setnayan-HOSTED 9:16 teaser from a chapter's Papic gallery photos
set to one Setnayan-owned track, ending on a "Made with Setnayan" card — the
shareable hook. The creator's full edit still only ever EMBEDS (never hosted).

- **Render path — CLIENT-SIDE (no new pipeline).** The repo has no reusable
  server render: the FFmpeg recap builder (`lib/render/recap-ffmpeg.ts`) is a
  stub with no worker/queue, and the render host is owner-locked to ₱0 server
  compute. So the teaser reuses the existing client renderer `lib/reel-render.ts`
  (`renderReel`, WebCodecs mp4 / MediaRecorder webm — the same engine behind
  Guest Stories + Patiktok). With music it takes the MediaRecorder path (webm).
- **Owned music ONLY (hard line).** The backing track is resolved exclusively
  from the Setnayan-owned `reel_music_tracks` catalogue via a new
  `pickOwnedReelMusic()` export (same `is_active` + NOT `is_premium` query as a
  Guest Story). There is no creator-supplied/uploaded audio path — the render's
  only audio source is that one server read, so BYO audio can never reach it.
- **New:** `lib/creator-teaser.ts` (server plan builder — photos + owned track),
  `app/api/creator/teaser-upload/route.ts` (ownership-gated presigned R2 PUT),
  `.../creator/_components/teaser-generator.tsx` (client orchestrator: prepare →
  render → upload → finalize). **Edited:** creator `actions.ts`
  (`prepareChapterTeaser` / `finalizeChapterTeaser`), `page.tsx` (teaser card +
  preview + `teaser_r2_key` select), `lib/guest-stories.ts` (music export).
- Photo source = the chapter substrate's `papic_gallery_id` read as an event id
  and fed to `fetchPapicGallery` under the creator's RLS (a gallery they can't
  access simply returns no rows — no data leak). Wiring the dedicated `event_id`
  FK + an event picker is a follow-up; this reuses the existing field.
- No migration (`teaser_r2_key` already exists). Typecheck + lint clean on
  touched files; migration:check + reel-render unit tests pass.

SPEC IMPACT: Realizes CP-2 (owned-music teaser) from
`Creator_Adventure_Chapter_Build_Plan_2026-07-16.md`; the teaser is now built,
not deferred. DECISION_LOG.md row appended in the corpus. Runtime end-to-end
still gated on owner infra (R2 CORS + at least one ingested owned
`reel_music_tracks` master); silent/degraded render when either is absent.
