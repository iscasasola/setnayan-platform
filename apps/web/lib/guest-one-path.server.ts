import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession, type GuestSessionPayload } from '@/lib/guest-session';
import { findGuestSeatForUser } from '@/lib/guest-membership-session';
import { resolveGuestViewer, type GuestViewer } from '@/lib/guest-one-path';

/**
 * guest-one-path.server.ts — the reads behind the guest's one path. The DECISIONS are pure and live in `guest-one-path.ts`; this file only
 * gathers the facts they are asked about.
 */

/**
 * The guest this request speaks for ON THIS EVENT — the browser's cookie when it
 * names this event, else the seat the SIGNED-IN account is bound to.
 *
 * 🔑 WHY A SERVER ACTION NEEDS THE SECOND HALF. A signed-in guest on a new phone
 * now sees their own invitation (the page asks the seat, not only the cookie).
 * If the Save on that page still demanded the cookie, the page would show them a
 * form whose Save bounced them back to where they started — the dead end moved
 * one tap later, not ended.
 *
 * 🔒 NOT A WIDENING. The seat is the account's OWN `event_members` row, scoped
 * by `findGuestSeatForUser` (own user_id, member_type 'guest', not left, seat not
 * removed) — a STRONGER claim than the cookie, which only says "this browser once
 * held the QR". Nothing is minted here.
 */
export async function readGuestSessionForEvent(
  eventId: string,
): Promise<GuestSessionPayload | null> {
  const viewer = await readGuestViewerForEvent(eventId);
  return viewer.kind === 'anonymous' ? null : viewer.session;
}

/**
 * The same answer with its KIND kept — `cookie` (a key was used on this
 * browser) or `seat` (a signed-in account bound to a seat here), or
 * `anonymous`. `/[slug]/find-seat` needs the kind to say "Signed in · Ana"
 * rather than "For Ana"; everything else wants only the session.
 */
export async function readGuestViewerForEvent(eventId: string): Promise<GuestViewer> {
  const cookie = await readGuestSession();
  if (cookie && cookie.event_id === eventId) return resolveGuestViewer({ eventId, cookie, seat: null });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return resolveGuestViewer({ eventId, cookie, seat: null });
  const seat = await findGuestSeatForUser(eventId, user.id);
  return resolveGuestViewer({ eventId, cookie, seat });
}

/**
 * Which account holds this guest's seat, or null. A failed read answers null —
 * the prompt then offers the link, and `sendEventAccountMagicLink`'s connect step
 * refuses to re-bind a seat someone else holds, so the worst case is an offer,
 * never a hijack.
 */
export async function readSeatHolder(eventId: string, guestId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/guest-one-path.server.ts · from:event_members.select', error);
    return null;
  }
  return (data?.user_id as string | null | undefined) ?? null;
}

/*
  📵 `sendKeepLinkOnce` and `keepLinkSentFor` WERE HERE — the reply's Save and
  the account card emailed a passwordless sign-in link. Deleted, not merely
  uncalled (owner 2026-09-29, DECISION_LOG "NO EMAIL TO GUESTS — THE QR AND THE
  LINK DO EVERYTHING"): nothing on a guest's path sends mail. Pinned by
  lib/guest-one-path.test.ts § 2.
*/
