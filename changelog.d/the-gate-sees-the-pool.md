## 2026-08-31 · fix(live-studio): the Go live button can finally see the Setnayan channel

**The measurement never reached the render — again, and this time it was the button itself.**

`goLivePanood` has preferred a SETNAYAN POOL channel since Wave 9: it calls
`resolveEventBroadcastToken` and broadcasts on Setnayan's own channel, with BYO kept only as a
fallback. But the button that calls it was gated on `oauth_grants` filtered by `event_id` — the
BYO table, and only that table.

Measured in production on 2026-08-31, the day the pool first held a healthy grant:

```
oauth_grants (BYO, per event)       1 row, 0 live      ← a revoked July grant
live_studio_roam_channel_pool       1 row, verified, available
live_studio_channel_grants (pool)   1 row, health 'ok'
```

So the host was shown **"Connect your YouTube channel first"** — the one instruction Wave 9 exists
to abolish — while a verified Setnayan channel sat available to them and the hidden button would
have worked. `panood_broadcasts` has been 0 forever.

**The fix is wiring, not new logic.** `fetchReadinessFacts` already resolves the pool with the same
preference order the provisioner uses; the new pure `poolRouteToAir` reads its three fields and the
controller ORs it with the BYO grant. `channelNeedsReauth` is a hard no — no token means no
broadcast, and a button that cannot work is what this gate exists to prevent. Fail-honest: a
refused read leaves the pool route false, so the by-hand switch is offered rather than a one-tap
button nobody can prove will work.

**Two false sentences also removed.** `oauthReady` means "the `YOUTUBE_OAUTH_*` env vars resolve",
not "Google's app review cleared" — so the blocked copy stopped promising *"We'll email you the
moment it clears"* about a review that does not exist and an email that could never arrive.

**Sabotage-checked:** reverting the one-line gate to `connected={!!youtubeGrant}` turns the new
source assertion red (6 pass / 1 fail). A test that passes with the bug reintroduced would have
proved nothing.

SPEC IMPACT: None. `Live_Studio_Unified_Spec_2026-07-25.md` § 4h ③ already specifies "goLivePanood
prefers a pool channel, BYO as fallback" — the action always matched the spec; only the gate
disagreed with both.
