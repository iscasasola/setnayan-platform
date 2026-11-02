## 2026-10-16 · feat(perf): the load-time log — real people's load times, and a Slow loads tab

Owner: *"can we make a page on admin that will log the loading time of each load done? or when a loading
takes more that 1.5 seconds to load then it will be logged or when it load longer than its target loading
time?"* Wires the App Performance plan's "Later · p95 wiring · web-vitals RUM" row.

- **Measured in the browser, at idle, in its own chunk** (`lib/telemetry/load-reporter.ts`, loaded by
  `deferred-observability.tsx` beside the Problems observer): full page loads (Navigation Timing, LCP) and
  in-app taps (the real `pointerdown` → the paint after the route's skeleton is gone and its RSC answer has
  arrived — the event-open speed work's measure). Each view also carries its slowest interaction and
  longest task. Sent by `sendBeacon` through the ONE ingest door (`/api/telemetry/client-fault`, a third
  body shape `{ loads }`): every load ≥ 1 s, ~1 in 10 faster ones (weight 10, so p50/p95 stay honest).
- **Stored** in `app_load_timings` (migration `20271270180398`): route PATTERN only (ids blanked in the
  browser, matched to the app's route list at the ingest, refused by the table's CHECK otherwise), device
  class, connection type, build SHA, signed-in flag; no personal data. RLS on, no grant to any browser role;
  written only by `record_load_timings` (service role), which trims rows older than 30 days.
- **Targets**: 1.5 s default; per-page override in `platform_settings.load_time_targets`, edited on the new
  **Slow loads** tab (desktop only — the phone answers, it does not edit). Slow = over the page's CURRENT target.
- **Admin**: new App Performance tab "Slow loads" (newest slow loads with server / download / drawing
  breakdown, device, build, when; every page's target, p50, p95, % over target, trend since the last
  build). The overview's "API speed (p95)" and "Web Vitals (p75)" needs-wiring cards are now live,
  honest-empty below `MIN_N`.
- Guards: `lib/telemetry/the-load-time-log.test.ts`, `tests/db/the-load-time-log.db.test.ts`.
- Exposure baseline +1 line, deliberate: `platform_settings.load_time_targets` readable by `authenticated`
  (page names and milliseconds), as every platform_settings column is.

SPEC IMPACT: `0023_admin_console/App_Performance_Plan_2026-07-03.md` §5 "Later" — p95 wiring and web-vitals
RUM are now built (Slow loads tab + two live Stability cards); DECISION_LOG row 2026-10-16.
