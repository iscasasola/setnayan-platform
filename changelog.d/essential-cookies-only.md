## 2026-10-22 · feat(privacy): essential cookies only — PostHog and the cookie banner removed

Owner ruling 2026-10-22 (choice "A"): the cookie banner goes by dropping the
optional analytics behind it, not by hiding the question.

Removed: the PostHog browser SDK and provider (`posthog-provider.tsx`, the
`posthog-js` dependency), the five click counters that lazy-loaded it (Journal
shop link, guest→host CTA, public monogram studio, Life-Flash, the booking
lock), the server-side `captureEvent` (`lib/analytics.ts`, nine call sites in
signup, onboarding, event creation, guest linking, Life-Flash and admin
payments), the WebRTC relay telemetry that rode on it, the cookie-consent
banner and its Manage sheet, `lib/cookie-consent.ts`, the
`/api/cookie-consent` route and its cookie, the profile's "Analytics cookies"
row, the footer and cookie-page "Cookie settings" controls, the admin
funnels' "Open in PostHog" panel, PostHog from the CSP, subprocessor list,
secret-rotation registry, `turbo.json` and `.env.example`.

`/cookies` now lists every cookie the code sets, by name, lifetime and
purpose; `/privacy` says there is no product analytics and drops PostHog as a
subprocessor. Sentry stays (error reporting; it sets no cookie).

Guard: `apps/web/app/_components/essential-cookies-only.test.ts` — no shipped
module imports an analytics/tracking SDK or calls a tracker host, package.json
depends on none, and nothing renders or writes a cookie-consent choice.

`--cookie-banner-top` now has no publisher; its readers in the Event Hub
geometry fall back to `0px` (unchanged behaviour for anyone who had answered
the banner). Removing those readers is a follow-up.

SPEC IMPACT: DECISION_LOG.md row 2026-10-22 "Essential cookies only" (corpus).
