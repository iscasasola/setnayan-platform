## 2026-07-02 · perf(homepage): edge-cache the homepage (ISR) — drop force-dynamic

The final homepage load-delay fix from the 2026-07-02 sweep. After the region pin
(#2566) took TTFB from ~2s to ~0.5s, the homepage was still `force-dynamic` /
`no-store` — every visit invoked a function, causing cold-start spikes (~1.7s
outliers). This makes it edge-cacheable (ISR, `revalidate = 300`) → consistent
~100ms and no cold starts.

Removing `force-dynamic` alone was a no-op: two things forced every route dynamic.
Both are now resolved:

- **`getClientShell()` (headers/cookies) moved client-side.** OAuth-button
  visibility for the Sign-in overlay is now computed in `HomeOverlays`
  (`detectSignInOAuth`, a client-side mirror of `getClientShell`). The overlay is
  already `ssr:false`, so it reads `navigator.userAgent` + the client-type cookie
  directly. `page.tsx` no longer reads request headers.
- **`DemoModeBanner` stopped reading `cookies()` during SSR.** It was a root-layout
  server component calling `cookies()` + `auth.getUser()` on every render. It's now
  a CLIENT component that reads a new non-httpOnly presence-hint cookie
  (`setnayan_demo_mode_hint`, set in lockstep with the httpOnly cookie in
  `setDemoModeCookie`) and, only when present, fetches the new
  `/api/demo-mode/status` route where the authoritative httpOnly-cookie + admin
  check stays server-side. Normal visitors make zero extra requests.

Build-safety: every homepage data read already degrades to a fallback ([]/null)
when the service-role key is absent (`fetchV2CustomerCatalog` /
`fetchV2VendorCatalog` / `fetchPublishedBackgroundVideos` / `fetchHomepageSpotlight`
all try/catch), so the build-time ISR prerender does not throw. The `after()` admin
digest flush still fires on each revalidation render.

Known behavior change: admin catalog **price edits now propagate to the homepage
within the 5-min revalidate window** instead of instantly (it was per-request
before). Follow-up option: call `revalidatePath('/')` from the admin catalog-edit
actions for instant propagation.

⚠️ AUTO-MERGE INTENTIONALLY OFF — verify on the Vercel preview before merging:
(1) Sign-in overlay shows Google/OAuth on web; (2) demo banner still appears for an
admin in demo mode and never for non-admins; (3) homepage returns
`x-vercel-cache: HIT` after warm-up.

SPEC IMPACT: None (perf/infra — no product behavior, pricing, or schema change;
demo-mode + OAuth visibility semantics preserved).
