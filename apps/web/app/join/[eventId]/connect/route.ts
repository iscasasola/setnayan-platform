import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { connectEventForUser } from '@/lib/event-account-link';

/**
 * Post-magic-link destination (Invite/Join v2). The email sign-in link lands on
 * /auth/callback (PKCE exchange) → here, now authenticated. We connect the event
 * to this account (cookie path or email-match), then drop them into the event.
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

  // Connected → into the event; otherwise the account home (the event may still
  // be reconciled by the couple, or the email didn't match a seat).
  const dest = connected ? `/dashboard/${eventId}` : '/dashboard';

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
