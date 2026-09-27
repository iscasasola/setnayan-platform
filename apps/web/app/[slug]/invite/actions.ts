'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { INVITE_RETURN, inviteReplyPath } from '@/lib/invite-arrival';
import {
  hasAgreedToTerms,
  RSVP_TERMS_COOKIE,
  RSVP_TERMS_COOKIE_MAX_AGE,
  TERMS_FIELD,
  TERMS_VERSION,
} from '@/lib/terms-agreement';
import { createAdminClient } from '@/lib/supabase/admin';
import { submitRsvp } from '../actions';

/**
 * DOOR 02 · REPLY — the save. Since 2026-09-27 this door IS the RSVP page of
 * the guest pathway (spec corpus DECISION_LOG "GUEST PATHWAY PROTOTYPE — TERMS
 * ON THE RSVP PAGE").
 *
 * The reply itself is `submitRsvp`, unchanged — the SAME write the site's card
 * makes, with every guard it carries (the frozen answer, the email that cannot
 * be emptied, the selfie ref pinned to this guest). This wrapper adds:
 *
 *   · `return_to=invite` — the reply's next screen is the thank-you (door 03),
 *     a KEYWORD, never a path (submitRsvp builds the address from the database);
 *   · 🔒 THE TERMS TICK IS REQUIRED HERE (owner 2026-09-27, "Terms tick on the
 *     RSVP page"). An unticked POST — which an unticked checkbox sends as NO key
 *     at all — is refused and returned to the page, never saved. The one
 *     exception is "Not coming after all?", which carries nothing new;
 *   · the agreement is CARRIED, never re-asked: an httpOnly cookie holding the
 *     version, read by the Google/Apple callback and the emailed link when the
 *     guest taps "Save to my account" on the next screen
 *     (`RSVP_TERMS_COOKIE`, lib/terms-agreement.ts);
 *   · and the tick is then REMOVED from the form handed to `submitRsvp`, so the
 *     save does not also email a sign-in link. On this page saving to an account
 *     is the NEXT screen's one button, chosen by the device — not a side effect
 *     of Send.
 */
export async function submitInviteReply(eventId: string, guestId: string, formData: FormData) {
  formData.set('return_to', INVITE_RETURN);
  const declining = formData.get('rsvp_status') === 'declined';
  const agreed = hasAgreedToTerms(formData.get(TERMS_FIELD));
  if (!agreed && !declining) {
    const { data: ev } = await createAdminClient()
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    redirect(ev?.slug ? `${inviteReplyPath(ev.slug as string)}?rsvp=terms` : '/');
  }
  if (agreed) {
    const jar = await cookies();
    jar.set(RSVP_TERMS_COOKIE, TERMS_VERSION, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: RSVP_TERMS_COOKIE_MAX_AGE,
    });
  }
  formData.delete(TERMS_FIELD);
  return submitRsvp(eventId, guestId, formData);
}
