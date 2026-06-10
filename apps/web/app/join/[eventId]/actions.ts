'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { processGuestClaim } from '@/lib/guest-claim-flow';
import { MAX_NAME_LENGTH } from '@/lib/guest-claim';
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
  // Cap at the input boundary — bounds the O(n·m) fuzzy match against an
  // attacker-supplied name (the client maxLength is non-authoritative).
  const presentedName = String(formData.get('name') ?? '').trim().slice(0, MAX_NAME_LENGTH);

  if (!VALID_ROLES.includes(role)) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=invalid_role`);
  }
  if (!presentedName) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=missing_name`);
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
    return redirect(`/login?next=${encodeURIComponent(`/join/${eventId}?token=${token}`)}`);
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

  // Gmail-login avatar (owner directive 2026-06-05). DISPLAY-only — never a face
  // enrollment. Priority selfie > couple_upload > oauth_google is enforced by the
  // .or() WHERE guard below.
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  // 4. EXACT-EMAIL fast path — highest confidence. The signed-in user's email
  //    matches a seed-list row the couple recorded → link directly, no claim.
  if (user.email) {
    const { data: matchingGuest } = await admin
      .from('guests')
      .select('guest_id')
      .eq('event_id', eventId)
      .ilike('email', user.email)
      .is('deleted_at', null)
      .maybeSingle();

    if (matchingGuest) {
      // Guard: don't hijack a seed row already bound to a DIFFERENT user.
      const { data: linked } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('guest_id', matchingGuest.guest_id)
        .maybeSingle();

      if (!linked || linked.user_id === user.id) {
        if (avatarUrl) {
          await admin
            .from('guests')
            .update({
              photo_url: avatarUrl,
              photo_source: 'oauth_google',
              photo_updated_at: new Date().toISOString(),
              photo_set_by_user_id: user.id,
            })
            .eq('guest_id', matchingGuest.guest_id)
            .or('photo_url.is.null,photo_source.eq.oauth_google');
        }

        // Bind via the ADMIN client: member_can_self_join now forbids a
        // user-scoped insert that sets guest_id (privileged identity bind), and
        // the event-scoped + unclaimed checks above are the authorization. The
        // event_members_event_guest_uniq index is the hard race backstop.
        const { error: memberErr } = await admin.from('event_members').insert({
          event_id: eventId,
          user_id: user.id,
          member_type: 'guest',
          role,
          joined_via: 'qr_scan',
          guest_id: matchingGuest.guest_id,
        });

        if (!memberErr) {
          return redirect(`/join/${eventId}/success?token=${encodeURIComponent(token)}`);
        }
        // Conflict (the seat got bound to someone else in a race) → fall through
        // to the claim flow, which routes the couple a review request.
      }
    }
  }

  // 5. No exact email match → privacy-first CLAIM flow. We NEVER auto-admit an
  //    unmatched stranger anymore (the old behavior minted a placeholder guest +
  //    membership). Instead: fuzzy-match the name → email-OTP handshake on a
  //    confident match, otherwise route to the couple's review queue.
  await processGuestClaim({
    eventId,
    userId: user.id,
    loginEmail: user.email ?? null,
    claimerName: presentedName,
    role,
  });

  // Uniform redirect for BOTH outcomes (otp_sent AND pending_review). Matched
  // vs unmatched MUST be indistinguishable or the page transition becomes a
  // guest-list enumeration oracle — the /verify screen renders identically for
  // either status and the code form is always shown.
  return redirect(`/join/${eventId}/verify?token=${encodeURIComponent(token)}`);
}
