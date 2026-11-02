## 2026-10-02 · fix(live-studio): a shared Setnayan channel goes only to an event that holds the hosted-channel add-on

The owner ruled on 2026-09-14 (DECISION_LOG, "SHARED CHANNEL IS OPT-IN AND PRICED") that a shared channel is **never automatic**. The code still handed one out automatically. `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is `"true"` in production (read 2026-10-02), and `checkoutPoolChannel` claimed a pool channel for **any** event that pressed Go live. It was reached through `goLivePanood` → `resolveEventBroadcastToken`, and through `provisionRoamBroadcasts` for the per-camera broadcasts. Nothing checked an entitlement on the way. Prod holds two verified channels that anyone could claim, and none is checked out today, so this change strands nobody.

**The gate:** `eventHoldsHostedChannel(admin, eventId)` in `lib/live-studio-roam-provision.ts`. It uses the existing `eventSkuActive(…, LIVE_STUDIO_HOSTED_CHANNEL_SKU)`, so the admin-approval handshake, comps, promo windows, internal events and founder seats all apply, and no second entitlement system is added. If the read fails, the answer is no. The gate sits at the top of `checkoutPoolChannel`, before any pool read or write. That function is the only way onto the pool, so both callers are covered and a future caller can't skip it. It does not touch `getHeldChannelAccessToken`, so a host can always end a broadcast.

**What everyone else sees:**
- **Go live:** with no channel they get their own-channel path, either their own YouTube grant or the refusal. Under pool-only, "This is on our side — please contact Setnayan" is now shown only to a hosted-channel event. Everyone else gets `OWN_CHANNEL_GO_LIVE_REFUSAL`, which points them at their own broadcast and the watch link.
- **Per-camera provisioning:** returns a new `not_hosted` reason, which shows the host no banner. Before, a host without the add-on would have read "no channel free right now, try again".
- **Readiness:** a new `hostedChannelOwned` fact (the same read the server makes) feeds `poolRouteToAir` and `decideBroadcastReadiness`. A free pool channel no longer counts as a route to air, or as "reserved for your event", for an event without the add-on. Instead the card leads with `OWN_CHANNEL_HEADLINE`.
- **Controller go-live row:** "wait for Setnayan to free one up" is now said only to an add-on owner. Everyone else gets `ownChannelNoRouteNotice(poolOnly)`.
- **Strike warning:** `mayBroadcastOnSharedChannel(ownsHostedChannel)` now follows ownership, the way its old docblock asked it to once the action started checking an entitlement.

No flag changed, no schema change, no new server action.

Tests: new `lib/a-shared-channel-is-never-automatic.test.ts` (10 cases). It drives the real `checkoutPoolChannel`, `resolveEventBroadcastToken`, `provisionRoamBroadcasts` and `eventSkuActive` over a stand-in client that routes by table, and renders the real `BroadcastReadiness` card for an owner and a non-owner. Updated guards: `the-music-can-stop-the-stream`, `live-studio-channel-pool`, `live-studio-route-to-air`, `live-studio-camera-drop-notice`. Each property was broken on purpose once (10 sabotages) and each break turned a test red.

SPEC IMPACT: None
