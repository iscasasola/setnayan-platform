## 2026-07-23 · fix(privacy): scrub guest tokens from analytics + noindex the Papic personal-token page

The decision-free, no-migration slice of open-browse PR5 (privacy hardening,
council verdict 2026-07-22 §3 row 5 parts (d)/(f)) — closes two live
token-exposure holes without touching any gated behavior:

1. **Analytics token scrub.** New pure `lib/analytics-sanitize.ts`
   (`stripSensitiveParams` + `sanitizeAnalyticsProperties`) strips the guest
   bearer/table keys (`invite`, `t`, `g`, `token`) from every PostHog event's
   URL properties (`$current_url`/`$referrer`/initials). Wired into
   `PostHogProvider` two ways: the SDK `sanitize_properties` hook (covers
   autocapture + pageleave + the manual `$pageview`) and at the manual
   `$pageview` source. Never throws — a malformed URL returns unchanged so
   telemetry can't be killed. 9-case unit suite.

2. **Papic personal-token noindex.** `/papic/me/[token]` (the page URL carries
   a guest's `qr_token`) now exports `metadata.robots = { index:false,
   follow:false }`, and `robots.ts` pre-fetch-disallows `/papic/me`. Bare
   `/papic` (marketing) stays crawlable. Sibling token routes
   (`/papic/seat|join|claim|demo/[token]`) share the exposure and are flagged
   for the same treatment in a follow-up.

Not included (this is the isolated slice): the seat-lookup name-echo/rate-limit/
toggle/date-gate, the name-claim OTP flow, the `audience` + `live_media_public`
columns — all need a migration and/or owner decisions and land in the gated
PR5 remainder. The "strip dietary/notes" item (5(d)) was verified a NO-OP —
those columns are already self-scoped to the viewer's own row.

SPEC IMPACT: None — closes live exposures; no schema, no behavior change for
legitimate users.
