'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { classifyClaimMatch, MAX_NAME_LENGTH, type SeedCandidate } from '@/lib/guest-claim';
import { emitNotification } from '@/lib/notification-emit';
import { readGuestSession, setGuestSession } from '@/lib/guest-session';
import type { GuestRole } from '@/lib/guests';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';

// Sanity ceiling on accountless self-joins per event. The QR token is the real
// gate; this just bounds runaway spam (the couple reviews/deletes the
// `self_added_unlisted` rows). Generous — weddings rarely exceed it.
const SELF_JOIN_CEILING = 1000;

// Iteration 0053 P2: the self-claimable roles are per event type
// (resolveRoleSetForEvent(eventId).selfClaimableRoles). Invite/Join v2
// (0000 ADDENDUM 2026-06-25): a CONFIDENT match INHERITS the host-assigned
// role — the submitted role is only honored on the no-match path, where the
// joiner self-declares from that safe subset.

/** Best-effort: attach a Gmail-login avatar to a guest row (display only). */
async function applyAvatar(
  admin: ReturnType<typeof createAdminClient>,
  guestId: string,
  avatarUrl: string,
  userId: string,
) {
  await admin
    .from('guests')
    .update({
      photo_url: avatarUrl,
      photo_source: 'oauth_google',
      photo_updated_at: new Date().toISOString(),
      photo_set_by_user_id: userId,
    })
    .eq('guest_id', guestId)
    .or('photo_url.is.null,photo_source.eq.oauth_google');
}

/**
 * Link a signed-in user to an existing host-seeded guest row, INHERITING that
 * row's host-assigned role (role-by-answer-key). Returns the insert error (null
 * on success) so the caller can fall through to optimistic-add on a race.
 */
async function bindMemberToSeed(
  admin: ReturnType<typeof createAdminClient>,
  args: { eventId: string; userId: string; guestId: string; seedRole: GuestRole },
) {
  // The event_members_event_guest_uniq index is the hard race backstop.
  const { error } = await admin.from('event_members').insert({
    event_id: args.eventId,
    user_id: args.userId,
    member_type: 'guest',
    role: args.seedRole,
    joined_via: 'qr_scan',
    guest_id: args.guestId,
  });
  return error;
}

/** Is this matched seed row already claimed by a DIFFERENT user? (Don't hijack.) */
async function seedClaimedByOther(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
  userId: string,
) {
  const { data: linked } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .maybeSingle();
  return !!linked && linked.user_id !== userId;
}

/** Tell the couple an unlisted guest joined so they can reconcile. */
async function notifyCoupleUnlisted(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  name: string,
) {
  const { data: couples } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple');
  await Promise.all(
    (couples ?? []).map((c) =>
      emitNotification({
        userId: c.user_id as string,
        // Reuse the existing guest-confirm notification type (no new type needed).
        type: 'guest_claim_pending',
        title: 'Someone joined who wasn’t on your list',
        body: `${name} added themselves to your guest list. Review to link them to an existing guest, keep them, or remove them.`,
        relatedUrl: `/dashboard/${eventId}/guests/claims`,
      }),
    ),
  );
}

/**
 * Optimistically admit a joiner whose name did NOT confidently match the list:
 * create a `guests` row tagged `self_added_unlisted`, link the membership, and
 * notify the couple. NOBODY is ever blocked — the couple reconciles afterward.
 */
async function admitAsUnlisted(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    eventId: string;
    userId: string;
    presentedName: string;
    role: GuestRole;
    avatarUrl: string | null;
  },
) {
  const parts = args.presentedName.split(/\s+/);
  const firstName = parts[0] || args.presentedName;
  const lastName = parts.slice(1).join(' ') || '—'; // last_name is NOT NULL

  const { data: inserted, error } = await admin
    .from('guests')
    .insert({
      event_id: args.eventId,
      first_name: firstName,
      last_name: lastName,
      side: 'both',
      group_category: 'other',
      role: args.role,
      rsvp_status: 'pending',
      meal_preference: 'no_preference',
      invited_to_blocks: ['ceremony', 'reception'],
      entry_source: 'self_added_unlisted',
      photo_consent: true,
      ...(args.avatarUrl
        ? {
            photo_url: args.avatarUrl,
            photo_source: 'oauth_google',
            photo_updated_at: new Date().toISOString(),
            photo_set_by_user_id: args.userId,
          }
        : {}),
    })
    .select('guest_id')
    .single();

  if (error || !inserted) return false;

  await bindMemberToSeed(admin, {
    eventId: args.eventId,
    userId: args.userId,
    guestId: inserted.guest_id as string,
    seedRole: args.role,
  });
  await notifyCoupleUnlisted(admin, args.eventId, args.presentedName);
  return true;
}

/**
 * Invite/Join v2 (0000 ADDENDUM 2026-06-25) — name-as-answer-key, optimistic
 * admit. A signed-in joiner types their name; it's matched against the couple's
 * list. A confident match links + inherits the host-assigned role; anything else
 * is STILL admitted, flagged `self_added_unlisted` for the couple to reconcile.
 * This replaces the old privacy-first OTP/pending-review claim (owner-signed-off
 * reversal: a name isn't a secret, but for a low-stakes guest list UX wins;
 * provenance badge + host-controlled role + couple Delete are the safety net).
 */
export async function joinEventAction(eventId: string, token: string, formData: FormData) {
  const role = String(formData.get('role') ?? '') as GuestRole;
  // Cap at the input boundary — bounds the O(n·m) fuzzy match against an
  // attacker-supplied name (the client maxLength is non-authoritative).
  const presentedName = String(formData.get('name') ?? '').trim().slice(0, MAX_NAME_LENGTH);

  const roleSet = await resolveRoleSetForEvent(eventId);
  // The submitted role is only used on the no-match path (self-declared from the
  // safe subset); a confident match inherits the host's role regardless.
  if (!roleSet.selfClaimableRoles.includes(role)) {
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
  // .or() WHERE guard inside applyAvatar.
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  // 4. EXACT-EMAIL fast path — highest confidence. The signed-in user's email
  //    matches a seed row → link directly, inheriting the host's role.
  if (user.email) {
    const { data: emailSeed } = await admin
      .from('guests')
      .select('guest_id, role')
      .eq('event_id', eventId)
      .ilike('email', user.email)
      .is('deleted_at', null)
      .maybeSingle();

    if (emailSeed && !(await seedClaimedByOther(admin, eventId, emailSeed.guest_id, user.id))) {
      if (avatarUrl) await applyAvatar(admin, emailSeed.guest_id as string, avatarUrl, user.id);
      const err = await bindMemberToSeed(admin, {
        eventId,
        userId: user.id,
        guestId: emailSeed.guest_id as string,
        seedRole: emailSeed.role as GuestRole,
      });
      if (!err) return redirect(`/join/${eventId}/success?token=${encodeURIComponent(token)}`);
      // Race → fall through to name-match / optimistic-add.
    }
  }

  // 5. NAME-AS-ANSWER-KEY — fuzzy-match the typed name against the couple's
  //    unclaimed seed rows. Confident single match → link + inherit the host's
  //    role. Ambiguous (same-name collision) or none → admit as unlisted.
  const [{ data: seeds }, { data: members }] = await Promise.all([
    admin
      .from('guests')
      .select('guest_id, first_name, last_name, display_name, email, role')
      .eq('event_id', eventId)
      .is('deleted_at', null),
    admin
      .from('event_members')
      .select('guest_id')
      .eq('event_id', eventId)
      .not('guest_id', 'is', null),
  ]);

  const claimed = new Set((members ?? []).map((m) => m.guest_id as string));
  const roleByGuestId = new Map<string, GuestRole>();
  const candidates: SeedCandidate[] = (seeds ?? [])
    .filter((s) => !claimed.has(s.guest_id as string))
    .map((s) => {
      roleByGuestId.set(s.guest_id as string, (s.role as GuestRole) ?? 'guest');
      const name = (s.display_name as string | null)?.trim() || `${s.first_name} ${s.last_name}`.trim();
      return { guestId: s.guest_id as string, name, email: s.email as string | null };
    });

  const match = classifyClaimMatch(presentedName, candidates);

  if (match.kind === 'confident') {
    if (avatarUrl) await applyAvatar(admin, match.candidate.guestId, avatarUrl, user.id);
    const err = await bindMemberToSeed(admin, {
      eventId,
      userId: user.id,
      guestId: match.candidate.guestId,
      seedRole: roleByGuestId.get(match.candidate.guestId) ?? 'guest',
    });
    if (!err) return redirect(`/join/${eventId}/success?token=${encodeURIComponent(token)}`);
    // Race lost the seat → fall through to optimistic-add as unlisted.
  }

  // 6. No confident match → OPTIMISTIC ADMIT as unlisted. Never blocked; the
  //    couple is notified and reconciles (Link / Keep / Delete). The self-declared
  //    role (validated against selfClaimableRoles above) is used here.
  await admitAsUnlisted(admin, {
    eventId,
    userId: user.id,
    presentedName,
    role,
    avatarUrl,
  });

  return redirect(`/join/${eventId}/success?token=${encodeURIComponent(token)}&unlisted=1`);
}

/**
 * ACCOUNTLESS self-join (owner 2026-06-20 "yes we allow this" — let an older
 * guest who scans the event QR add themselves WITHOUT making an account).
 *
 * Reuses the SAME guest-cookie mechanism as `/[slug]/redeem` (System 1): create
 * a `guests` row via the admin client and sign the `setnayan_guest_session`
 * cookie — the joiner is then exactly like a personal-link redeemer and RSVPs
 * through the existing widget on `/[slug]`. It does NOT touch `event_members`
 * (account-only) or any RLS — the QR token + cookie are the auth. The row is
 * tagged `self_added_unlisted` (Invite/Join v2 provenance) so the couple can
 * reconcile it. (Name-matching for accountless joiners is a fast-follow.)
 */
export async function selfJoinAction(eventId: string, token: string, formData: FormData) {
  const role = String(formData.get('role') ?? '') as GuestRole;
  const presentedName = String(formData.get('name') ?? '').trim().slice(0, MAX_NAME_LENGTH);

  const roleSet = await resolveRoleSetForEvent(eventId);
  if (!roleSet.selfClaimableRoles.includes(role)) {
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
    .eq('entry_source', 'self_added_unlisted')
    .is('deleted_at', null);
  if ((count ?? 0) >= SELF_JOIN_CEILING) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=join_closed`);
  }

  // 5. Create the guest row (admin) — same minimal shape the couple's quick-add
  //    uses, tagged `self_added_unlisted`. Split the name best-effort; couple can refine.
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
      entry_source: 'self_added_unlisted',
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

  // 7. Tell the couple an unlisted guest joined (reconcile queue).
  await notifyCoupleUnlisted(admin, eventId, presentedName);

  // 8. Best-effort scan record for triage (mirrors redeem; failures don't block).
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
