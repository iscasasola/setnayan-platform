import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  GUEST_SESSION_COOKIE_NAME,
  guestPassBookSize,
  readGuestSession,
  type GuestSessionPayload,
} from '@/lib/guest-session';
import { passHeldKind, type PassHopHeld } from '@/lib/guest-pass-hop';
import { findGuestSeatForUser } from '@/lib/guest-membership-session';
import { resolveGuestViewer, resolveReplyIdentity, type GuestViewer, type ReplyIdentity } from '@/lib/guest-one-path';

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
  // `{ eventId }`: this event's pass from the pass book too, when the active one is another
  // event's (one pass per event, 2026-10-12 — lib/guest-pass-book.ts).
  const cookie = await readGuestSession({ eventId });
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
 * 🗳 WHO A REPLY ON THIS EVENT IS SENT AS — the reply page and the save (`submitRsvp`) both ask THIS, so the form a
 * person is shown and the row the Send writes are one answer (`resolveReplyIdentity`, lib/guest-one-path.ts). The pass
 * and the guest seat come from `readGuestViewerForEvent`, unchanged; only when neither answers does a signed-in
 * account's OWN row (the host's — `event_members.guest_id` under any membership, the row live) answer, so a host who
 * reads "Viewing as you" replies as themself. Never a sample, never a set-aside pass.
 */
export async function readReplyIdentityForEvent(eventId: string): Promise<ReplyIdentity> {
  const viewer = await readGuestViewerForEvent(eventId);
  if (viewer.kind !== 'anonymous') return resolveReplyIdentity({ eventId, viewer, signedIn: true, ownRows: [] });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return resolveReplyIdentity({ eventId, viewer, signedIn: false, ownRows: [] });
  return resolveReplyIdentity({ eventId, viewer, signedIn: true, ownRows: await accountOwnRows(eventId, user.id) });
}

/** The account's own live guest rows on one event (any membership), or null when they could not be read. */
async function accountOwnRows(eventId: string, userId: string): Promise<{ guestId: string; qrToken: string }[] | null> {
  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from('event_members')
    .select('guest_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .not('guest_id', 'is', null);
  if (error) {
    console.error('[supabase-error] lib/guest-one-path.server.ts · from:event_members.select (own rows)', error);
    return null;
  }
  const ids = [...new Set((members ?? []).map((m) => m.guest_id as string | null).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  const { data: rows, error: rowsError } = await admin
    .from('guests')
    .select('guest_id, qr_token')
    .eq('event_id', eventId)
    .in('guest_id', ids)
    .is('deleted_at', null);
  if (rowsError) {
    console.error('[supabase-error] lib/guest-one-path.server.ts · from:guests.select (own rows)', rowsError);
    return null;
  }
  return (rows ?? [])
    .filter((r) => typeof r.qr_token === 'string' && r.qr_token)
    .map((r) => ({ guestId: r.guest_id as string, qrToken: r.qr_token as string }));
}

/**
 * What this browser held for an event, as KINDS and a COUNT — never a value: the
 * active pass (`passHeldKind`: none · revoked · this-event · other-event) and how
 * many passes its pass book holds. The Problems log's evidence for a Reply that
 * found no pass (lib/guest-pass-hop.ts `reply:rekey` / `reply:door`).
 */
export async function guestPassEvidence(eventId: string): Promise<{ held: PassHopHeld; bookPasses: number }> {
  const cookiePresent = Boolean((await cookies()).get(GUEST_SESSION_COOKIE_NAME)?.value);
  const held = passHeldKind({ cookiePresent, pass: cookiePresent ? await readGuestSession() : null, eventId });
  return { held, bookPasses: await guestPassBookSize() };
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
