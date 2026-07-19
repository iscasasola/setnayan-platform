## 2026-07-01 · perf(observability): server-render timing on hot vendor pages

Makes the vendor-dashboard latency permanently observable (measurement item #1).

- New `lib/server-timing.ts` — a tiny `ServerTimer` that measures async phases
  (`track`) and emits ONE structured stdout line per render (`flush`):
  `[server-timing] {"route":"...","total_ms":N,"phases":[{"label":"...","ms":N}]}`.
  On Vercel that flows through the Log Drain → Better Stack (iteration 0035),
  giving per-route + per-phase DB timing from real prod traffic — the server-side
  complement to the PostHog Web-Vitals RUM (client TTFB but not WHICH loader).
- Wired into the four hottest server renders: vendor layout (chrome batch),
  Overview (decision-feed + awards), client detail (the post-gate batch), and
  the messages thread (the big batch).

WHY stdout, not a `Server-Timing` header: App Router streams the RSC/HTML
response, so a Server Component can't set response headers after render starts.
The structured log is the framework-correct equivalent.

Contract: instrumentation never changes behavior — `track()` measures in a
`finally` and re-throws untouched; `flush()` swallows its own errors.

Verified: `tsc --noEmit` clean · `next lint` clean · full `next build` succeeds.

SPEC IMPACT: None. Pure observability; no user-facing change.
