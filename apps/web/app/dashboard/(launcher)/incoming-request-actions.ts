'use server';

/**
 * incoming-request-actions.ts — YES · NO · "Don't show me invites from …".
 *
 * Owner 2026-09-28: "You are invited to {user name}'s {event name} {event
 * type} event. (YES/NO)" — "The invitation is to join" — "accepting means they
 * are also going automatically" — and "Don't show me invites from this
 * person". Approved prototype: incoming-requests-delta.html.
 *
 * The decision lives in the DATABASE (`answer_incoming_request`, migration
 * 20271252896804): it re-reads the request as `incoming_requests_for_me()` for
 * THIS caller, so nobody can answer a request that is not theirs, and it links
 * the account BEFORE marking Attending so the co-host and follow triggers see a
 * joined guest. This file only calls it and says what happened.
 *
 * YES then goes to the event's own RSVP page (their invitation key), which asks
 * only what their account does not already hold — the guest pathway's prefill.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';

export async function answerIncomingRequest(formData: FormData): Promise<void> {
  const guestId = formData.get('guest_id');
  const answer = formData.get('answer');
  if (typeof guestId !== 'string' || (answer !== 'yes' && answer !== 'no')) {
    redirect('/dashboard');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('answer_incoming_request', {
    p_guest_id: guestId as string,
    p_yes: answer === 'yes',
  });
  if (error) {
    console.error('[answerIncomingRequest]', error);
    redirect('/dashboard?request_error=1');
  }
  revalidatePath('/dashboard');

  const row = (Array.isArray(data) ? data[0] : data) as
    | { event_id: string; event_slug: string | null; qr_token: string | null }
    | undefined;
  if (answer === 'no' || !row?.event_slug || !row.qr_token) {
    redirect(answer === 'no' ? '/dashboard?request_declined=1' : '/dashboard');
  }

  // YES → their own invitation (key), which opens the RSVP for anything still
  // missing. The key in the URL is theirs: this request was matched to their
  // confirmed email by the database.
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), row!.event_id);
  redirect(`${publicEventPath(row!.event_slug!, ownerSlug)}?invite=${encodeURIComponent(row!.qr_token!)}`);
}

export async function muteInviter(formData: FormData): Promise<void> {
  const inviter = formData.get('inviter_user_id');
  if (typeof inviter !== 'string' || inviter.length === 0) redirect('/dashboard');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (user!.id === inviter) redirect('/dashboard');

  // RLS: invite_mutes_own — the row is written as, and only readable by, the
  // person muting. The inviter is never told.
  const { error } = await supabase
    .from('invite_mutes')
    .insert({ user_id: user!.id, muted_user_id: inviter as string });
  if (error && error.code !== '23505') {
    console.error('[muteInviter]', error);
    redirect('/dashboard?request_error=1');
  }
  revalidatePath('/dashboard');
  redirect('/dashboard?inviter_muted=1');
}
