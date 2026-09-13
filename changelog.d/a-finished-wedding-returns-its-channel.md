## 2026-09-02 · fix(live-studio): a finished wedding returns its channel

`NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY` closed the BYO connect door on 2026-09-02, making the
Setnayan-owned pool the only route to a Roam broadcast. Production held exactly one pool
channel, checked out to a wedding whose streams had already gone `complete` — since manual
release (`/admin/live-studio-channels`) is a deliberate admin act, that one un-released
checkout silently became the entire product down for every other event.

`checkoutPoolChannel` in `apps/web/lib/live-studio-roam-provision.ts` now sweeps for stale
checkouts as a LAST RESORT — only on the branch where the availability read comes back
empty, at most once per checkout call, never eagerly. The new `reclaimStaleCheckouts`
requires BOTH that the checkout has outlived `PANOOD_WINDOW_HOURS` (imported from
`lib/panood-watermark.ts`, not re-typed) and that `releasePoolChannelIfIdle` independently
agrees the event's streams are idle — the ONE release path, delegated to rather than
duplicated, so two mechanisms can never disagree about whether a channel is free. This is a
reclaim, not a wipe: rows return to `available`, nothing is deleted, and manual release from
the admin board stays the default path.

Guarded by `apps/web/lib/live-studio-roam-reclaim-guard.test.ts` (own file, four properties
pinned and mutation-tested independently): reclaim runs after the availability read, the
grace period is the imported constant, reclaim delegates instead of writing the pool row
directly, and the sweep fires at most once per call.

OWNER QUESTION (not decided here): one pool channel is a single point of failure now that
BYO is closed. Connecting more channels (~97 cap slots remain) is the cheaper fix and needs
no code.

SPEC IMPACT: § 4h — release/reuse. Reclaim is release WITHOUT the wipe that section pairs it
with; flagged for the owner, not applied to the corpus.
