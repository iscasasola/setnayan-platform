## 2026-09-01 · fix(live-studio): the transport's "End" button stops claiming it ended a broadcast that was never created

`TransportRow`'s red "End broadcast" button showed for BOTH ways an event can be
on air (`resolveLiveAir`'s `source`: `'broadcast'` or `'manual'`), but it always
called `endPanoodBroadcast` — which closes a `panood_broadcasts` row a by-hand
host never has, and along the way clears `events.panood_watch_url`, the watch
link that host pasted themselves. `events.panood_manual_on_air_at` — the field
actually making `isLive` true for that host — was never touched, so the
control read "on air" again immediately after "ending" it.

`lib/live-studio-manual-air.ts` gains `endOnAirTarget(source)`, a pure map from
`'broadcast' | 'manual' | null` to which action to call. `TransportRow` now
takes a `liveSource` prop and routes a manual-only host to a new
`endManualOnAir` server action (same write as the existing
`clearControlManualAir`, called directly rather than via `<form>` so it fits
the same JS transition `endPanoodBroadcast` already uses). The separate
by-hand "We're on air" switch further down the controller is unchanged.

Also measured against `origin/main` and found ALREADY SHIPPED, not touched by
this PR:
- the camera tile's "Camera connected" caption (`resolveChannelStatus` already
  resolves staleness against `last_seen_at` at read time in
  `app/panood/control/[eventId]/page.tsx`);
- the YouTube 12-hour archive warning (`decideArchiveGuard` /
  `BroadcastWindowStrip`, already wired and rendered on the controller).

SPEC IMPACT: None.
