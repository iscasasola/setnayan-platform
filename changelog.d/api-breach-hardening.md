## 2026-07-11 · fix(security): resolve the "no public API in V1" breach — gate the /api/v1 SDK OFF by default

Closes the 2026-07-04 kill-or-bless breach (the public `/api/v1/vendors` was no-auth + CORS-open; bearer-key `/api/v1/events|guests|me` served real data despite the standing "No public API endpoints in V1" lock). Resolved lock-aligned (kill by default), reversible without a deploy.

- **New `lib/public-api-flag.ts`** — `isPublicApiEnabled()` (`PUBLIC_API_ENABLED === 'true'`, default **false**). The owner blesses the public API later by setting the env var; no code change needed.
- **Gated 9 routes** to return an opaque 404 when disabled: `/api/v1/vendors`, `/api/v1/vendors/[publicId]`, `/api/v1/events`, `/api/v1/events/[eventId]`, `/api/v1/events/[eventId]/guests`, `/api/v1/me`, `/api/v1/reviews`, `/api/v1/manpower/sync-device`, `/api/v1/manpower/verify-telemetry`. Verified **no first-party code fetches any of them** (the couple-facing vendor browse reads Supabase directly; the review form uses a server action; the manpower endpoints are unwired V2).
- **Stripped `Access-Control-Allow-Origin: '*'`** from both vendor routes — even if later blessed, browser cross-origin scraping is blocked (server-to-server API use is unaffected; CORS is browser-only).
- **NOT gated** (not the public API): `/api/v1/health` (liveness probe), `/api/v1/admin/site-widgets/*` (admin-gated, consumed by the website editor), `/api/v1/billing/initialize-maya` (session + event-membership gated, consumed by checkout).

SPEC IMPACT: Resolves the DECISION_LOG 2026-07-04 kill-or-bless flag — logged as killed-by-default/reversible.
