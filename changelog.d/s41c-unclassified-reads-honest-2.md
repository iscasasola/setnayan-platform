## 2026-09-19 · fix(reads): result-dropped-silently, UNCLASSIFIED tier batch 2/2

S41c · batch G of the `result-dropped-silently` class from S26's both-ends
orphan baseline (#5625), UNCLASSIFIED tier, 15 rows / 19 findings. A refused
Supabase read tested only as an if/else, with the selected branch recording
nothing, renders identically to a genuinely empty/absent result.

Shape 1 (log-only, 18 sites) — the read is now genuinely read (logged);
control flow unchanged:

- `lib/nsfw-screen.ts` — `screenCapture`'s row fetch (`opts.table`) + both
  sweep reads (`reScreenStuckCaptures`, `reScreenAllStuckCaptures`) now log.
- `lib/panood-moments.ts` — the pre-bootstrap select-degrade in
  `fetchPanoodMoments` and the seed-insert failure in
  `provisionPanoodMomentsAdmin` now log.
- `lib/panood-screens.ts` — the pre-bootstrap select-degrade in
  `fetchPanoodScreens` and the upsert failure in `provisionPanoodScreensAdmin`
  now log.
- `lib/person-life-stories.ts` — `resolveMutualStoryDays`'s `people` read now
  logs while staying fail-closed to `[]` (disclosure surface, unchanged).
- `lib/promo-free-windows.ts` — the couple-audience and vendor-audience
  window reads now log while staying fail-closed to `[]`.
- `lib/secrets/reencrypt.ts` — `sweepColumn`'s per-row update failure now
  logs (Postgres error shape + column name only — never the ciphertext).
- `lib/setnayan-ai-notify.ts` — the GRD-01 scheduled-email claim's upsert
  failure now logs.
- `lib/vendor-autoreply/auto-accept.ts` — the `integrity_flags` trust-flag
  probe now logs while staying fail-closed (`trustFlagged = null`).
- `lib/venue-recommendations.ts` — all three `venue_directory` reads
  (`findPairedCeremonyVenues`, `findCeremonyVenuesByFaith`,
  `findReceptionVenuesByVenueSetting`) now log. (Not yet wired to any page —
  no caller in the app today.)
- `lib/whats-next.ts` — `writeAnnouncement`'s read-before-write now logs
  while still refusing the write on a refused read (never blanks the draft).
- `lib/with-rate-limit.ts` — the `check_rate_limit` RPC failure now logs
  while still failing open (never blocks a real user on a limiter outage).

Shape 2 (honest render state, 1 site):

- `lib/panood-broadcast.ts` — `getLatestPanoodBroadcastStatus` used to fold a
  refused read into `null`, which `lib/live-watch-state.ts`'s
  `decideGuestWatchState` treats as `'not_yet'` — telling a guest mid-
  broadcast that the ceremony "hasn't started," and (via
  `watch-live-embed.tsx`'s poll-continuation guard) permanently stopping the
  client poller. Added a distinct `BROADCAST_STATUS_UNREADABLE` sentinel,
  threaded through a new `GuestWatchState = 'unknown'`, rendered by
  `watch-live-embed.tsx` as "We couldn't check the stream status just now —
  this will refresh automatically" while polling continues exactly like
  `'reconnecting'`.

New test: `lib/s41c-unclassified-batch-g-reads-are-honest.test.ts` (9 tests —
2 functional, 7 source-scan with an exact occurrence floor). Each rule was
sabotage-proven red locally before finalizing (log line removed → test fails;
`'unreadable'` guard removed from `decideGuestWatchState` → tests 1 and 9
fail), then restored.

Combined with batch F (also 15 rows), this closes out every UNCLASSIFIED-tier
`result-dropped-silently` finding from the S26 baseline.

SPEC IMPACT: None.

**Fix-up (post-refresh onto main):** the guest poll no longer lists `'unknown'` in its gate —
that contradicted W1's "polling stops once nothing is left to reconnect to". A refused read now
raises a separate `statusUnreadable` flag (drives the "couldn't check" copy) and never replaces
the last READABLE status, so polling continues only while that status is `live`/`reconnecting`
and stops on the first readable `ended`/`not_yet`. Test 4 now anchors on each capture-table
read's error branch instead of a total count (main added a fourth, unrelated log in the file).
