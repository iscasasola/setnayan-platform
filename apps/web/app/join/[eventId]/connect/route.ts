import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { connectEventForUser, findSeatToConnect } from '@/lib/event-account-link';
import { CONNECT_THEN_REPLY, connectQuery, inviteReplyPath } from '@/lib/invite-arrival';
import { readGuestSession } from '@/lib/guest-session';
import { emailMayBindRow } from '@/lib/guest-requests';

/**
 * Post-magic-link destination (Invite/Join v2). The email sign-in link lands on
 * /auth/callback (PKCE exchange) → here, now authenticated. We connect the event
 * to this account (cookie path or email-match), then drop them into the event.
 *
 * 🔴 **AND FOR AS LONG AS IT HAS EXISTED, SUCCEEDING SENT THEM TO A 404.**
 * `connectEventForUser` writes `member_type: 'guest'`, and this route then
 * redirected to `/dashboard/{eventId}` — a layout that admits
 * `member_type = 'couple'` ONLY. So the better the connect went, the worse the
 * landing: the FAILURE branch (`/dashboard`) worked, and success did not.
 *
 * Reachable from four shipped places, and one of them is the couple themselves:
 * `dashboard/[eventId]/guests/[guestId]/actions.ts` (the host pressing "send
 * them a sign-in link" on their own guest list), the three scan-to-join branches
 * in `join/[eventId]/actions.ts`, and `app/[slug]/actions.ts`. An emailed link is
 * the likeliest path a real invited guest ever takes — likelier than a QR — and
 * it ended on "not found".
 *
 * 🔑 **THE FIX: SEND THEM TO THE EVENT'S OWN PAGE.** That page's visibility gate
 * now also admits a signed-in person holding a seat on the event — the row this
 * route has just written — so they arrive somewhere that works instead of
 * somewhere that 404s. See lib/guest-membership-session.ts.
 *
 * ⚠ An event with no public address yet cannot be opened by a guest at all, so
 * that case keeps the account home rather than inventing a destination.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const url = new URL(request.url);
  const origin = url.origin;
  // The invite arrival's Reply door sends a Google / Apple / password sign-in
  // through here so the seat is bound to the account, and asks to come BACK to
  // that door rather than on to the site. A KEYWORD, never a path: the door's
  // address is built below from the slug the database returns.
  const thenReply = url.searchParams.get('then') === CONNECT_THEN_REPLY;
  // The couple's own "send them a sign-in link" signs its return
  // (lib/seat-link-approval.ts). Opaque here — carried through, verified only
  // by `findSeatToConnect` against this event, the row and the signed-in email.
  const approved = url.searchParams.get('approved');
  const carry = connectQuery({ thenReply, approved });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Link expired / opened in a logged-out context → send to login, returning here.
  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent(`/join/${eventId}/connect${carry}`)}`,
        origin,
      ),
    );
  }

  // 🛂 A REQUEST'S OWN EMAIL NEVER OPENS THE DOOR (guest pathway, owner
  // 2026-09-26). `connectEventForUser` falls back to an email match on ANY guest
  // row, and a request row carries the address its asker typed — so without
  // this, "ask to join, then sign in with that email" would be a way inside
  // before the couple decided. Held back ONLY when the email matches nothing
  // but requests and the person holds no key here (no membership, no guest
  // session for this event); a key always goes through.
  if (await onlyARequestHoldsThisEmail(eventId, user.id, user.email ?? null)) {
    return NextResponse.redirect(new URL(`/join/${eventId}?sent=1`, origin));
  }

  // 🔒 BINDING ONLY ON PURPOSE (2026-09-30 — the owner's groom row). An account
  // that is not yet inside this event is ASKED before any seat becomes theirs:
  // "This invitation is for <name>. Save it to <email>?" on the confirm page,
  // whose Yes is the only thing that binds. This route itself binds nothing —
  // `connectEventForUser` without a confirmed guest id only answers "already
  // inside?" — so a stale guest pass on a shared phone cannot ride a sign-in.
  if (!(await alreadyInside(eventId, user.id))) {
    const seat = await findSeatToConnect(eventId, user.id, user.email ?? null, approved);
    if (seat) {
      return NextResponse.redirect(new URL(`/join/${eventId}/connect/confirm${carry}`, origin));
    }
  }

  const { connected } = await connectEventForUser(eventId, user.id, user.email ?? null);

  // Connected → into the event AS A GUEST: its own public page, whose visibility
  // gate now recognises a signed-in person holding a seat — the row this route has
  // just written. NOT `/dashboard/{eventId}`, which is the organiser's dashboard
  // and 404s for the guest this route exists to welcome.
  //
  // The slug is read from the DATABASE, never built from the path — and a `null`
  // slug (a real prod state: 1 of 5 events) means there is no guest-facing page
  // to open, so they keep the account home, where their board now carries the
  // invited card. Failure keeps the account home for the same reason it always
  // did: the couple may still reconcile the seat, or the email matched nothing.
  let dest = '/dashboard';
  if (connected) {
    const { data: event } = await createAdminClient()
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    const slug = (event?.slug as string | null)?.trim();
    if (slug) dest = `/${slug}`;
    // From the invite arrival's Reply door: back to that door, not on to the
    // site. A separate line on purpose — the one above is pinned by
    // an-invited-person-is-recognised.test.ts and stays byte-identical.
    if (slug && thenReply) dest = inviteReplyPath(slug);
    // SIGN UP FIRST, THEN THE FORM (owner 2026-09-25): a guest who has not
    // answered yet lands AT the reply — the sheet opens on `#your-details` —
    // with their details already filled from the seat and the account. The form
    // is still theirs to complete; signing in never counts as a reply.
    if (slug && !thenReply && (await seatAwaitsReply(eventId, user.id))) {
      dest = `/${slug}${REPLY_SHEET_HASH}`;
    }
  }

  // Set-password gate (owner directive): a passwordless email-link account is
  // flagged needs_password at creation → prompt them to set one on first
  // sign-in, UNLESS they came in via Apple/Google (provider !== 'email'), who
  // keep using their OAuth provider. The flag is only ever set on accounts WE
  // created here, so OAuth accounts are inherently never gated.
  const provider = (user.app_metadata?.provider as string | undefined) ?? 'email';
  const needsPassword = user.user_metadata?.needs_password === true;
  if (needsPassword && provider === 'email') {
    return NextResponse.redirect(
      new URL(`/join/${eventId}/set-password?next=${encodeURIComponent(dest)}`, origin),
    );
  }

  return NextResponse.redirect(new URL(dest, origin));
}

/** Is this account already a member of this event, in any capacity? False on any doubt. */
async function alreadyInside(eventId: string, userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('event_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.error('[supabase-error] app/join/[eventId]/connect/route.ts · from:event_members.select', error);
  return Boolean(data);
}

/** The reply sheet's own anchor (rsvp-sheet.tsx `id="your-details"`). */
const REPLY_SHEET_HASH = '#your-details';

/** Has this account's seat on this event still not answered? False on any doubt. */
async function seatAwaitsReply(eventId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: member } = await admin
    .from('event_members')
    .select('guest_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('member_type', 'guest')
    .not('guest_id', 'is', null)
    .maybeSingle();
  if (!member?.guest_id) return false;
  const { data: guest } = await admin
    .from('guests')
    .select('rsvp_status')
    .eq('guest_id', member.guest_id as string)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  return ((guest?.rsvp_status as string | null) ?? null) === 'pending';
}

/**
 * Is this sign-in's email known to the event ONLY through requests nobody has
 * decided yet? True → the connect must not run (see the call site). False on a
 * member, on a device holding this event's key, on an email the couple put on a
 * row themselves, and on an email the event does not know at all (the connect
 * then simply finds nothing, as before).
 */
async function onlyARequestHoldsThisEmail(
  eventId: string,
  userId: string,
  email: string | null,
): Promise<boolean> {
  const address = (email ?? '').trim();
  if (!address) return false;
  const admin = createAdminClient();
  const { data: member } = await admin
    .from('event_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (member) return false;
  const session = await readGuestSession();
  if (session && session.event_id === eventId) return false;
  const { data: rows } = await admin
    .from('guests')
    .select('entry_source')
    .eq('event_id', eventId)
    .ilike('email', address)
    .is('deleted_at', null);
  const list = rows ?? [];
  return list.length > 0 && !list.some((r) => emailMayBindRow(r.entry_source as string | null));
}
