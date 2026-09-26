'use server';

import { INVITE_RETURN } from '@/lib/invite-arrival';
import { submitRsvp } from '../actions';

/**
 * DOOR 02 · REPLY — the save (the invite arrival, lib/invite-arrival.ts).
 *
 * The reply itself is `submitRsvp`, unchanged — the SAME write the site's card
 * makes, with every guard it carries (the frozen answer, the email that cannot
 * be emptied, the selfie ref pinned to this guest). This wrapper adds exactly
 * one thing and hands over: `return_to=invite`, so the reply's next door is
 * Enter rather than the site. A keyword, never a path — submitRsvp builds the
 * address from the slug the database returns.
 *
 * 🔑 THE EMAIL IS THE LOGIN (owner 2026-09-10) — and since 2026-09-25 that is
 * true on EVERY reply surface, not only this door: the sign-in link is sent by
 * `submitRsvp` itself (`sendKeepLinkOnce`, lib/guest-one-path.server.ts), after
 * the write lands, when the guest ticked "keep this invitation on my phone".
 * It used to be sent here, before the reply, so the `/{slug}` sheet — which
 * calls `submitRsvp` directly — saved the address and sent nothing.
 */
export async function submitInviteReply(eventId: string, guestId: string, formData: FormData) {
  formData.set('return_to', INVITE_RETURN);
  return submitRsvp(eventId, guestId, formData);
}
