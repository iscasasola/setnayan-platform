## 2026-07-01 · perf(vendor-dashboard): cut vendor shell latency + stop full re-reads on inline actions

The vendor dashboard felt slow to open and re-loaded the whole screen whenever
the vendor acted on a card (Accept/Decline inquiry, acknowledge deposit). Root
causes and fixes:

- **Blocking write RPC removed from the render path.** `layout.tsx` awaited
  `evaluate_earned_token_expiry` (a token-expiry sweep) inline before first
  paint — on every hard load AND every Server-Action-triggered re-render of the
  dynamic layout. Moved to `after()` (post-response, same cron-free pattern as
  the login ghosting check). Trade-off: the sidebar token pill can be one load
  stale after an expiry — accepted by owner 2026-07-01.
- **Request-level dedup.** `fetchOwnVendorProfile` (`lib/vendor-profile.ts`,
  up to 3 queries) and `resolveVendorRole` (`lib/vendor-role.ts`) are now
  wrapped in React `cache()`. The layout and the page it renders both called
  these in the same request; since the server `createClient()` is already
  request-cached, both call sites share one client reference, so the calls now
  collapse to a single set of reads instead of running twice.
- **Layout waterfall flattened.** `getNavSlotMap()` moved from a sequential
  call near the bottom of the layout into the main `Promise.all` batch.
- **Overview page parallelized.** role+profile resolve together; the decision
  feed (`fetchVendorOverviewData`) and Spotlight Award banner
  (`fetchVendorCurrentAwards`, fail-soft to `[]`) now run in parallel instead
  of as a 4-step waterfall.

SPEC IMPACT: None. Behavior-preserving perf work; the only user-visible change
is the accepted one-load staleness of the sidebar token pill after an expiry.
