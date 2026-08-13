import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { connectEventForUser } from '@/lib/event-account-link';

/**
 * Post-magic-link destination (Invite/Join v2). The email sign-in link lands on
 * /auth/callback (PKCE exchange) → here, now authenticated. We connect the event
 * to this account (cookie path or email-match), then drop them into the event.
 *
 * 🔴 **AND FOR AS LONG AS IT HAS EXISTED, SUCCEEDING SENT THEM TO A 404.**
 * `connectEventForUser` writes `member_type: 'guest'`, and this route then
 * redirected to `/dashboard/{eventId}` — a layout that admits
 * `member_type = 'couple'` ONLY. So the better the connect went, the worse the
 * landing: the FAILURE branch (`/dashboard`) worked, and success did not.
 *
 * Reachable from four shipped places, and one of them is the couple themselves:
 * `dashboard/[eventId]/guests/[guestId]/actions.ts` (the host pressing "send
 * them a sign-in link" on their own guest list), the three scan-to-join branches
 * in `join/[eventId]/actions.ts`, and `app/[slug]/actions.ts`. An emailed link is
 * the likeliest path a real invited guest ever takes — likelier than a QR — and
 * it ended on "not found".
 *
 * 🔑 **THE FIX IS THE ONE GATE, NOT A SECOND COOKIE WRITE HERE.** Success now
 * hands them to `/{slug}/enter`, which re-mints their guest session from the
 * binding this route just created and lands them on the event's own page. This
 * is a Route Handler so a cookie write would be *legal* here — but checking the
 * same thing in two places is two chances to forget, and the next surface makes
 * three. See lib/guest-membership-session.ts.
 *
 * ⚠ An event with no public address yet cannot be opened by a guest at all, so
 * that case keeps the account home rather than inventing a destination.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const origin = new URL(request.url).origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Link expired / opened in a logged-out context → send to login, returning here.
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(`/join/${eventId}/connect`)}`, origin),
    );
  }

  const { connected } = await connectEventForUser(eventId, user.id, user.email ?? null);

  // Connected → into the event AS A GUEST, via the one gate that knows how to
  // recognise them (`/{slug}/enter`). NOT `/dashboard/{eventId}`, which is the
  // organiser's dashboard and 404s for the guest this route just created.
  //
  // The slug is read from the DATABASE, never built from the path — and a `null`
  // slug (a real prod state: 1 of 5 events) means there is no guest-facing page
  // to open, so they keep the account home, where their board now carries the
  // invited card. Failure keeps the account home for the same reason it always
  // did: the couple may still reconcile the seat, or the email matched nothing.
  let dest = '/dashboard';
  if (connected) {
    const { data: event } = await createAdminClient()
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    const slug = (event?.slug as string | null)?.trim();
    if (slug) dest = `/${slug}/enter`;
  }

  // Set-password gate (owner directive): a passwordless email-link account is
  // flagged needs_password at creation → prompt them to set one on first
  // sign-in, UNLESS they came in via Apple/Google (provider !== 'email'), who
  // keep using their OAuth provider. The flag is only ever set on accounts WE
  // created here, so OAuth accounts are inherently never gated.
  const provider = (user.app_metadata?.provider as string | undefined) ?? 'email';
  const needsPassword = user.user_metadata?.needs_password === true;
  if (needsPassword && provider === 'email') {
    return NextResponse.redirect(
      new URL(`/join/${eventId}/set-password?next=${encodeURIComponent(dest)}`, origin),
    );
  }

  return NextResponse.redirect(new URL(dest, origin));
}
