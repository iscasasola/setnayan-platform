import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import {
  fillAccountNameFromSeat,
  isCoupleMember,
  linkGuestSessionToUser,
} from '@/lib/link-guest-account';
import { TERMS_VERSION } from '@/lib/terms-agreement';
import { readGuestSession } from '@/lib/guest-session';
import {
  isCoupleSeat,
  seatBindRefusal,
  seatDisplayName,
  type SeatBindRefusal,
} from '@/lib/seat-binding';
import { coupleSentThisSeatLink, signCoupleSeatLink } from '@/lib/seat-link-approval';

/**
 * Invite/Join v2 — email-link → real Setnayan account (0000 ADDENDUM 2026-06-25).
 *
 * The bridge that turns a name-on-a-list (an accountless guest with a signed
 * guest-session cookie) into a real, loginable Setnayan account with THIS event
 * already attached. The guest enters their email → we email them a passwordless
 * sign-in link → on click they're authenticated and the event is connected, so
 * it shows in their event picker and they can sign in from any device.
 *
 * Why the admin API + Resend (not supabase.auth.signInWithOtp): this codebase
 * sends transactional email through Resend because Supabase's built-in mailer is
 * rate-limited + spam-prone here (see signup/actions.ts). So we GENERATE the
 * magic link with the admin API (which doesn't send mail) and deliver it via
 * Resend ourselves.
 */

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Email a passwordless sign-in link that lands the guest on the event-connect
 * route. Stamps the email onto the guest row first so the cross-device
 * email-match in connectEventForUser() can bind even without the cookie.
 */
export async function sendEventAccountMagicLink(params: {
  eventId: string;
  guestId: string;
  email: string;
  /**
   * The guest TICKED "keep this invitation · I agree to the Terms" (the reply
   * form or the one account card). Recorded on the account this call creates —
   * the same two columns `/signup` writes (lib/terms-agreement.ts). Absent for
   * the doors that do not ask (the host's "send them a link"), which record
   * nothing rather than an agreement nobody made.
   */
  termsAgreed?: boolean;
  /**
   * The COUPLE pressed "send them a sign-in link" on this row's own guest card
   * (`inviteGuestByEmailAction`). Signs the return so a couple seat — which no
   * guest link may bind (lib/seat-binding.ts) — can be kept by the account this
   * address belongs to. Absent on every guest-side door.
   */
  sentByCouple?: boolean;
}): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const email = params.email.trim();
  if (!email) return { ok: false };

  // 1. Stamp the email on the guest row (couple contact + the cross-device
  //    email-match key). Best-effort: only fills a NULL email so we never clobber
  //    a different address the couple already recorded for that seat.
  //    🔒 NEVER onto a COUPLE row from a guest door (2026-09-30): an address
  //    typed by whoever holds the bride / groom / celebrant key would point the
  //    row's person at their account (`set_guest_person`). Only the couple's own
  //    "send them a sign-in link" (`sentByCouple`) may stamp it.
  const { data: seatRow } = await admin
    .from('guests')
    .select('role, extra_roles')
    .eq('guest_id', params.guestId)
    .eq('event_id', params.eventId)
    .maybeSingle();
  const coupleRow = !seatRow || isCoupleSeat(seatRow.role as string | null, seatRow.extra_roles as string[] | null);
  if (!coupleRow || params.sentByCouple) {
    await admin
      .from('guests')
      .update({ email, updated_at: new Date().toISOString() })
      .eq('guest_id', params.guestId)
      .eq('event_id', params.eventId)
      .is('email', null);
  }

  // 2. Ensure an auth user exists for this email. createUser is idempotent for
  //    our purposes — if the address is already registered it errors, which we
  //    ignore (generateLink below works for the existing user, and we DON'T
  //    touch their metadata so an existing account is never re-flagged). The
  //    on_auth_user_created trigger creates the public.users row (account_type
  //    customer) for brand-new users. `needs_password: true` marks the
  //    passwordless account so the connect route prompts them to set one on first
  //    sign-in — OAuth (Apple/Google) accounts are never created here, so they're
  //    never flagged and keep using their provider.
  const { data: created } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { account_type: 'customer', needs_password: true },
  });

  // 2b. The agreement, on the account it was given for — ONLY a brand-new one
  //     (an existing account agreed when it was made; its record is not ours to
  //     rewrite). Best-effort: a missed stamp must never cost the guest the link.
  const newUserId = created?.user?.id;
  if (params.termsAgreed && newUserId) {
    await recordTermsForNewAccount(admin, newUserId);
  }

  // 3. Generate a magic login link (does NOT send email). redirectTo lands on
  //    /auth/callback (PKCE exchange) → the event-connect route.
  const approval = params.sentByCouple
    ? await signCoupleSeatLink({ eventId: params.eventId, guestId: params.guestId, email })
    : null;
  const next = `/join/${params.eventId}/connect${
    approval ? `?approved=${encodeURIComponent(approval)}` : ''
  }`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  const actionLink = data?.properties?.action_link;
  if (error || !actionLink) return { ok: false };

  // 4. Deliver via Resend.
  const result = await sendEmail({
    to: email,
    subject: 'Your Setnayan sign-in link',
    text: [
      `Tap the link below to sign in to Setnayan — your event is already waiting on`,
      `your account, on any device:`,
      ``,
      actionLink,
      ``,
      `If you didn't request this, you can safely ignore it.`,
      ``,
      `—`,
      `Set na 'yan.`,
    ].join('\n'),
  });

  return { ok: result.ok };
}

/**
 * Stamp `terms_accepted_at` + `terms_version` on a brand-new account's
 * `public.users` row. The row is made by the `on_auth_user_created` trigger on
 * another connection, so an UPDATE fired immediately can match zero rows — the
 * same race `signUp` polls through. Never throws.
 */
async function recordTermsForNewAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<void> {
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: row } = await admin
        .from('users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (row) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const { error } = await admin
      .from('users')
      .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
      .eq('user_id', userId)
      .is('terms_accepted_at', null);
    if (error) console.error('[supabase-error] lib/event-account-link.ts · from:users.update', error);
  } catch {
    // Best-effort by contract — see the caller.
  }
}

/** A seat this account could be bound to on this event, found — never bound — here. */
export type SeatToConnect = {
  guestId: string;
  /** The name the couple put on the row (`seatDisplayName`). */
  name: string;
  role: string | null;
  /** How the seat was found: this browser's guest pass, or the account's email. */
  via: 'cookie' | 'email';
  /** Non-null → this account may not hold it (`lib/seat-binding.ts`). */
  refusal: SeatBindRefusal;
};

/**
 * WHICH SEAT WOULD THIS ACCOUNT BE BOUND TO? Read-only — the confirm page
 * (`/join/{id}/connect/confirm`) asks the person about exactly this seat, and
 * `connectEventForUser` binds only the seat whose id came back from that page.
 *
 * Two authorizations, in order, both scoped to THIS event:
 *   1. the SIGNED guest pass in this browser — only when it names this event
 *      (the old binder linked whatever event the cookie named);
 *   2. an EMAIL match (cross-device) — the magic link proved the inbox, so a
 *      row in THIS event carrying that address is theirs to be ASKED about.
 * A row already held by a different account is never offered.
 */
export async function findSeatToConnect(
  eventId: string,
  userId: string,
  userEmail: string | null,
  coupleApproval: string | null = null,
  /** Marked when a row this account reached for is held by ANOTHER account (`seatHeldElsewhere`). */
  report?: { heldElsewhere: boolean },
): Promise<SeatToConnect | null> {
  try {
    const admin = createAdminClient();
    const heldByOther = async (guestId: string) => {
      const { data: bound } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .maybeSingle();
      const other = Boolean(bound && bound.user_id !== userId);
      if (other && report) report.heldElsewhere = true;
      return other;
    };
    const shape = async (
      row: Record<string, unknown>,
      via: 'cookie' | 'email',
    ): Promise<SeatToConnect> => {
      const guestId = row.guest_id as string;
      const role = (row.role as string | null) ?? null;
      const extra = (row.extra_roles as string[] | null) ?? null;
      const refusal = isCoupleSeat(role, extra)
        ? seatBindRefusal({
            seatRole: role,
            seatExtraRoles: extra,
            accountIsCouple: await isCoupleMember(admin, eventId, userId),
            // Only the EMAIL path can carry the couple's own link; a guest pass
            // in a browser is never the couple's choice.
            coupleSentTheLink:
              via === 'email' &&
              (await coupleSentThisSeatLink(coupleApproval, { eventId, guestId, email: userEmail })),
          })
        : null;
      return {
        guestId,
        name: seatDisplayName(row as { display_name?: string; first_name?: string; last_name?: string }),
        role,
        via,
        refusal,
      };
    };
    const COLUMNS = 'guest_id, event_id, role, extra_roles, display_name, first_name, last_name';

    // 1. This browser's guest pass — for THIS event only.
    const session = await readGuestSession();
    if (session && session.event_id === eventId) {
      const { data: row } = await admin
        .from('guests')
        .select(COLUMNS)
        .eq('guest_id', session.guest_id)
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .maybeSingle();
      if (row && !(await heldByOther(row.guest_id as string))) return await shape(row, 'cookie');
    }

    // 2. The account's email, on a row of THIS event.
    if (!userEmail) return null;
    const { data: row } = await admin
      .from('guests')
      .select(COLUMNS)
      .eq('event_id', eventId)
      .ilike('email', userEmail)
      .is('deleted_at', null)
      .maybeSingle();
    if (!row || (await heldByOther(row.guest_id as string))) return null;
    return await shape(row, 'email');
  } catch {
    return null;
  }
}

/**
 * 🔒 ONE INVITATION, ONE ACCOUNT (owner 2026-10-01): *"if someone tries to sync
 * it to a different email. they cannot. we will say this event QR is already
 * assigned to someone."* True when there is NO seat to offer this account here
 * BECAUSE the one it reached for — this browser's guest pass for this event, or
 * the row carrying its email — is already held by a DIFFERENT account. The
 * connect route then lands them on the confirm page, which says so
 * (`SEAT_HELD_ELSEWHERE`) instead of dropping them on an unexplained home.
 * Read-only — the same lookup as `findSeatToConnect`, never a second one.
 */
export async function seatHeldElsewhere(
  eventId: string,
  userId: string,
  userEmail: string | null,
  coupleApproval: string | null = null,
): Promise<boolean> {
  const report = { heldElsewhere: false };
  const seat = await findSeatToConnect(eventId, userId, userEmail, coupleApproval, report);
  return !seat && report.heldElsewhere;
}

/**
 * Connect an event to the signed-in user, creating the `event_members` row that
 * makes the event show in their picker.
 *
 * 🔒 BINDS ONLY WHAT WAS CONFIRMED (2026-09-30). Without `confirmedGuestId` this
 * binds NOTHING — it only answers "is this account already inside?". With it,
 * it binds that one seat and only if `findSeatToConnect` still finds exactly
 * that seat, un-refused. The id comes from the confirm page, where the person
 * was shown "This invitation is for <name>. Save it to <email>?" and pressed
 * Yes — so a stale guest pass on a shared phone can no longer turn a sign-in
 * into somebody else's seat.
 * Never throws — callers are post-auth routes where a throw would 500 the login.
 */
export async function connectEventForUser(
  eventId: string,
  userId: string,
  userEmail: string | null,
  opts: { confirmedGuestId?: string | null; coupleApproval?: string | null } = {},
): Promise<{ connected: boolean }> {
  try {
    const admin = createAdminClient();

    // Already a member of this event (e.g. a second click of the link)?
    // ⚠ `id`, NOT `member_id` — public.event_members' primary key is `id`.
    // PostgREST 42703s the whole query, so this "already a member?" short-circuit
    // NEVER fired: a returning user re-clicking their magic link fell through to
    // the email-match path and was reported `connected: false` whenever their
    // guest row had no matching email.
    const { data: existing } = await admin
      .from('event_members')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return { connected: true };

    const confirmed = opts.confirmedGuestId ?? null;
    if (!confirmed) return { connected: false };
    const seat = await findSeatToConnect(eventId, userId, userEmail, opts.coupleApproval ?? null);
    if (!seat || seat.guestId !== confirmed || seat.refusal) return { connected: false };

    // 1. Cookie path (same browser).
    //
    // 🚨 THIS ONCE REPORTED SUCCESS FOR THE WRONG EVENT. `linkGuestSessionToUser`
    // used to link whatever event the BROWSER'S guest cookie named — which need
    // not be the `eventId` this call was asked about — and `guest_already_claimed`
    // links nothing at all. It is now told the event AND the confirmed row, and
    // the membership for THIS event is still what decides the answer.
    if (seat.via === 'cookie') {
      const viaCookie = await linkGuestSessionToUser(userId, { eventId, guestId: seat.guestId });
      if (viaCookie.linked || viaCookie.reason === 'guest_already_claimed') {
        const { data: forThisEvent } = await admin
          .from('event_members')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .maybeSingle();
        if (forThisEvent) return { connected: true };
      }
      return { connected: false };
    }

    // 2. Email-match path (cross-device), the confirmed row only.
    const { data: guest } = await admin
      .from('guests')
      .select('guest_id, role')
      .eq('guest_id', seat.guestId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!guest) return { connected: false };

    const { error } = await admin.from('event_members').upsert(
      {
        event_id: eventId,
        user_id: userId,
        member_type: 'guest',
        guest_id: guest.guest_id as string,
        role: (guest.role as string) ?? 'guest',
        // 🔴 WAS `'email_link'` — A VALUE THE DATABASE DOES NOT HAVE.
        // `join_method` is an enum of exactly six labels (qr_scan · invited ·
        // created_event · admin_added · invite_claim · guest_signup) and
        // `email_link` is not one of them, so Postgres REJECTED this insert
        // every single time. The rejection lands in `error`, `connected: !error`
        // returns false, and the outer try/catch would have swallowed a throw
        // too — so a guest who signed in from a NEW PHONE was never attached to
        // the celebration, saw no error, and landed on an empty home page.
        //
        // 🔑 Same disease as the phantom column, the phantom RPC argument and
        // the payments duplicate-guard that queried a status enum value that did
        // not exist: THE QUERY IS REJECTED, NOT THROWN, and the only symptom is
        // an absence.
        //
        // `guest_signup` is the correct label, not a nearest-fit: it is what the
        // SAME act writes on the same device (lib/link-guest-account.ts, a guest
        // who scans then makes an account). This path is that person without the
        // cookie, so recording it as a different kind of joining would split one
        // behaviour across two labels.
        joined_via: 'guest_signup',
      },
      { onConflict: 'event_id,user_id', ignoreDuplicates: true },
    );
    if (!error) await fillAccountNameFromSeat(admin, userId, guest.guest_id as string);
    return { connected: !error };
  } catch {
    return { connected: false };
  }
}
