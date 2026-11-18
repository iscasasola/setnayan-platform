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
import { envFlagEnabled } from '@/lib/env-flag';
import { isUsernameWord, nestableEventSlug } from '@/lib/u-nesting';

/**
 * The cutover flag. OFF (default) → legacy bare-root `/{slug}` everywhere.
 * ON → nested `/u/{ownerSlug}/{slug}` canonical form. NEXT_PUBLIC_ so a future
 * client-side share widget can read it too; every consumer today is server-side.
 */
export function isUserNestingCutoverEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_U_NESTING_CUTOVER);
}

/**
 * The public PATH (leading slash, no origin) for an event landing page.
 *   • cutover ON  + ownerSlug known → `/{ownerSlug}/{slug}` (the address move, 2026-11-15 — was `/u/{ownerSlug}/{slug}`)
 *   • cutover OFF or ownerSlug null → `/{slug}` (legacy bare root)
 */
export function publicEventPath(slug: string | null | undefined, ownerSlug?: string | null): string {
  // A missing slug reads exactly as the hand-typed `/${slug}` it replaced did — callers already guard it.
  if (!slug) return `/${slug ?? ''}`;
  const owner = ownerSlug?.trim();
  // 🔗 THE ADDRESS MOVE (owner 2026-11-15): `/{username}/{event}` — no `/u/`. An event whose own word is one of an
  // event's / shop's page words keeps the bare address (`nestableEventSlug`): its nested form could never be told
  // apart from that page.
  if (owner && isUserNestingCutoverEnabled() && nestableEventSlug(slug)) {
    return `/${owner}/${slug}`;
  }
  return `/${slug}`;
}

/**
 * 🔗 THE ADDRESS MOVE (owner 2026-11-15): a person's public page is `/{username}` while the cutover is on, and
 * `/u/{username}` before it (which then 308s). The account public-id form (`/u/S89U-…`) always keeps `/u/`.
 */
export function personPath(handle: string): string {
  return isUserNestingCutoverEnabled() && isUsernameWord(handle) ? `/${handle}` : `/u/${handle}`;
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
 * Resolve an event's OWNER account slug — its CREATOR's `users.slug` (`events.created_by_user_id`), else the
 * `member_type='couple'` member's, which is the `{ownerSlug}` segment of the nested public URL.
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

  // 🔗 THE CREATOR'S USERNAME (owner 2026-11-15: "an event's address uses the CREATOR's username"). The column is set
  // by the database when the event gets its first couple member, and backfilled once for older events from the same
  // lowest-user_id tie-break below — so an address never moves because of it. Older rows without it fall through.
  // A failed read answers null (the bare address), never a guess: falling through to the couple-member tie-break
  // after an error could name a DIFFERENT owner than the creator, and every QR / redirect built from it would carry it.
  const { data: ev, error: evErr } = await admin.from('events').select('created_by_user_id').eq('event_id', eventId).maybeSingle();
  if (evErr) return null;
  const creatorId = (ev as { created_by_user_id?: string | null } | null)?.created_by_user_id ?? null;
  if (creatorId) {
    const { data: creator, error: creatorErr } = await admin.from('users').select('slug').eq('user_id', creatorId).maybeSingle();
    if (creatorErr) return null;
    const creatorSlug = (creator as { slug?: string | null } | null)?.slug?.trim();
    if (creatorSlug) return creatorSlug;
  }

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

// ⚠ `resolveRenamedEventPath` USED TO LIVE HERE, AND ITS FIRST LINE WAS
// `if (!isUserNestingCutoverEnabled()) return null;`.
//
// Forwarding a retired address is NOT part of this cutover — it is a promise
// printed on the couple's address field and the person's handle field, and
// tying it to a flag that has never been on meant the promise was never once
// kept. It moved to `lib/slug-forwarding.ts` as `resolveRenamedPath`, ungated,
// covering events, shops AND people. Nothing else in this module changed: the
// `/u/` nesting cutover stays flag-dark exactly as before.

/**
 * 🔗 THE ADDRESS MOVE — where an OLD sub-page link goes (`app/[slug]/layout.tsx`). `/{event}/{page}[?query]` →
 * `/{username}/{event}/{page}[?query]` while the cutover is on and the event's creator has a username; null when
 * there is nothing to forward (the bare page itself, the internal cached copy, no username, the switch off).
 */
export function oldSubPageTarget(requestPath: string | null, slug: string, ownerSlug: string | null): string | null {
  if (!requestPath || !ownerSlug) return null;
  const q = requestPath.indexOf('?');
  const path = q === -1 ? requestPath : requestPath.slice(0, q);
  const query = q === -1 ? '' : requestPath.slice(q);
  const prefix = `/${slug}/`.toLowerCase();
  if (!path.toLowerCase().startsWith(prefix)) return null;
  const rest = path.slice(prefix.length).replace(/\/+$/, '');
  if (!rest || rest.split('/')[0] === 'cached') return null;
  const base = publicEventPath(slug, ownerSlug);
  if (base === `/${slug}`) return null;
  return `${base}/${rest}${query}`;
}
