import { timingSafeEqual } from 'node:crypto';

/**
 * webhook-secret-auth.ts — shared-secret check for unauthenticated inbound
 * webhooks (`/api/notify`, the Supabase DB-trigger → Next webhook path).
 *
 * FAIL POLICY (fixed 2026-07-09 — was fail-OPEN): when the configured secret is
 * MISSING the request is REJECTED. The previous behavior accepted every request
 * unauthenticated whenever `NOTIFY_WEBHOOK_SECRET` was unset "so a fresh deploy
 * doesn't silently break push" — which meant one missing env var silently
 * turned an internet-facing endpoint that reads DB rows + fires push sends into
 * an open relay. Fail CLOSED is the only safe default for an unauthenticated
 * route; a fresh deploy now loses webhook pushes (loudly, via console.error)
 * until the owner sets the secret in Vercel + the Supabase webhook config,
 * instead of quietly accepting unauthenticated traffic.
 *
 * Pure + framework-free so it can be unit-tested (node:test) — the route
 * adapter in app/api/notify/route.ts just feeds it the header + env values.
 * timingSafeEqual requires equal-length buffers, so the length check is folded
 * in via a boolean AND — the provided header is never leaked by timing.
 */
export function webhookSecretAuthorized(
  providedHeader: string | null | undefined,
  configuredSecret: string | null | undefined,
): boolean {
  if (!configuredSecret) return false; // fail CLOSED — never accept unauthenticated
  const a = Buffer.from(providedHeader ?? '');
  const b = Buffer.from(configuredSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}
