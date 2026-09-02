## 2026-09-02 · fix(panood): the public page and the controller follow the broadcast, not the calendar

- `app/[slug]/_lib/loaders.ts`: `loadLiveLayer` now resolves `watchLive` (and the
  Roam side-camera manifest) on every render, regardless of `dayOfPhase` — the
  live player used to be gated inside `if (dayOfPhase === 'live')`, so a genuinely
  live broadcast was hidden from guests whenever the calendar said it wasn't the
  day. `panood_watch_url` already self-clears on `endPanoodBroadcast`, so no new
  state was needed. The Live Photo Wall mirror keeps its original live-window
  rule — it's on-the-day chrome about being at the event, not about being on air.
  `app/[slug]/_components/site-body.tsx` drops the matching `dayOfPhase`/`isLive`
  gates on the two `<WatchLiveBlock>` mounts and on `playerOnPage`.
- `lib/live-studio-window.ts`: adds `shouldWarnWindowNotStarted`, a pure function
  (same shape as `decideArchiveGuard`) that says whether an OWNED event's
  broadcast day has never been anchored (`reason === 'awaiting-go-live'`), silent
  on the event day itself. `app/panood/control/[eventId]/_components/broadcast-window-strip.tsx`
  renders a fifth strip state from it: "Your broadcast day hasn't started."  No
  confirmation dialog, no change to the Go-live button — friction at a ceremony is
  worse than the thing it prevents. `app/panood/control/[eventId]/page.tsx` now
  selects `event_date` and passes `reason`/`eventDate` through.

SPEC IMPACT: None — both changes make an existing owner-ruled behavior (single-cam
Panood is free and calendar-independent; ₱3,000 buys one broadcast day anchored on
first entitled go-live) visible where it wasn't, without changing the rule itself.
