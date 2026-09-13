## 2026-09-01 · fix(live-studio): a dark camera closes the guest signaling channel

`live_studio_guest_rtc_can_access` clause (c) admitted ANY signed-in visitor to
`panood-guest:{eventId}` on the strength of two pieces of stored state — a
`live_studio_roam_zones` row saying `'live'` with a seat bound. Nothing ever unwrote
either one. Its own migration (20271006520000) promised the opposite: *"the live-zone
test means a dormant or finished event has no joinable topic at all."*

The reason it did not hold is structural. `panood_camera_heartbeat`'s demotion sweep is
CRON-FREE by design — one live camera reports its dead neighbours — so when the LAST
camera on an event leaves there is no next heartbeat, and nothing ever demotes the final
seat or its zone. A finished wedding keeps a row saying `'live'` forever.

**Measured in production (not argued from source), 2026-09-01**, as a uid that is not a
member, not a moderator and not a camera operator on the event:

```sql
select set_config('request.jwt.claims','{"sub":"<that uid>","role":"authenticated"}',true),
       public.live_studio_guest_rtc_can_access('panood-guest:<event>');   -- → TRUE
```

on an event whose only `'live'` zone was bound to a seat last seen **13,843 seconds**
earlier (230× the 60s window), whose `live_studio_roam_manifest` was empty, and which has
never had a `panood_broadcasts` row. A second event with no live zone returned FALSE in
the same statement, so the predicate was being exercised — not "true for everything".

**The change is ONE condition**, migration `20271188365061`: the seat bound to the live
zone must have beaten inside `INTERVAL '60 seconds'` — the same window as
`CHANNEL_STALE_MS` and as the RPC's own sweep. `resolveChannelStatus` has applied exactly
this rule on the READ side since Wave 4; this moves it to where a stranger's admission is
decided.

**Deliberately NOT four conditions.** The first cut also required the seat to be claimed
and un-revoked. `tests/db/live-studio-guest-pick-authz.db.test.ts` records why that is
wrong, in its own words — *"a person whose camera was revoked is still a person who may
watch the wedding"* — and that filter already lives in ONE place, `fetchGuestPickCameras`,
the roster this feature's enforced-by-omission containment is built on. Freshness reaches
the same place without a second forkable copy: `panood_camera_heartbeat` REFUSES a
reissued or revoked token, so the stamp freezes and crosses the window on its own. The new
test proves that through the real RPC rather than assuming it.

New guard `apps/web/tests/db/a-dark-camera-closes-the-guest-channel.db.test.ts` (10 tests):
non-vacuity first, the last-camera-to-leave case at the production number, the 60s window
pinned at 59s/61s, a never-beat NULL, reissue and revoke going dark through the RPC, the
control room reachable in every dark state, and the host's switch still gating. Mutation:
deleting the freshness clause turns 4 of 10 red; the `claimer_user_id` clause was
measured, found to duplicate the roster, and removed rather than shipped.

The existing `live-studio-guest-pick-authz.db.test.ts` fixture now stamps `last_seen_at`,
because "live" means beating — without it that file modelled a camera that had gone dark
and its arm-(c) assertions would have been vacuous. All 14 of its tests still pass,
including the revoked-operator-is-still-a-spectator one.

**Left undone, flagged not smuggled in:** `fetchGuestPickCameras` still offers a guest a
camera whose phone left hours ago — the same defect on the read side, but a change to what
guests are SHOWN rather than what they may open. Separate PR.

SPEC IMPACT: None. No decision changes — this delivers the promise
`Live_Studio_Unified_Spec` / migration 20271006520000 already made, and preserves the
2026-07-26 ₱0 guest-pick decision and the entitlement's single home in
`canPublishMultiCam`.
