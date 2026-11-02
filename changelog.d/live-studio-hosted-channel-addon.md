## 2026-09-03 · feat(live-studio): the hosted channel is an add-on, not the default

Owner ruling 2026-09-02: the couple's own YouTube link is the DEFAULT for Live
Studio; Setnayan supplying the channel is an OPTIONAL extra for couples without
live-stream access or who aren't versed enough to activate it themselves.

Before this change, every pool-only connect surface (`studio/panood/setup`,
`studio/live-studio-control`, `panood/control/[eventId]`) told EVERY host
"Setnayan now provides the YouTube channel… there is nothing for you to
connect" — true only for the minority who bought the add-on, and for everyone
else a false claim that talked them out of the paste-link box that is their
actual route to air.

- New catalog row `LIVE_STUDIO_HOSTED_CHANNEL` (₱1,500/day, mirrors
  `LIVE_STUDIO`'s shape) — migration `20271192528988`. STACKS on `LIVE_STUDIO`;
  grants no entitlement of its own. Deliberately kept OUT of
  `lib/add-on-stats.ts`'s `ADD_ON_SKU_MAP` (that map also drives
  `resolveAddOnState`'s `'launch'` resolution — adding it there would let
  buying the channel alone unlock the multicam controller nobody paid
  `LIVE_STUDIO`'s price for).
- `lib/live-studio-pool-only.ts` now exposes `poolOnlyConnectNotice(ownsHostedChannel)`
  — the ONE place that decides which of two notices a host sees. All three
  pool-only surfaces now read real hosted-channel ownership via
  `eventSkuActive(...LIVE_STUDIO_HOSTED_CHANNEL_SKU)` and route through it,
  instead of rendering the add-on sentence unconditionally.
- `live-studio-control/page.tsx` gained its own, independent
  `<ChoosePlanSheet>` upsell for the add-on — deliberately NOT folded into the
  `LIVE_STUDIO` plan sheet, since `AddOnStateCta` only renders a plan sheet in
  the `'add'` state; an event that already owns Live Studio would otherwise
  have no way to buy the add-on afterward.
- Guarded by `apps/web/lib/the-hosted-channel-is-an-add-on.test.ts`: pins that
  the pool sentence renders only on the add-on branch, the default branch
  names the paste-link box, and the add-on never enters `ADD_ON_SKU_MAP`.

NOT built (deliberately): any availability/reservation check for the pool
channel. Production holds a small, fixed number of pool channels — sell by
hand and confirm the date until real demand justifies a booking system.

Left open for the owner: whether the "downloadable from your dashboard after
the event" recording promise can be kept when the couple is not the channel
owner (pool-model archive handoff, spec § 4k) — unchanged by this PR,
surfaced, not resolved.

SPEC IMPACT: YES — DECISION_LOG row for the two-tier Live Studio channel model
(own channel default / hosted channel optional, ₱1,500/day add-on), and the
§ 4h assumption that every Live Studio event rides a Setnayan channel is now
false and needs updating.
