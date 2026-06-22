## 2026-06-22 · feat(alaala): light the orb — guest-recorded 5s clips (consent + couple approval) feed it end-to-end

The Alaala memory orb had a producer gap: the prior feed PR
(`alaala-orb-feed.md`) read `papic_photos` (the paparazzi/SEAT capture table),
which has **no consent producer** — a seat clip is shot BY the photographer, not
the guest who appears in it, so its `consent_to_public` could never be set by
the depicted person. So the orb stayed cold. This is **Option A** (owner-chosen):
switch the producer to the GUEST self-capture path, where the guest both
**records** and **consents to** their own clip — the cleanest consent chain.

End state: a guest records a 5-second clip + opts in → the couple approves it →
the orb shows it. The owner-locked double-consent rule
(`project_setnayan_alaala_orb_video_consent`) holds: a clip surfaces ONLY when
BOTH `consent_to_public` AND `couple_approved_for_showcase` are true; cold-start
(empty → CSS-gradient skin) is preserved until the first clip clears both gates.

- **Migration** `20270216612756_alaala_guest_clip_showcase.sql` — adds clip
  support to `papic_guest_captures` (was photo-only): `consent_to_public` (re-
  added IF NOT EXISTS — #2062 was unapplied on prod), `couple_approved_for_showcase`,
  `media_type text NOT NULL DEFAULT 'photo'` (+ a `photo|clip` CHECK), `duration_ms`,
  `poster_r2_key`, a partial index `papic_guest_captures_alaala_showcase_idx`, and
  a `CREATE OR REPLACE` of `papic_record_guest_capture` adding trailing
  `p_media_type` / `p_duration_ms` / `p_poster_r2_key` params (photo path + the
  existing 2-/3-arg overloads unchanged; `LEAST(p_duration_ms,5000)` hard cap).
  Additive + idempotent, no RLS change. **Applied to prod** statement-by-statement
  via `db query` (ledger drift made `db push` over-reach) + a `schema_migrations`
  ledger row; all 5 columns + the 6-arg RPC + CHECK + index verified present.
- **Guest clip capture** `apps/web/app/papic/guest/_components/papic-guest-capture.tsx`
  — adds a Photo/Clip mode toggle. Clip mode re-acquires the rear stream WITH
  audio and records via `MediaRecorder` with a **HARD 5000ms** client stop +
  poster frame (mirrors `pabati-prompt.tsx`); the clip + poster + `duration_ms` +
  the existing `share_publicly` opt-in POST to the same route with
  `media_type=clip`. Photo capture is unchanged; the 5s countdown ring + REC chip
  reuse the pabati look.
- **Capture route** `apps/web/app/api/papic/guest-capture/route.ts` — now branches
  on `media_type`: clips accept `video/*` (≤25 MB), upload the `.mp4` + a sibling
  poster `.jpg` to R2, and pass `media_type`/`duration_ms`/`poster_r2_key` to the
  RPC (graceful-degrade fallback to the 3-/2-arg signatures if an older RPC is
  live). Drive-copy mime + the NSFW screen are clip-aware.
- **NSFW screen** `apps/web/lib/nsfw-screen.ts` — `screenCapture` now treats a
  `papic_guest_captures` row with `media_type='clip'` like a `papic_photos` clip:
  it swaps the classification target to the poster frame (never the video bytes),
  with a pre-migration retry so the photo path still screens.
- **Couple approval** new `setGuestClipShowcaseApproval` server action
  (`studio/papic/actions.ts`) flips `couple_approved_for_showcase` on a guest
  clip via the admin client after the app-level couple check (the couple has
  read-only RLS on `papic_guest_captures`; same pattern as `setPapicStorage*`),
  scoped to `(capture_id, event_id, media_type='clip')`. `papic-gallery.ts` now
  maps guest clips (poster thumb + both gate flags + a `source: 'seat'|'guest'`
  discriminator); the gallery grid's sparkle toggle routes guest clips to the new
  action, seat clips to the existing one.
- **Orb feed** `apps/web/lib/alaala-orb.ts` — switched from `papic_photos` to
  `papic_guest_captures` where `media_type='clip'` AND both gates AND non-hidden
  AND NSFW-`clean`; presigns each clip's own `r2_object_key`. Stays graceful
  cold-start (`[]`) when empty.

SPEC IMPACT: 0012 Papic / Alaala — Option A end-to-end: guest 5s clips + consent
+ couple approval feed the orb; migration adds clip support + `couple_approved`
on `papic_guest_captures` + the RPC update. Closes the guest-gate follow-up the
prior feed PR flagged.
