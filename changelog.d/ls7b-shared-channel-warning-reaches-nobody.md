## 2026-09-03 · fix(live-studio): the shared-channel warning was rendering to nobody

LS7 (PR #5136, merged this morning) put `POOL_CHANNEL_SHARED_STRIKE_NOTICE` on the
hosted-channel add-on copy, on the premise that **buying the add-on is what puts a
couple on a Setnayan channel.** Measured on `origin/main` today, that premise is
false in two independent ways, and together they meant the warning reached **no
couple at all**.

1. **The add-on is not the route to a shared channel.**
   `app/dashboard/[eventId]/studio/panood/setup/actions.ts` claims a pool channel like
   this — with no entitlement check of any kind:

   ```
   if (liveStudioRoamEnabled()) {
     const pooled = await resolveEventBroadcastToken(createAdminClient(), eventId);
   ```

   Any Live Studio host is routed onto a shared channel whenever the roam flag is on
   (it is, in production) and a channel is free.

2. **The section it lived in renders nothing.** LS6 deactivated
   `LIVE_STUDIO_HOSTED_CHANNEL` the same day (price pairing broke, migration
   `20271194920190`), and `HostedChannelUpsell` opens with
   `if (!owns && !onSale) return null`.

🔑 **THE GUARD STAYED GREEN THROUGH ALL OF IT.** A source-scanning guard reads the
text, and the text was intact — the pixel was not. This is the same disease LS7's own
notice was written against: *the measurement never reached the render.* A guard that
pins a constant into a file cannot see a `return null` above it.

- `mayBroadcastOnSharedChannel()` (`lib/live-studio-pool-only.ts`) — **the same
  predicate the go-live action uses**, deliberately one function rather than a boolean
  copied into the copy and the behaviour. Same reason `poolRouteToAir` is one function.
  Broader than "is on a pool channel right now" on purpose: a couple picks the
  processional weeks before a channel is checked out, so the honest planning-time
  question is *may* this happen. Over-warning costs a paragraph; under-warning costs
  somebody else's wedding film.
- The warning now renders in the **"Your YouTube channel"** panel on both pre-day
  surfaces — `live-studio-control` and `panood/setup` — above/around the branch, so it
  shows in every channel state rather than one. The add-on copy keeps its copy too, for
  when the SKU is reactivated.

### …and the same defect one level up, found by checking rather than assuming

The setup page picks between **four** connect states, and the fix first went inside
`ConnectCTA` — one of them. A host who had **already connected their own channel**
rendered `ConnectedPanel` and saw nothing. That host is not safe: the go-live action
resolves a **pool token first** and only then falls back to their BYO grant, so a
connected host lands on a shared channel just as easily. The warning now sits outside
the branch — one mount, every host — and is pinned **by absence from the arms**,
because a presence check on the page cannot tell *"rendered for everyone"* from
*"rendered for a quarter of hosts"*.

**Guard:** four tests added to `lib/the-music-can-stop-the-stream.test.ts` — the
warning renders on a surface *not* gated on the add-on; it sits outside the
connect-state branch rather than in one arm; the copy predicate and the
action predicate are the same flag (so if pool checkout ever *does* become
entitlement-gated, the test fails and the copy moves with it); and the predicate is a
real flag read, not a hardcoded `true`.

⏭ **OWNER QUESTIONS — surfaced, not answered:**
1. **The copy and the action disagree about who holds the channel.**
   `POOL_ONLY_DEFAULT_NOTICE` tells a non-add-on host *"start your own broadcast…
   paste the watch link"* while `resolveEventBroadcastToken` may silently put that same
   host on a Setnayan pool channel. Which is intended?
2. **Should `LIVE_STUDIO_HOSTED_CHANNEL` be reactivated** (it needs a replacement price
   from LS6), or retired — given the pool route does not actually require it?
3. Still open from LS7: **one-couple-per-channel-forever vs reuse.**

SPEC IMPACT: `DECISION_LOG.md` row correcting LS7's buyer-targeting premise.
