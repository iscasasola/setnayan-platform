'use server';

import { allowGuestSelfJoinAttempt } from '@/lib/join-door-throttle';
import { parsePersonName } from '@/lib/person-name-parse';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';
import { readGuestSession, setGuestSession } from '@/lib/guest-session';
import { recordScan } from '@/lib/scan-trail';
import { readRememberedRequest, rememberRequestKey } from '@/lib/request-key.server';
import { findGuestSeatForUser } from '@/lib/guest-membership-session';
import type { GuestRole } from '@/lib/guests';
import { seedBindAllowed } from '@/lib/guest-claim';
import { GUEST_LIST_ONLY, inviteReplyPath, selfJoinRefusalPath } from '@/lib/invite-arrival';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { anyoneMayAskToJoin, sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import {
  emailMayBindRow,
  readRequestAnswers,
  requestedSeatsNote,
  type RequestAnswers,
} from '@/lib/guest-requests';
import { isCoupleSeat } from '@/lib/seat-binding';
import { forgetFindState } from '@/lib/find-me.server';

// Sanity ceiling on requests per event. Nobody is admitted by a request any
// more, but every request is still a row the couple has to read — this bounds
// runaway spam. Generous — weddings rarely exceed it.
const SELF_JOIN_CEILING = 1000;

// 🛂 NOBODY WITHOUT A KEY GETS INSIDE UNTIL THE COUPLE KEEPS OR LINKS THEM
// (owner, DECISION_LOG 2026-09-26 — reverses the 2026-06-25 optimistic admit).
// Both actions below turn a person without a key into a REQUEST: a guest row
// holding their answers, with NO `event_members` row and NO guest session. The
// couple decides in Guest List → Requests (Keep · Remove · Link), and only Keep
// or Link issues the key (`lib/guest-request-key.ts`). See `lib/guest-requests.ts`.
//
// A NAME IS NOT A SECRET: a typed name never binds anyone to anything here any
// more — it is only the couple's suggested match. The one bind that remains is
// the signed-in EMAIL fast path, and only onto a row the couple themselves put
// on the list (`emailMayBindRow`): the couple wrote that address down, and the
// sign-in proved the inbox.
//
// 🔒 ROLE IS THE HOST'S FIELD (owner-locked 2026-06-25). No role is read from
// any form; a request is always `guest` and the couple refines it on Keep.

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
 * row's host-assigned role. Returns the insert error (null on success).
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

/**
 * Best-effort `scan_events` row when somebody actually gets inside through this
 * door. A header-reading wrapper over `recordScan`, the ONE door that writes
 * `scan_events` — so a guest who set `scan_tracking_opt_out` gets no row.
 * `lib/every-scan-goes-through-one-door.test.ts` fails if this file ever
 * inserts directly again. A REQUEST records nothing: nobody entered.
 */
async function recordJoinScan(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
  entry: 'self_join' | 'self_join_bound_seed' | 'account_join',
) {
  try {
    const h = await headers();
    await recordScan(admin, {
      eventId,
      guestId,
      entry,
      userAgent: h.get('user-agent'),
      forwardedFor: h.get('x-forwarded-for'),
    });
  } catch {
    // swallow — triage only
  }
}

/**
 * A SIGNED-IN PERSON WHO HOLDS A SEAT IS HANDED THE SAME IDENTITY THE KEY GIVES.
 *
 * `/{slug}` decides "guest or stranger" from the `setnayan_guest_session`
 * cookie. This Server Action runs only on a real press, so minting here is
 * legal (a render or a prefetched GET may not — see
 * `lib/guest-membership-session.ts`, which a test holds to zero mints).
 * ⚠ The cookie holds exactly one event and has a hard 60-day life.
 *
 * Only called for an account that ALREADY holds a seat (a returning member, or
 * the couple-recorded email bind). A request never reaches it.
 *
 * Returns the destination, or NULL when there is no readable seat / no public
 * address — the caller then falls back to the success page.
 */
async function enterAsGuest(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  userId: string,
): Promise<string | null> {
  // The slug comes back THROUGH THE DATABASE, never from anything the caller
  // sent (the open-redirect lesson `[slug]/redeem` paid for on 2026-08-06), and
  // the qr_token is re-read LIVE.
  const seat = await findGuestSeatForUser(eventId, userId);
  if (!seat) return null;
  await setGuestSession({
    guest_id: seat.guestId,
    event_id: eventId,
    qr_token: seat.qrToken,
  });
  await recordJoinScan(admin, eventId, seat.guestId, 'account_join');
  return `/${seat.slug}`;
}

/** Tell the couple somebody asked to join (in-app; the Requests list is where they act). */
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
        title: 'Someone asked to join your guest list',
        body: `${name} asked to join. They are not inside yet — Keep, Link or Remove them in Requests.`,
        relatedUrl: `/dashboard/${eventId}/guests/claims`,
      }),
    ),
  );
}

/**
 * THE REQUEST. One guest row carrying the person's own answers, tagged
 * `self_added_unlisted`, with nothing that lets them in: no `event_members`
 * row, no guest session. A signed-in asker is remembered in `guest_claims` so
 * Keep/Link can bind that account afterwards.
 *
 * Asking twice updates the one request instead of piling up duplicates — keyed
 * on the account (signed in) or the email (signed out).
 *
 * Returns the request's guest_id, or null when it could not be written.
 */
async function createJoinRequest(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    eventId: string;
    answers: RequestAnswers;
    role: GuestRole;
    userId: string | null;
    avatarUrl: string | null;
    /** This browser's own open request (its remembered key) — asked again, it is updated, never doubled. */
    rememberedRequestId?: string | null;
  },
): Promise<string | null> {
  const { eventId, answers, userId } = args;
  const now = new Date().toISOString();
  const answerColumns = {
    rsvp_status: answers.rsvp_status,
    rsvp_responded_at: now,
    meal_preference: answers.meal_preference,
    dietary_restrictions: answers.dietary_restrictions,
    guest_note: answers.guest_note,
    mobile: answers.mobile,
    notes: requestedSeatsNote(answers.seats),
    updated_at: now,
  };

  // 1. The same person asking again → their one open request.
  let existingId: string | null = args.rememberedRequestId ?? null;
  if (existingId) {
    // (checked below: still a request, not removed)
  } else if (userId) {
    const { data: claim } = await admin
      .from('guest_claims')
      .select('target_guest_id, status')
      .eq('event_id', eventId)
      .eq('claimer_user_id', userId)
      .maybeSingle();
    if (claim?.status === 'pending_review' && claim.target_guest_id) existingId = claim.target_guest_id as string;
  } else if (answers.email) {
    // Same address AND the same name — an address alone would let anybody who
    // types someone else's email overwrite that person's request.
    const { data: priors } = await admin
      .from('guests')
      .select('guest_id, first_name, last_name, display_name')
      .eq('event_id', eventId)
      .eq('entry_source', 'self_added_unlisted')
      .ilike('email', answers.email)
      .is('deleted_at', null)
      .limit(5);
    const same = (priors ?? []).find((p) =>
      seedBindAllowed(answers.name, `${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+—$/, '')),
    );
    existingId = (same?.guest_id as string | undefined) ?? null;
  }
  if (existingId) {
    const { data: still } = await admin
      .from('guests')
      .select('guest_id')
      .eq('guest_id', existingId)
      .eq('event_id', eventId)
      .eq('entry_source', 'self_added_unlisted')
      .is('deleted_at', null)
      .maybeSingle();
    if (still) {
      const { error } = await admin.from('guests').update(answerColumns).eq('guest_id', existingId).eq('event_id', eventId);
      if (error) console.error('[supabase-error] app/join/[eventId]/actions.ts · from:guests.update', error);
      return error ? null : existingId;
    }
  }

  // 2. A new request row. One shared name parser (lib/person-name-parse.ts);
  //    last_name is NOT NULL, so a mononym keeps the '—' placeholder.
  //    Typed in the five boxes (owner 2026-09-30: *"Prefix · First · Middle ·
  //    Last · Suffix"*), the parts are stored AS TYPED — no parser second-guesses
  //    what the person split themselves.
  const parsed = parsePersonName(answers.name);
  const nameColumns = answers.parts
    ? {
        first_name: answers.parts.first_name as string,
        last_name: answers.parts.last_name as string,
        name_prefix: answers.parts.name_prefix,
        middle_name: answers.parts.middle_name,
        name_suffix: answers.parts.name_suffix,
      }
    : {
        first_name: parsed.firstName || answers.name,
        last_name: parsed.lastName || '—',
        ...(parsed.prefix ? { name_prefix: parsed.prefix } : {}),
        ...(parsed.middleName ? { middle_name: parsed.middleName } : {}),
        ...(parsed.suffix ? { name_suffix: parsed.suffix } : {}),
      };
  const { data: inserted, error } = await admin
    .from('guests')
    .insert({
      event_id: eventId,
      ...nameColumns,
      side: 'both',
      group_category: 'other',
      role: args.role,
      invited_to_blocks: ['ceremony', 'reception'],
      entry_source: 'self_added_unlisted',
      // The address they gave so Keep/Link can send their key — the ONE email
      // writer on this door. It never binds anything: `emailMayBindRow` refuses
      // every row that is not `host_seeded`.
      email: answers.email,
      ...answerColumns,
      ...(userId && args.avatarUrl
        ? {
            photo_url: args.avatarUrl,
            photo_source: 'oauth_google',
            photo_updated_at: now,
            photo_set_by_user_id: userId,
          }
        : {}),
    })
    .select('guest_id')
    .single();
  if (error) console.error('[supabase-error] app/join/[eventId]/actions.ts · from:guests.insert', error);
  if (error || !inserted) return null;
  const requestId = inserted.guest_id as string;

  // 3. A signed-in asker is remembered, so Keep/Link can bind THEIR account.
  if (userId) {
    const { error: claimErr } = await admin.from('guest_claims').upsert(
      {
        event_id: eventId,
        claimer_user_id: userId,
        claimer_name: answers.name,
        claimer_email: answers.email,
        target_guest_id: requestId,
        status: 'pending_review',
        resolved_guest_id: null,
        reviewed_at: null,
        reviewed_by_user_id: null,
        last_claim_at: now,
        updated_at: now,
      },
      { onConflict: 'event_id,claimer_user_id' },
    );
    if (claimErr) console.error('[supabase-error] app/join/[eventId]/actions.ts · from:guest_claims.upsert', claimErr);
  }

  await notifyCoupleUnlisted(admin, eventId, answers.name);
  return requestId;
}

/** Where a request that could not be read goes back to — this door, with the reason. */
function backToDoor(eventId: string, token: string, error: string): never {
  const t = token ? `token=${encodeURIComponent(token)}&` : '';
  redirect(`/join/${eventId}?${t}error=${encodeURIComponent(error)}`);
}

/**
 * "SENT TO THE COUPLE" — and the requester leaves holding their OWN key (owner
 * 2026-09-29, DECISION_LOG "A REQUESTER GETS THEIR QR AT ONCE; IT UNLOCKS ONLY
 * WHEN THE COUPLE ACCEPTS"; prototype guest_ticket_flow_2026-09-29.html frame B).
 * The request row's own `qr_token` is remembered in THIS browser's request
 * cookie (never a guest session — lib/request-key.server.ts) and they land on
 * `/{slug}/request?sent=1`: their Digital ticket marked "Request pending", Save,
 * and "Copy my link". Without an event address, the door's old "Request sent".
 */
async function requestSent(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  token: string,
  requestId: string,
): Promise<never> {
  const [{ data: row }, { data: ev }] = await Promise.all([
    admin.from('guests').select('qr_token').eq('guest_id', requestId).eq('event_id', eventId).maybeSingle(),
    admin.from('events').select('slug').eq('event_id', eventId).maybeSingle(),
  ]);
  const key = (row?.qr_token as string | null) ?? null;
  const slug = ((ev?.slug as string | null) ?? '').trim();
  if (key && slug) {
    await rememberRequestKey(key);
    redirect(`/${slug}/request?sent=1`);
  }
  const t = token ? `&token=${encodeURIComponent(token)}` : '';
  redirect(`/join/${eventId}?sent=1${t}`);
}

/**
 * A SIGNED-IN person on the join door. A seat the couple recorded under their
 * account's email → inside. Anyone else → a REQUEST (never an admission).
 *
 * The door is open ONLY when the couple chose "Who can RSVP? → Anyone, I
 * approve" — a poster token no longer opens it (owner ruling 2026-09-27).
 */
export async function joinEventAction(eventId: string, token: string, formData: FormData) {
  // 🔒 ROLE IS THE HOST'S FIELD — see the header. Any `role` a stale form posts is ignored.
  const role: GuestRole = 'guest';

  const admin = createAdminClient();

  // 🔒 PRIVATE EVENTS REFUSE SELF-JOIN (added 2026-08-06). A page gate is not
  // an API gate — a server action can be invoked directly — so the same rule
  // holds HERE, through the SAME resolver the guest site uses.
  const { data: visRow } = await admin
    .from('events')
    .select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at, rsvp_ask_config')
    .eq('event_id', eventId)
    .maybeSingle();

  // 🛑 B1(b) — a private event is a DIFFERENT refusal from a dead token.
  // `!visRow` (event gone / unreadable) keeps `invalid_token`; it fails closed.
  if (!visRow) {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=invalid_token`);
  }
  // 🚪 "Only my Guest List" has no ask-to-join ANYWHERE (owner ruling
  // 2026-09-27) — a poster token included. The event's own door is Sign in or
  // Upload your QR. The slug comes from the DATABASE, never the form.
  if (!anyoneMayAskToJoin(visRow.rsvp_ask_config)) {
    const home = ((visRow.slug as string | null) ?? '').trim() || null;
    return redirect(selfJoinRefusalPath({ eventId, token, slug: home, error: GUEST_LIST_ONLY }));
  }
  if (resolveEffectiveVisibility(visRow) === 'private') {
    return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=event_is_private`);
  }

  // Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const back = token ? `/join/${eventId}?token=${token}` : `/join/${eventId}`;
    return redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  // Already a member? The couple goes to their dashboard; a guest walks in.
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
    const dest = await enterAsGuest(admin, eventId, user.id);
    return redirect(dest ?? `/join/${eventId}/success?token=${encodeURIComponent(token)}`);
  }

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  const accountEmail = user.email && !isPlaceholderEmail(user.email) ? user.email : null;

  // EXACT-EMAIL fast path — the couple recorded this address on a guest they
  // put on the list, and the sign-in proved the inbox. Only `host_seeded` rows:
  // a request carries an address its asker typed themselves.
  if (accountEmail) {
    const { data: emailSeed } = await admin
      .from('guests')
      .select('guest_id, role, extra_roles, entry_source')
      .eq('event_id', eventId)
      .eq('entry_source', 'host_seeded')
      .ilike('email', accountEmail)
      .is('deleted_at', null)
      .maybeSingle();

    if (
      emailSeed &&
      emailMayBindRow(emailSeed.entry_source as string) &&
      // 🔒 A COUPLE SEAT IS NEVER BOUND BY A GUEST DOOR (lib/seat-binding.ts).
      // The address on it can be one a key-holder typed into the reply form;
      // a couple member never reaches this line (they returned above).
      !isCoupleSeat(emailSeed.role as string | null, emailSeed.extra_roles as string[] | null) &&
      !(await seedClaimedByOther(admin, eventId, emailSeed.guest_id, user.id))
    ) {
      if (avatarUrl) await applyAvatar(admin, emailSeed.guest_id as string, avatarUrl, user.id);
      const err = await bindMemberToSeed(admin, {
        eventId,
        userId: user.id,
        guestId: emailSeed.guest_id as string,
        seedRole: emailSeed.role as GuestRole,
      });
      if (!err) {
        const dest = await enterAsGuest(admin, eventId, user.id);
        return redirect(dest ?? `/join/${eventId}/success?token=${encodeURIComponent(token)}`);
      }
      // A race lost the seat → fall through to a request.
    }
  }

  // Everyone else → a REQUEST. Nothing is bound; the couple decides.
  const read = readRequestAnswers(formData, sanitizeRsvpAskConfig(visRow.rsvp_ask_config), accountEmail);
  if (!read.ok) return backToDoor(eventId, token, read.error);

  const throttle = await allowGuestSelfJoinAttempt(eventId, await headers());
  if (!throttle.allowed) return backToDoor(eventId, token, 'too_many_attempts');

  const requestId = await createJoinRequest(admin, {
    eventId,
    answers: (read as { ok: true; value: RequestAnswers }).value,
    role,
    userId: user.id,
    avatarUrl,
  });
  if (!requestId) return backToDoor(eventId, token, 'join_failed');
  return requestSent(admin, eventId, token, requestId);
}

/**
 * A person WITHOUT an account on the join door (owner 2026-06-20: no account
 * needed). They type their name — the guest list is never shown — answer the
 * RSVP and leave a contact, and that is a REQUEST: no guest session is minted,
 * so nothing opens until the couple Accepts or Links them. Their key is handed
 * over on Send (remembered in this browser; 📵 nothing is emailed — 2026-09-29)
 * and it unlocks the moment the couple accepts.
 *
 * The one arrival that still walks straight on is a device that already HOLDS
 * a key for this event (its guest session) — that person goes to Reply.
 */
export async function selfJoinAction(eventId: string, token: string, formData: FormData) {
  // 🔒 Always `guest` — see joinEventAction. The door no longer offers a role.
  const role: GuestRole = 'guest';

  const admin = createAdminClient();
  // The event's public address, read FIRST so every refusal below can send the
  // guest back to the door they came through, with its sentence — see
  // `selfJoinRefusalPath`. From the DATABASE, never the form.
  const { data: event } = await admin
    .from('events')
    .select('slug, rsvp_ask_config')
    .eq('event_id', eventId)
    .maybeSingle();
  const slug = ((event?.slug as string | null) ?? '').trim() || null;
  const refuse = (error: string) =>
    redirect(selfJoinRefusalPath({ eventId, token, slug, error }));

  if (!String(formData.get('name') ?? '').trim()) {
    return backToDoor(eventId, token, 'missing_name');
  }

  // 1. The door: the couple chose "Who can RSVP? → Anyone, I approve", and
  //    even then this can only ever produce a REQUEST.
  // 🚪 "Only my Guest List" has no ask-to-join ANYWHERE (owner ruling
  // 2026-09-27) — a poster token included: the event's own door is Sign in or
  // Upload your QR. An unreadable event fails closed.
  if (!anyoneMayAskToJoin(event?.rsvp_ask_config)) {
    // → the event page itself (selfJoinRefusalPath), or, with no public
    // address yet, back to this door with the code.
    return refuse(GUEST_LIST_ONLY);
  }

  // 🚦 THE THROTTLE (2026-08-06). AFTER the door check so a junk token cannot
  // spend a real guest's budget, and BEFORE any write so a script cannot fill
  // SELF_JOIN_CEILING and close the door for every later visitor.
  const throttle = await allowGuestSelfJoinAttempt(eventId, await headers());
  if (!throttle.allowed) {
    return refuse('too_many_attempts');
  }

  // 🔒 PRIVATE EVENTS REFUSE SELF-JOIN (added 2026-08-06) — same resolver as
  // the guest site, so a scheduled launch that has come due counts as public in
  // both places.
  const { data: visRow } = await admin
    .from('events')
    .select('landing_page_visibility, scheduled_launch_at, std_launched_at')
    .eq('event_id', eventId)
    .maybeSingle();

  // 🛑 B1(b) — an unreadable event keeps `invalid_token` (fails closed); a
  // private event gets its own code and its own sentence.
  if (!visRow) {
    return refuse('invalid_token');
  }
  if (resolveEffectiveVisibility(visRow) === 'private') {
    return refuse('event_is_private');
  }

  // 2. The accountless guest's pages live under the public `/[slug]`, so this
  //    only makes sense when a slug exists. Fall back to the sign-in route.
  if (!slug) {
    const back = token ? `/join/${eventId}?token=${token}` : `/join/${eventId}`;
    return redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  // 2b. This device already SENT a request here → its screen, not a second one.
  //     A pending key re-asks (updates the one row, below); an accepted, linked
  //     or declined one has its answer waiting on its own screen.
  const remembered = await readRememberedRequest(eventId);
  if (remembered && remembered.state.kind !== 'pending' && remembered.state.kind !== 'none') {
    return redirect(`/${slug}/request`);
  }

  // 3. This device already HOLDS a key for this event → straight on to Reply.
  //    (The key was issued by the couple — a personal link, a kept request, or
  //    a guest added before 2026-09-27 — never by this form.)
  const existingSession = await readGuestSession();
  if (existingSession && existingSession.event_id === eventId) {
    return redirect(inviteReplyPath(slug));
  }

  // 4. Sanity ceiling on requests for this event.
  const { count } = await admin
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('entry_source', 'self_added_unlisted')
    .is('deleted_at', null);
  if ((count ?? 0) >= SELF_JOIN_CEILING) {
    return refuse('join_closed');
  }

  // 5. The request. The name only ever SUGGESTS a match to the couple — it
  //    never hands this browser another guest's seat (a name is not a secret).
  const read = readRequestAnswers(formData, sanitizeRsvpAskConfig(event?.rsvp_ask_config));
  if (!read.ok) return backToDoor(eventId, token, read.error);

  const requestId = await createJoinRequest(admin, {
    eventId,
    answers: (read as { ok: true; value: RequestAnswers }).value,
    role,
    userId: null,
    avatarUrl: null,
    rememberedRequestId: remembered?.state.kind === 'pending' ? remembered.guestId : null,
  });
  if (!requestId) {
    return refuse('join_failed');
  }
  // The generic QR's name step is finished with (lib/find-me.server.ts).
  await forgetFindState();
  return requestSent(admin, eventId, token, requestId);
}
