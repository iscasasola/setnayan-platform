'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { processGuestClaim } from '@/lib/guest-claim-flow';
import { MAX_NAME_LENGTH } from '@/lib/guest-claim';
import { readGuestSession, setGuestSession } from '@/lib/guest-session';
import type { GuestRole } from '@/lib/guests';

// Sanity ceiling on accountless self-joins per event. The QR token is the real
// gate; this just bounds runaway spam (the couple reviews/deletes the
// `self_joined`-tagged rows). Generous — weddings rarely exceed it.
const SELF_JOIN_CEILING = 1000;

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

/**
 * ACCOUNTLESS self-join (owner 2026-06-20 "yes we allow this" — let an older
 * guest who scans the event QR add themselves WITHOUT making an account).
 *
 * This reuses the SAME guest-cookie mechanism as `/[slug]/redeem` (System 1):
 * create a `guests` row via the admin client and sign the `setnayan_guest_session`
 * cookie — the joiner is then exactly like a personal-link redeemer and RSVPs
 * through the existing widget on `/[slug]`. It does NOT touch `event_members`
 * (which stays account-only) or any RLS — the QR token + cookie are the auth.
 * Self-joined rows are tagged `self_joined` so the couple can review/remove them.
 */
export async function selfJoinAction(eventId: string, token: string, formData: FormData) {
  const role = String(formData.get('role') ?? '') as GuestRole;
  const presentedName = String(formData.get('name') ?? '').trim().slice(0, MAX_NAME_LENGTH);

  if (!VALID_ROLES.includes(role)) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=invalid_role`);
  }
  if (!presentedName) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=missing_name`);
  }

  const admin = createAdminClient();

  // 1. Re-validate the token — this is the ONLY gate (no RLS on the admin write),
  //    so it must be mandatory and identical to the page/joinEventAction check.
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

  // 2. The accountless guest lands on the public `/[slug]` page to RSVP — so it
  //    only makes sense when a slug exists. (The page only offers this path when
  //    there is one; guard anyway and fall back to the sign-in route.)
  const { data: event } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  const slug = (event?.slug as string | null) ?? null;
  if (!slug) {
    return redirect(`/login?next=${encodeURIComponent(`/join/${eventId}?token=${token}`)}`);
  }

  // 3. Idempotent: already self-joined on this device → straight to the page,
  //    no duplicate row (the guest-session cookie is the dedup key).
  const existingSession = await readGuestSession();
  if (existingSession && existingSession.event_id === eventId) {
    return redirect(`/${slug}`);
  }

  // 4. Sanity ceiling on self-joins for this event.
  const { count } = await admin
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .contains('custom_tags', ['self_joined'])
    .is('deleted_at', null);
  if ((count ?? 0) >= SELF_JOIN_CEILING) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=join_closed`);
  }

  // 5. Create the guest row (admin) — same minimal shape the couple's quick-add
  //    uses, tagged `self_joined`. Split the name best-effort; couple can refine.
  const parts = presentedName.split(/\s+/);
  const firstName = parts[0] ?? presentedName;
  const lastName = parts.slice(1).join(' ');

  const { data: inserted, error } = await admin
    .from('guests')
    .insert({
      event_id: eventId,
      first_name: firstName,
      last_name: lastName,
      side: 'both',
      group_category: 'other',
      role,
      rsvp_status: 'pending',
      meal_preference: 'no_preference',
      invited_to_blocks: ['ceremony', 'reception'],
      custom_tags: ['self_joined'],
    })
    .select('guest_id, qr_token')
    .single();

  if (error || !inserted) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=join_failed`);
  }

  // 6. Sign the guest-session cookie — now identical to a /[slug]/redeem guest.
  await setGuestSession({
    guest_id: inserted.guest_id as string,
    event_id: eventId,
    qr_token: inserted.qr_token as string,
  });

  // 7. Best-effort scan record for triage (mirrors redeem; failures don't block).
  const h = await headers();
  const xff = h.get('x-forwarded-for') ?? '';
  const ipFull = xff.split(',')[0]?.trim() ?? '';
  const ipAnon = ipFull ? ipFull.split('.').slice(0, 3).join('.') + '.0' : null;
  await admin.from('scan_events').insert({
    event_id: eventId,
    guest_id: inserted.guest_id as string,
    source: 'browser',
    user_agent: h.get('user-agent') ?? null,
    ip_anon: ipAnon,
    context: { entry: 'self_join' },
  });

  return redirect(`/${slug}`);
}
