import 'server-only';

/**
 * The "No public API endpoints in V1" lock (repo CLAUDE.md · iteration 0033
 * plumbs the gateway only). Resolves the 2026-07-04 kill-or-bless breach: the
 * /api/v1 SDK — the no-auth public vendor browse, the bearer-key events/guests/
 * me endpoints, /api/v1/reviews, and the V2 manpower endpoints — is DISABLED by
 * default. Default-OFF = killed (lock-aligned); reversible without a deploy when
 * the owner blesses it by setting PUBLIC_API_ENABLED=true.
 *
 * Verified 2026-07-11: NO first-party code fetches any of these routes (the
 * couple-facing vendor browse reads Supabase directly; the review form uses a
 * server action). NOT gated (they are not the public API): /api/v1/health
 * (liveness probe), /api/v1/admin/site-widgets/* (admin-gated, consumed by the
 * website editor), /api/v1/billing/initialize-maya (session + event-membership
 * gated, consumed by checkout).
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
