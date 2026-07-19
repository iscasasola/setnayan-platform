import 'server-only';

/**
 * The "No public API endpoints in V1" lock (repo CLAUDE.md · iteration 0033
 * plumbs the gateway only). Narrowed 2026-07-11: the owner blessed the bearer
 * SDK as an ENTERPRISE-VENDOR feature ("api is for enterprise vendor accounts"),
 * so the bearer-key routes (events / events/[id] / guests / me) are NO LONGER
 * gated by this flag — they are enabled and gated instead by the enterprise-tier
 * check in lib/api-auth.ts (userOwnsActiveEnterpriseVendor), which also key-mint
 * gates dashboard/api-keys.
 *
 * This flag now guards ONLY the still-killed routes: the no-auth PUBLIC vendor
 * directory (/api/v1/vendors, /api/v1/vendors/[publicId] — a public browse API,
 * NOT the enterprise integration SDK), the dead /api/v1/reviews (the review form
 * uses a server action), and the V2 /api/v1/manpower/* crew endpoints. All stay
 * DISABLED by default; set PUBLIC_API_ENABLED=true only to bless those.
 *
 * NOT gated (never were the public API): /api/v1/health (liveness probe),
 * /api/v1/admin/site-widgets/* (admin-gated, website editor),
 * /api/v1/billing/initialize-maya (session + event-membership gated, checkout).
 */
export function isPublicApiEnabled(): boolean {
  return process.env.PUBLIC_API_ENABLED === 'true';
}

/** Opaque 404 when the public API is disabled — indistinguishable from a nonexistent route. */
export function publicApiDisabledResponse(): Response {
  return new Response(JSON.stringify({ error: 'not_found' }), {
    status: 404,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
