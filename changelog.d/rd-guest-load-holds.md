## 2026-10-13 · fix(guest): the invitation holds through a database stall

A signed-in guest sometimes saw "This invitation didn't load" (~1 in 10 loads).
Postgres was not timing out: the free database stalls 2–5 s (worst 12.8 s)
about 33 times a day, the page's own read deadline (`lib/read-limit.ts`) gave up
inside one, and a signed-in load made ~100 requests in ~10 waves, many of them
the same rows asked again by each render of the visit.

- **A · the error screen tries again for real** — `app/[slug]/error.tsx`.
  "Try again" and ONE automatic retry (2.5 s after the screen appears, at most
  once per page per minute — `lib/invitation-retry.ts`) run `router.refresh()`
  + `reset()` in one transition; a bare `reset()` in Next 15 re-renders the
  failed page the browser already holds, so the old button did nothing. While
  either runs the screen says "Still opening your invitation…". Proven in
  Chromium and WebKit on a page that fails once, then twice.
- **B · fewer requests and fewer waves** — the platform's own settings
  (`bundle_components`, couple `promo_free_windows`, `data_privacy_controls`,
  `reveal_studio_config`, `event_type_profiles`) are remembered across
  requests for 60 s (`lib/global-settings-cache.ts`, `unstable_cache`, one
  tag per table cleared by every admin writer; a refused read is never
  remembered). `event_type_profiles` is read with the service client (the
  table is public-read), not the viewer's session. In a render, every
  per-event ownership fact behind `eventSkuActive` (orders, bundles, comp,
  internal host, founder seat) leaves in one round trip instead of three;
  answers are read in the old order. Harness (warm): 15/5 → 13/3 (stranger),
  19/6 → 17/4 (invited), 23/6 → 21/4 (invited, on the day) requests/deep.
- **C · CSP reports** — one `record_csp_violation` write per block per server
  per 10 minutes, not one per report (`lib/csp-report-once.ts`); 3,778 writes
  on 2026-10-12 came from 12 distinct blocks. The admin note now says the
  counts are "how often, not how many".
- **D · dev servers stop writing to production** — `claimPeriodicJob`,
  `recordFault` and `bumpActionCounts` do nothing unless `NODE_ENV` and
  `VERCEL_ENV` are both `production` (`lib/background-writes.ts`). No key or
  env file changed.

Guards: `lib/invitation-retry.test.ts`, `lib/global-settings-cache.test.ts`,
`lib/guest-page-reads.test.ts` (pins lowered),
`lib/entitlements-in-render-asks-together.test.ts`,
`lib/csp-report-once.test.ts`, `lib/background-writes.test.ts` — each
sabotaged red, then restored green.

SPEC IMPACT: None — no product behaviour, price, word or schema changes. (The
"Browser blocks" admin note gains one sentence about how its counts are kept.)
