// ============================================================================
// PR6 · Three-tier public-URL cutover (slug-routing program, 2026-07).
//
// The canonical public URL for an event moves from the legacy BARE ROOT
// `setnayan.com/{slug}` to the NESTED account form `setnayan.com/u/{ownerSlug}/{slug}`.
// This module is the SINGLE place that decides which form a URL takes, so every
// QR / link / share / canonical agrees.
//
// Flag-gated, default OFF. While OFF (today), every helper returns the legacy
// bare path byte-for-byte and no owner-slug lookup runs — the whole cutover is
// INERT until the owner flips `NEXT_PUBLIC_U_NESTING_CUTOVER=true` after a prod
// bake. While ON, new URLs emit the nested form and old bare-root URLs (printed
// QRs) keep resolving + 307-redirect to the nested URL (see app/[slug]/page.tsx).
//
// GRACEFUL BY CONSTRUCTION: a missing / unresolvable ownerSlug ALWAYS degrades
// to the bare path, which still renders (and, under the flag, the dispatcher
// canonicalizes it). So a call site that can't resolve the owner never emits a
// broken URL — only a slightly-less-pretty one that redirects.
//
// Kept PURE (no runtime server imports — the Supabase import is type-only) so
// the path/flag helpers are safe to import from client components too. The DB
// resolvers take an injected admin client rather than constructing one.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The cutover flag. OFF (default) → legacy bare-root `/{slug}` everywhere.
 * ON → nested `/u/{ownerSlug}/{slug}` canonical form. NEXT_PUBLIC_ so a future
 * client-side share widget can read it too; every consumer today is server-side.
 */
export function isUserNestingCutoverEnabled(): boolean {
  return process.env.NEXT_PUBLIC_U_NESTING_CUTOVER === 'true';
}

/**
 * The public PATH (leading slash, no origin) for an event landing page.
 *   • cutover ON  + ownerSlug known → `/u/{ownerSlug}/{slug}`
 *   • cutover OFF or ownerSlug null → `/{slug}` (legacy bare root)
 */
export function publicEventPath(slug: string, ownerSlug?: string | null): string {
  const owner = ownerSlug?.trim();
  if (owner && isUserNestingCutoverEnabled()) {
    return `/u/${owner}/${slug}`;
  }
  return `/${slug}`;
}

/** Full public URL (origin + path) for an event landing page. */
export function publicEventUrl(
  appUrl: string,
  slug: string,
  ownerSlug?: string | null,
): string {
  return `${appUrl}${publicEventPath(slug, ownerSlug)}`;
}

/**
 * Resolve an event's OWNER account slug — the `member_type='couple'` member's
 * `users.slug`, which is the `{ownerSlug}` segment of the nested public URL.
 *
 * Returns null when: the flag is OFF (no query runs — cost-free pre-cutover),
 * there is no couple member, or that account has no slug. Every null path
 * degrades the URL helpers above to the bare root.
 *
 * MUST be called with an ADMIN / service client: ownership is an event-level
 * fact and the public dispatcher runs for anonymous visitors (no RLS session);
 * a co-host viewer under RLS may not be able to read the couple's rows.
 */
export async function resolveEventOwnerSlug(
  admin: SupabaseClient,
  eventId: string,
): Promise<string | null> {
  if (!isUserNestingCutoverEnabled()) return null;

  const { data: member } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple')
    // Deterministic tie-break: an event SHOULD have exactly one couple member
    // (verified 1:1 in prod), but the schema permits more (co-organizers). Order
    // by user_id so the owner segment of the nested URL — and thus every QR /
    // canonical / redirect derived from it — never drifts between renders.
    .order('user_id', { ascending: true })
    .limit(1)
    .maybeSingle();
  const ownerId = (member as { user_id?: string } | null)?.user_id;
  if (!ownerId) return null;

  const { data: owner } = await admin
    .from('users')
    .select('slug')
    .eq('user_id', ownerId)
    .maybeSingle();
  return (owner as { slug?: string | null } | null)?.slug?.trim() || null;
}

/**
 * Wire the long-dormant `slug_change_log` read: given a bare slug that maps to
 * NO current event, check whether it is a PRIOR slug of one (updateEventSlug
 * logs every old→new rename) and, if so, return the event's CURRENT canonical
 * PATH to redirect to. Returns null when there is no live redirect row, the
 * event was deleted, or the old slug already equals the current slug.
 *
 * Resolving via the change row's `entity_id` → the event's CURRENT slug (rather
 * than the stored `new_slug`) makes this robust to chained renames and to the
 * stored new_slug shape, and lets it emit the nested `/u/` form post-cutover.
 * Admin client required (RLS on slug_change_log is admin-read only).
 */
export async function resolveRenamedEventPath(
  admin: SupabaseClient,
  oldSlug: string,
): Promise<string | null> {
  // Flag-gated so the whole cutover stays INERT (zero added queries, zero
  // behaviour change) while OFF — the pre-existing rename-404 is fixed as part
  // of the cutover, not as a separate always-on change. Mirrors
  // resolveEventOwnerSlug's self-noop.
  if (!isUserNestingCutoverEnabled()) return null;

  // Exact, lowercase match (stored old_slug is always ^[a-z0-9-]{3,32}$): .eq —
  // not .ilike — so a crafted URL segment with a % or _ can't act as a SQL LIKE
  // wildcard and spuriously match a rename row.
  const { data: row } = await admin
    .from('slug_change_log')
    .select('entity_id')
    .eq('entity_type', 'event')
    .eq('old_slug', oldSlug.toLowerCase())
    .gt('redirect_until', new Date().toISOString())
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const entityId = (row as { entity_id?: string } | null)?.entity_id;
  if (!entityId) return null;

  const { data: ev } = await admin
    .from('events')
    .select('event_id, slug')
    .eq('event_id', entityId)
    .maybeSingle();
  const event = ev as { event_id: string; slug: string | null } | null;
  const currentSlug = event?.slug?.trim();
  if (!event || !currentSlug) return null;
  // The current slug matching the queried old slug can't happen on the miss path
  // (fetchEventBySlug would have matched it) — defensive guard against a redirect
  // loop onto the same URL.
  if (currentSlug.toLowerCase() === oldSlug.toLowerCase()) return null;

  const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);
  return publicEventPath(currentSlug, ownerSlug);
}
