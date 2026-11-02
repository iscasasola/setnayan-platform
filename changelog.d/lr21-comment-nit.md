## 2026-09-18 · fix(observability): correct the Sentry-path comment on 3 client error boundaries

`app/[slug]/error.tsx`, `app/error.tsx`, and `app/vendor-dashboard/error.tsx` each
named `instrumentation.ts` as the mechanism that captures their errors. All three
are Client Components (a Next.js error-boundary requirement, stated in their own
comments), and `instrumentation.ts` only wires server-side Sentry
(`sentry.server.config.ts` + `sentry.edge.config.ts`) — it never runs in the
browser. The browser path is `app/_components/deferred-observability.tsx`, which
lazy-loads the Sentry browser SDK post-hydration (see its own docblock and
`providers.tsx`, both already accurate about this split — untouched here).
Comment-only; no behavior change.

SPEC IMPACT: None.
