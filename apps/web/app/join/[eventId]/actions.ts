'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { GuestRole } from '@/lib/guests';

const VALID_ROLES: GuestRole[] = [
  'guest',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];

export async function joinEventAction(eventId: string, token: string, formData: FormData) {
  const role = String(formData.get('role') ?? '') as GuestRole;

  if (!VALID_ROLES.includes(role)) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=invalid_role`);
  }

  // 1. Re-validate the token (admin bypasses RLS).
  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from('event_join_tokens')
    .select('event_id, revoked_at, expires_at')
    .eq('event_id', eventId)
    .eq('token', token)
    .maybeSingle();

  const tokenValid =
    !!tokenRow &&
    !tokenRow.revoked_at &&
    (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());

  if (!tokenValid) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=invalid_token`);
  }

  // 2. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect(
      `/login?next=${encodeURIComponent(`/join/${eventId}?token=${token}`)}`,
    );
  }

  // 3. Already a member? Bail with appropriate redirect.
  const { data: existing } = await admin
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (existing.member_type === 'couple') {
      return redirect(`/dashboard/${eventId}`);
    }
    return redirect(`/join/${eventId}/success?token=${encodeURIComponent(token)}`);
  }

  // 4. Try to find an existing guests row that matches this user's email — link
  //    them if so. Otherwise create a new guests row with their account info
  //    so they show up on the couple's list immediately.
  let guestId: string | null = null;
  if (user.email) {
    const { data: matchingGuest } = await admin
      .from('guests')
      .select('guest_id')
      .eq('event_id', eventId)
      .ilike('email', user.email)
      .is('deleted_at', null)
      .maybeSingle();
    if (matchingGuest) guestId = matchingGuest.guest_id;
  }

  if (!guestId) {
    // Create a placeholder guests row so the couple sees the new arrival.
    const fallbackFirst =
      (user.user_metadata?.first_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Guest';
    const fallbackLast =
      (user.user_metadata?.last_name as string | undefined) ??
      '(joined via QR)';

    const { data: newGuest, error: newGuestErr } = await admin
      .from('guests')
      .insert({
        event_id: eventId,
        first_name: fallbackFirst,
        last_name: fallbackLast,
        side: 'both',
        group_category: 'friends',
        role,
        email: user.email,
        rsvp_status: 'pending',
        photo_consent: true,
      })
      .select('guest_id')
      .single();

    if (newGuestErr) {
      return redirect(
        `/join/${eventId}?token=${encodeURIComponent(token)}&error=${encodeURIComponent(newGuestErr.message)}`,
      );
    }
    guestId = newGuest.guest_id;
  }

  // 5. Insert the event_members link via the user's own JWT (RLS allows self-insert).
  const { error: memberErr } = await supabase.from('event_members').insert({
    event_id: eventId,
    user_id: user.id,
    member_type: 'guest',
    role,
    joined_via: 'qr_scan',
    guest_id: guestId,
  });

  if (memberErr) {
    return redirect(
      `/join/${eventId}?token=${encodeURIComponent(token)}&error=${encodeURIComponent(memberErr.message)}`,
    );
  }

  return redirect(`/join/${eventId}/success?token=${encodeURIComponent(token)}`);
}
