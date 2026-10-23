## 2026-10-23 · perf(observability): Sentry Session Replay only on signed-in screens — public pages stop loading the recorder

Owner, 23 Oct: drop Session Replay on PUBLIC pages only (signed-out front door, public Event Hubs, legal / help /
feature pages); keep error reporting everywhere and replay on signed-in screens. Measured that day (SPEED.md cause 2):
every page loaded Sentry + the rrweb recorder at idle — a third of /login's JavaScript.

- `lib/telemetry/replay-scope.ts` — THE RULE: replay inside the signed-in work areas (`/dashboard`, `/vendor-dashboard`,
  `/admin`, `/onboarding`, `/open-shop`, `/site-editor`), nowhere else.
- `app/_components/deferred-observability.tsx` — Sentry initialises WITHOUT the recorder; the recorder
  (`lib/telemetry/sentry-replay.ts`, its own chunk) is fetched and added (`Sentry.addIntegration`, same masking) only
  on a work area — at load, or when a visitor moves into one. Error reporting unchanged on every page.
- Every `import('@sentry/nextjs')` names the exports it uses (`webpackExports`) so no chunk a public page loads carries
  the recorder (`read-limit.ts`, `supabase/error-detect.ts`, `global-error.tsx`, the component itself).
- Measured, production build (`next build && next start`, JS fetched by the page incl. the idle Sentry load):
  `/`, `/login`, `/cale-ice` each **−246 KB of JavaScript (uncompressed)**; the recorder's chunks (443 KB raw) gone
  from all three, still loaded on `/dashboard/people`. Maker first load 494.6 → 494.8 KB (budget 507); shared bundle
  201.9 KB (unchanged).
- Guards: new `lib/telemetry/replay-only-on-signed-in-screens.test.ts` (the rule; init without the recorder; every
  Sentry import names its exports, none the recorder) — sabotaged red twice, restored green.
  `sentry-stays-out-of-the-first-load` re-pointed (the import's magic comment), `maker-tools-are-all-preloaded` gains
  the recorder's reason.

SPEC IMPACT: None.
