## 2026-07-23 · feat(papic): Shared Pool Gallery + guest self-link ("I'm in this") — flag-dark

OnTheDay build ⑥ (corpus `OnTheDay_App_Build_Studies_2026-07-23.md` § 7). Guests can
browse the WHOLE event Papic pool (photos AND clips, web copies only) and link photos
they're in — a `photo_tags` row with the until-now-unused `source='manual_pick'`, which
automatically joins their "Photos of you" gallery, ZIP download, and Story-reel set
(zero downstream reader changes).

- Migration `20270917300000_papic_pool_gallery.sql` — `events.pool_gallery_open`
  BOOLEAN NOT NULL DEFAULT FALSE (the go-live hold; couple-only flip; retroactive
  close) + 3 SECURITY DEFINER RPCs, all `service_role`-only:
  - `guest_pool_gallery` — keyset-paginated (60/page) whole-pool read behind the
    strict outbound stack: toggle ON + `moderation_state='clean'` allowlist +
    `hidden_at IS NULL` + web-copy keys ONLY (never `r2_object_key`) + the wall-v2
    FaceBlock baked-blur rule (FB event ⇒ only baked `wall_safe` serves, clips
    excluded) + the `photo_consent` veto.
  - `guest_link_capture` — manual_pick insert; PHOTOS-ONLY in V1; advisory-locked;
    live-only 20-cap pre-check matching the merged `20270916200000` trigger exactly;
    revives only the guest's OWN tombstone; couple/admin removal is FINAL; post-insert
    verification (no false success at cap).
  - `guest_unlink_capture` — soft-tombstones the guest's own manual_pick only
    (`removed_by='guest'`), idempotent.
- Guest surface: session-gated `/papic/pool` (noindex, presigned web-copy thumbs,
  clip playback via `clip_web_r2_key`, per-tile "I'm in this", keyset load-more) +
  cookie-validated `/api/papic/guest-pool` (read) / `guest-pool-link` /
  `guest-pool-unlink` routes + a doorway card on `/papic/me/[token]` that renders
  ONLY when the pool is open (no dead door). The `/session` bridge gained an
  allowlisted `?next=pool` destination (no open redirect).
- Host surface: `PoolGalleryCard` beside the LiveWallCard on
  `/dashboard/[eventId]/studio/papic` — COUPLE-ONLY toggle (coordinators denied)
  with honest privacy copy (whole pool · web copies · guests can tag themselves ·
  closing is immediate/retroactive).
- Everything double-gated: `NEXT_PUBLIC_PAPIC_POOL_GALLERY` env (default OFF) AND
  the per-event couple toggle (default FALSE). Migration merges inert.
- DB test `tests/db/papic-pool-gallery.db.test.ts` replays ALL migrations and proves
  the gate matrix (toggle hold, allowlist, consent veto, FaceBlock, photos-only link,
  20-cap parity, revive/final-removal, idempotent unlink, cross-event denial).

SPEC IMPACT: `OnTheDay_App_Build_Studies_2026-07-23.md` § 7 is now built (flag-dark);
the § 7 owner sign-off list's cap-trigger item was already resolved by PR #3566.
