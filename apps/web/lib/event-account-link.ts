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
  //    ignore (generateLink below works for the existing user). The
  //    on_auth_user_created trigger creates the public.users row (account_type
  //    customer) for brand-new users.
  await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { account_type: 'customer' },
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
    const viaCookie = await linkGuestSessionToUser(userId);
    if (viaCookie.linked || viaCookie.reason === 'guest_already_claimed') {
      return { connected: true };
    }

    const admin = createAdminClient();

    // Already a member of this event (e.g. a second click of the link)?
    const { data: existing } = await admin
      .from('event_members')
      .select('member_id')
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
        joined_via: 'email_link',
      },
      { onConflict: 'event_id,user_id', ignoreDuplicates: true },
    );
    return { connected: !error };
  } catch {
    return { connected: false };
  }
}
