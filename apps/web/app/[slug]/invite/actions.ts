'use server';

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { sendEventAccountMagicLink } from '@/lib/event-account-link';
import { INVITE_LINK_SENT_COOKIE, INVITE_RETURN } from '@/lib/invite-arrival';
import { submitRsvp } from '../actions';

/** Loose on purpose — the address is the guest's to get right; this only stops a typo sending mail. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * DOOR 02 · REPLY — the save (the invite arrival, lib/invite-arrival.ts).
 *
 * The reply itself is `submitRsvp`, unchanged — the SAME write the site's card
 * makes, with every guard it carries (the frozen answer, the email that cannot
 * be emptied, the selfie ref pinned to this guest). This wrapper adds exactly
 * two things and then hands over:
 *
 *   1. `return_to=invite`, so the reply's next door is Enter rather than the
 *      site. A keyword, never a path — submitRsvp builds the address from the
 *      slug the database returns.
 *   2. THE EMAIL IS THE LOGIN (owner 2026-09-10). When a guest with no account
 *      gives an address here, they are emailed the passwordless sign-in link
 *      that connects this event to a real Setnayan account — the same link the
 *      old name door's optional email box sent. There is no separate "offer an
 *      account" step any more; asking for the address twice was that step.
 *
 * The link goes BEFORE the reply is written because submitRsvp ends in a
 * redirect, which throws. Sending it first costs nothing if the write then
 * fails: the guest is sent back here to try again, and the link is still theirs.
 */
export async function submitInviteReply(eventId: string, guestId: string, formData: FormData) {
  formData.set('return_to', INVITE_RETURN);

  const email = String(formData.get('contact_email') ?? '').trim();
  if (email && EMAIL_SHAPE.test(email)) {
    const session = await readGuestSession();
    // Only for the seat this browser actually holds, on this event.
    if (session && session.event_id === eventId && session.guest_id === guestId) {
      const cookieStore = await cookies();
      const alreadySent = cookieStore.get(INVITE_LINK_SENT_COOKIE)?.value === eventId;
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // A signed-in guest already has their account (Google / Apple / email).
      if (!user && !alreadySent) {
        const admin = createAdminClient();
        // …and so does a seat someone has already connected to an account.
        const { data: held } = await admin
          .from('event_members')
          .select('id')
          .eq('event_id', eventId)
          .eq('guest_id', guestId)
          .maybeSingle();
        if (!held) {
          const { ok } = await sendEventAccountMagicLink({ eventId, guestId, email });
          if (ok) {
            cookieStore.set(INVITE_LINK_SENT_COOKIE, eventId, {
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
              maxAge: 60 * 60 * 24,
            });
          }
        }
      }
    }
  }

  return submitRsvp(eventId, guestId, formData);
}
