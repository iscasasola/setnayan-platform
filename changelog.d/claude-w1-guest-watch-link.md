## 2026-09-05 · fix(live-studio): guests never hold a dead watch link across a broadcast reconnect (W1)

`watch-live-block.tsx`'s CAST embed server-rendered `watchLive.watchUrl` as a
static `<a href>` with no client re-resolution. A reconnect that has to bind a
NEW YouTube broadcast to the same RTMP stream (YouTube cannot resume video
into an already-ended broadcast) mints a new video id, and every guest already
on the page — the whole point of the day-of watch link — was left holding the
one that just ended. Own-channel by-hand hosts (`live-studio-manual-air.ts`)
who re-paste a fresh link after restarting hit the identical symptom.

**Fix, two halves:**

- `GET /api/live/[slug]/watch` (public, `Cache-Control: public, max-age=15`) —
  reduces exactly what the story page already reads for `watchLive`
  (`lib/watch-live-links.ts`'s `readEventWatchUrls` + `resolveWatchLinks`) plus
  the most recent `panood_broadcasts.status` for the event
  (`lib/panood-broadcast.ts`'s new `getLatestPanoodBroadcastStatus`) into a
  guest-facing `{ watchUrl, state }`, where `state` is one of
  `'live' | 'reconnecting' | 'ended' | 'not_yet'`
  (`lib/live-watch-state.ts`'s pure, fully-unit-tested `decideGuestWatchState`).
  No YouTube API call — this route is designed to be polled by every guest on
  an event every 30s, and a fresh YouTube quota hit per poll would blow the
  budget `live-studio-ingest-health.ts` already reserves for its ONE
  150s host poller.
- `watch-live-embed.tsx` (new client component, extracted from the CAST branch
  of `watch-live-block.tsx`, which stays a server component for its
  Roam-picker and Facebook-only branches) polls that route every 30s while
  `state` is `'live'` or `'reconnecting'`, swaps the `<a href>` and the iframe
  embed src in place on a fresh link, and shows "The stream is reconnecting —
  this link will update on its own." only while `state === 'reconnecting'`.
- `POST /api/live-studio/encoder/broadcast-ended` (new, host-gated via the same
  `isLiveStudioSetupHost` predicate as `ingest-health/route.ts`) — the receiver
  for S7's (not yet built) ingest-drop signal. Marks the active
  `panood_broadcasts` row `'errored'` immediately (a status the CHECK
  constraint has always allowed and no code had ever written — this is now
  its one writer, and it is this feature's "reconnect in flight" signal), then
  reuses the existing provisioning exactly: `createYoutubeBroadcast` +
  `bindYoutubeBroadcast` on the SAME `stream_id` (never a second binder) +
  `createPanoodBroadcast` (the same close-prior-then-insert `goLivePanood`
  already runs), then mirrors the new watch URL into `events.panood_watch_url`
  the same way `goLivePanood` does.

Verified the couple's own recordings list (`LiveStudioRecordingsCard` /
`fetchEventRecordings`) already reads `panood_broadcasts` regardless of
status, so a reconnect's PART ONE stays reachable there — no change needed.

Tests: `lib/live-watch-state.test.ts` (pure decider, all state combinations,
mutation-tested — dropping the `'complete'` branch turns the GUARD test red);
`watch-live-embed.test.ts` + updated `watch-live-block.test.ts` (structural,
mutation-tested — widening the reconnecting-sentence gate from
`state === 'reconnecting'` to `state !== 'live'` turns the GUARD test red).

SPEC IMPACT: None — reliability fix behind existing Panood watch-link surface,
no new SKU, flag, or locked decision touched.
