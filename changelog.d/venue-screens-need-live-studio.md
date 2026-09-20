## 2026-09-20 · fix(live-studio): venue screens come with Live Studio, not for free

Owner ruling, 2026-09-20 (asked whether venue screens should stay free or become a paid
perk): *"live studio is paid… depends on their live studio."* Screens are bundled into the
SAME ₱2,500 unlock (`lib/live-studio-window.ts`) — no second charge, no second flag. Before
this fix `screens-actions.ts`'s `gate()` checked only `isLiveStudioSetupHost` (who may run
the controller), never whether the event had actually paid for Live Studio — every couple
could add, pair and drive venue screens for free, on any event, entitled or not (PR #5723,
DAY-12, merged).

- `lib/live-screens.ts` gains the one pure decision, `canUseVenueScreens({ liveStudioActive })`,
  plus the locked-state copy (`VENUE_SCREENS_LOCKED_MESSAGE`, `VENUE_SCREEN_LOCKED_TV_MESSAGE`).
  `liveStudioActive` is resolved the SAME way broadcasting already is —
  `resolveBroadcastWindow(supabase, eventId).multiCam` — so this can never disagree with the
  controller's own "Unlock · price" bar.
- `app/panood/control/[eventId]/screens-actions.ts`'s `gate()` now also runs that check, on
  the admin client (the same reason `page.tsx` reads entitlement on the admin client: `orders`
  RLS is purchaser-scoped, and a coordinator/moderator running the controller for a couple who
  paid is not the purchaser). Every write refuses on a locked event — `addLiveScreen`,
  `setLiveScreenMode`, `setAllLiveScreensMode`, `renameLiveScreen`, `reissueLiveScreenCode`.
  `removeLiveScreen` is the one documented exception: cleanup stays allowed.
- `app/live/actions.ts`'s `pairLiveScreen` refuses to claim a code for a locked event
  (`error=locked`, new copy on `/live`).
- `app/live/_lib/load-screen.ts`'s `loadLiveScreen` re-checks entitlement on EVERY poll, not
  only at pair time — a comp grant revoked or an order refunded mid-event must still take the
  screen dark. Adds a `locked` state, checked before the `events` read that would otherwise
  produce the screen's picture.
- `app/live/screen/screen-stage.tsx` renders `locked` as a neutral black card
  ("Live Studio isn't active for this event"), and — unlike the existing `down` (refused read)
  state — never falls through to the last good picture: a locked screen goes dark, it does not
  keep showing the event's content from before it was locked. Polling continues underneath, so
  the TV recovers on its own the moment the event unlocks.
- `_components/venue-screens-section.tsx`: locked, the section shows "Venue screens come with
  Live Studio" and the controller's EXISTING unlock CTA (`detailHref` + `lock.unlockCtaLabel`)
  — no second purchase path. Existing screens stay listed with Remove only.

Guarded by `app/panood/control/[eventId]/venue-screens-need-live-studio.test.ts` (7 tests) plus
one new case in `lib/live-screens.test.ts`. Sabotage run by hand: short-circuiting the gate's
check to `if (false && !canUseVenueScreens(...))` kept every earlier assertion green (the call
was still present in source) until the test was anchored on `if (!canUseVenueScreens(` exactly
— that version now catches it.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 row recording the owner's ruling.
