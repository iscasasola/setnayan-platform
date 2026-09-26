import 'server-only';

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession, type GuestSessionPayload } from '@/lib/guest-session';
import { findGuestSeatForUser } from '@/lib/guest-membership-session';
import { sendEventAccountMagicLink } from '@/lib/event-account-link';
import { INVITE_LINK_SENT_COOKIE } from '@/lib/invite-arrival';
import { resolveGuestViewer, shouldSendKeepLink } from '@/lib/guest-one-path';

/**
 * guest-one-path.server.ts — the reads and the one send behind the guest's one
 * path. The DECISIONS are pure and live in `guest-one-path.ts`; this file only
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
  const cookie = await readGuestSession();
  if (cookie && cookie.event_id === eventId) return cookie;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const seat = await findGuestSeatForUser(eventId, user.id);
  const viewer = resolveGuestViewer({ eventId, cookie, seat });
  return viewer.kind === 'anonymous' ? null : viewer.session;
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

/** Was a keep-link already sent from this browser for this event (last 24h)? */
export async function keepLinkSentFor(eventId: string): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(INVITE_LINK_SENT_COOKIE)?.value === eventId;
}

/**
 * THE ONE SEND. Called by the reply's Save (both the `/{slug}` sheet and the
 * invite arrival's Reply door) and by the one account card — so "form first,
 * then sign up" is one address, one press, on every surface.
 *
 * Returns whether a link went out. Never throws past its caller's redirect: a
 * failed send leaves the reply saved and the card still offering the link.
 */
export async function sendKeepLinkOnce(params: {
  eventId: string;
  guestId: string;
  email: string | null;
  termsAgreed: boolean;
}): Promise<boolean> {
  const { eventId, guestId } = params;
  const email = (params.email ?? '').trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const alreadySent = await keepLinkSentFor(eventId);
  const seatHeld = user || alreadySent ? false : (await readSeatHolder(eventId, guestId)) !== null;
  if (
    !shouldSendKeepLink({
      email,
      termsAgreed: params.termsAgreed,
      signedIn: Boolean(user),
      seatHeld,
      alreadySent,
    })
  ) {
    return false;
  }
  const { ok } = await sendEventAccountMagicLink({
    eventId,
    guestId,
    email,
    termsAgreed: true,
  });
  if (ok) {
    const cookieStore = await cookies();
    cookieStore.set(INVITE_LINK_SENT_COOKIE, eventId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  }
  return ok;
}
