## 2026-09-01 · fix(live-studio): a dark camera leaves the guest roster

The read-side half of #5068. That PR stopped a stranger OPENING the guest signaling
channel on an event whose cameras had gone home; this one stops a guest being SHOWN
those cameras in the first place.

`fetchGuestPickCameras` filtered a zone's bound seat on `revoked_at` / `status` /
`claimer_user_id` and never asked whether the phone was still there — it did not even
project `last_seen_at`. A zone's `status = 'live'` is the last transition anyone
OBSERVED, and the one transition nobody observes is a phone leaving: a browser closed,
backgrounded past execution, or carried out of signal sends no goodbye. Nor does anything
clean up after it — `panood_camera_heartbeat`'s demotion sweep is deliberately CRON-FREE
(one live camera reports its dead neighbours), so when the LAST camera on an event leaves
there is no next heartbeat and nothing ever demotes the seat or its zone.

**Measured in production 2026-09-01:** event "Cale & Ice" carried a zone reading `'live'`
bound to a claimed, un-revoked seat whose `last_seen_at` was **13,843 seconds** old — 230×
the staleness window. The roster offered that camera. The function's own comment says what
a guest then gets: *"a pill that spins forever"*.

**The rule is not re-derived.** The loop now calls `resolveChannelStatus`
(`lib/live-studio-channel-cameras.ts`) — the same function the controller has used for its
own honest status since Wave 4, whose docblock already named this exact leak. It also
answers "is the seat claimed?", so the `claimer_user_id` test that used to sit inline is
folded into it rather than written twice. One rule, two surfaces, and the same 60s window
migration `20271188365061` put on the signaling predicate — so a guest is never offered a
camera whose channel they could not open. `status` is now projected on the zone read
because it is that function's first input.

**The projection is part of the rule, and it fails quietly.** Drop `last_seen_at` from the
select and every stamp arrives `undefined`, which `resolveChannelStatus` reads as "never
beat" — the roster goes permanently EMPTY, which looks exactly like a wedding with no side
cameras. No behavioural test can tell those apart, so
`lib/live-studio-guest-pick-roster.test.ts` asserts the column is actually requested.

New test file, 11 tests, non-vacuity asserted first (a beating camera IS offered): the
production case at 13,843s, the window pinned to `CHANNEL_STALE_MS` from the constant
rather than a literal, a null and an unparseable stamp, the projection, revoked/unclaimed/
unbound/orphan seats still withheld, a host-disabled zone refused by the shared rule rather
than by the query's own `WHERE`, and a mixed three-camera wedding offering exactly the one
that is running.

Mutation: reverting the loop to the old claimed-only filter (`resolveChannelStatus` call
sites 1 → 0) turns **6 of 11** red; dropping `last_seen_at` from the projection (1 → 0)
turns **4 of 11** red, including the non-vacuity test — which is the silent-empty failure
mode, caught.

SPEC IMPACT: None. No decision changes. The ₱3,000 entitlement stays where it is
(`canPublishMultiCam`, asked once in the public-page loader); the enforced-by-omission
posture is unchanged — this makes the omission honest.
