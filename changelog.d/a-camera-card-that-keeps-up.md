## 2026-09-01 · fix(live-studio): the controller's camera card keeps up with the camera

`resolveChannelStatus` already resolved a channel's honest status against
`last_seen_at` at READ time, and the controller already rendered that resolved
value — both correct, and both shipped well before this change. But
`apps/web/app/panood/control/[eventId]/page.tsx` is a server component with no
timer, no `router.refresh()` and no realtime subscription: the only thing that
re-ran it was a host firing a server action. So the honest status was computed
once, at page load, and then froze.

That is why a card was seen reading "Camera connected" over a heartbeat 140
seconds stale. The resolver was right; the render was old. Re-fixing the resolver
could not reach it.

It lied in **both** directions, and the second is the more common: a host who
prints a join card, scans it on the camera phone and walks back to the laptop is
waiting, not clicking — so the card held "Waiting for a camera" over a camera
that had already joined.

- `lib/live-studio-channel-freshness.ts` — pure `shouldWatchChannels` (is there a
  bound seat, i.e. anything whose caption can change without a host action?),
  plus `CHANNEL_REFRESH_MS` **derived** from the existing `CHANNEL_HEARTBEAT_MS`
  and a stated `WORST_CASE_CARD_AGE_MS` bound. No new number is introduced.
- `lib/use-day-of-live-refresh.ts` — the visible/focus tick machinery extracted as
  `useVisibleTick`; `useDayOfLiveTick` now delegates to it with byte-identical
  semantics (a missing date still installs no listeners; the day-of gate is still
  re-checked per tick, not captured at render). Its six shipped consumers are
  untouched.
- `app/panood/control/[eventId]/_components/channel-freshness.tsx` — render-nothing
  companion, mounted beside `ProgramBridgeHost` and OUTSIDE `SetupSheet` for the
  same reason that one is: a component the sheet unmounts is a frozen card again.

A control room with no seat bound installs no timer at all, however long it is
left open — and cannot get stuck there, since binding a seat is itself a host
action that re-renders the page.

SPEC IMPACT: None. No schema, no pricing, no locked decision — this closes the
render half of an already-specified behaviour (the honest channel status).
