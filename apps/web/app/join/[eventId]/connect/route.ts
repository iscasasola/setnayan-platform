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

  // Connected → straight into the event; otherwise the account home (the event
  // may still be reconciled by the couple, or the email didn't match a seat).
  return NextResponse.redirect(
    new URL(connected ? `/dashboard/${eventId}` : '/dashboard', origin),
  );
}
