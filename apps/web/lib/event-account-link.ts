import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { linkGuestSessionToUser } from '@/lib/link-guest-account';

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
}): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const email = params.email.trim();
  if (!email) return { ok: false };

  // 1. Stamp the email on the guest row (couple contact + the cross-device
  //    email-match key). Best-effort: only fills a NULL email so we never clobber
  //    a different address the couple already recorded for that seat.
  await admin
    .from('guests')
    .update({ email, updated_at: new Date().toISOString() })
    .eq('guest_id', params.guestId)
    .eq('event_id', params.eventId)
    .is('email', null);

  // 2. Ensure an auth user exists for this email. createUser is idempotent for
  //    our purposes — if the address is already registered it errors, which we
  //    ignore (generateLink below works for the existing user, and we DON'T
  //    touch their metadata so an existing account is never re-flagged). The
  //    on_auth_user_created trigger creates the public.users row (account_type
  //    customer) for brand-new users. `needs_password: true` marks the
  //    passwordless account so the connect route prompts them to set one on first
  //    sign-in — OAuth (Apple/Google) accounts are never created here, so they're
  //    never flagged and keep using their provider.
  await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { account_type: 'customer', needs_password: true },
  });

  // 3. Generate a magic login link (does NOT send email). redirectTo lands on
  //    /auth/callback (PKCE exchange) → the event-connect route.
  const next = `/join/${params.eventId}/connect`;
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
 * Connect an event to the signed-in user, creating the `event_members` row that
 * makes the event show in their picker. Two authorizations, in order:
 *   1. the SIGNED guest-session cookie (same browser) — reuses
 *      linkGuestSessionToUser, the canonical binder;
 *   2. an EMAIL match (cross-device) — the magic link proved the user owns this
 *      email, so an unclaimed seed row in THIS event with the same email is theirs.
 * Never throws — callers are post-auth routes where a throw would 500 the login.
 */
export async function connectEventForUser(
  eventId: string,
  userId: string,
  userEmail: string | null,
): Promise<{ connected: boolean }> {
  try {
    // 1. Cookie path (same browser).
    //
    // 🚨 THIS REPORTED SUCCESS FOR THE WRONG EVENT. `linkGuestSessionToUser`
    // links whatever event the BROWSER'S guest cookie names — which need not be
    // the `eventId` this call was asked about — and `guest_already_claimed` links
    // nothing at all. Both were returned as `connected: true`, so the couple's
    // "send them a sign-in link" could report a connection it had not made, and
    // the caller then sent the person to an event they hold no seat on.
    //
    // The fix is to answer the question that was ASKED: is this user a member of
    // THIS event now? The membership read below already exists for the
    // second-click case; it is simply consulted before believing the cookie.
    const viaCookie = await linkGuestSessionToUser(userId);
    const admin = createAdminClient();
    if (viaCookie.linked || viaCookie.reason === 'guest_already_claimed') {
      const { data: forThisEvent } = await admin
        .from('event_members')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      if (forThisEvent) return { connected: true };
      // The cookie belonged to a different wedding (or claimed nothing). Fall
      // through to the email-match path, which is scoped to THIS event.
    }

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

    // 2. Email-match fallback (cross-device). The magic link authenticated this
    //    address, so an unclaimed seed row for this event with the same email is
    //    theirs to bind.
    if (!userEmail) return { connected: false };
    const { data: guest } = await admin
      .from('guests')
      .select('guest_id, role')
      .eq('event_id', eventId)
      .ilike('email', userEmail)
      .is('deleted_at', null)
      .maybeSingle();
    if (!guest) return { connected: false };

    // Don't hijack a seat already bound to a different account.
    const { data: bound } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('guest_id', guest.guest_id)
      .maybeSingle();
    if (bound && bound.user_id !== userId) return { connected: false };

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
    return { connected: !error };
  } catch {
    return { connected: false };
  }
}
