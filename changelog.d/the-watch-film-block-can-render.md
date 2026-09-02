## 2026-09-02 · fix(editorial): the "Watch the Film" replay can now render

The couple's editorial page could never show their Live Studio replay, for two
independent reasons — same disease as the guest-list defect, a failure that
renders identically to "they didn't buy it":

1. The gate asked `eventSkuActive(admin, eventId, 'PANOOD_SYSTEM')` — a SKU
   retired from `platform_retail_catalog_v2` entirely, so no order could ever
   carry it and the gate was false for every event that has ever existed.
   Now gates on `'LIVE_STUDIO'`, which `SKU_OWNERSHIP_ALIASES.LIVE_STUDIO`
   (exactly `PANOOD_PAID_SKUS`) still lets a grandfathered Cast buyer through.
2. `events.panood_watch_url` is deliberately cleared the moment a broadcast
   ends (so a finished event stops advertising itself as on-air), which wiped
   the only source the replay read — at exactly the moment a couple went
   looking for it. Now falls back to the most recent `panood_broadcasts` row
   with `status = 'complete'`, whose `broadcast_id` is the YouTube video id.
   The fallback goes through the same `isYouTubeVideoId` injection barrier
   before reaching the embed — it gets no free normalize the way the live URL
   does via `parseYouTubeVideoId`.

`panood_watch_url` is never written from the replay path — that column drives
the separate live "Watch Live" block, and setting it here would tell guests a
finished broadcast is still on air.

New guard: `apps/web/lib/the-watch-film-block-can-render.test.ts`, windowed to
the block (not the whole file), mutation-tested against all three failure
modes (SKU revert, fallback removal, barrier removal).

SPEC IMPACT: None — restores `09_Panood_Feature_Specification.md` § 6 behaviour
("couples download from their Setnayan dashboard via a link that resolves the
YouTube watch URL"), does not change it.
