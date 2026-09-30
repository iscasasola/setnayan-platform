import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GUEST_SESSION_COOKIE_NAME } from '@/lib/guest-session';
import { RSVP_TERMS_COOKIE } from '@/lib/terms-agreement';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL('/', request.url), { status: 303 });

  // Explicitly clear every sb-* cookie on the redirect response.
  // createClient() uses cookies() from next/headers; in Route Handlers those
  // mutations don't automatically carry onto an explicit NextResponse object,
  // so the session cookies can survive into the next request and the middleware's
  // updateSession() still sees a valid user — which bounces the user back to
  // /dashboard instead of the homepage. Clearing them here on the response
  // guarantees the browser sends no auth cookies on the GET /.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }
  }

  // 🔒 THE GUEST PASS GOES WITH THE ACCOUNT (2026-09-30 — the owner's own
  // wedding). `setnayan_guest_session` is a 60-day pass naming one seat, and it
  // is not an `sb-*` cookie — so signing out used to leave it behind, and the
  // next person to use this phone inherited that invitation (a test account
  // became the owner's GROOM this way). Signing out now leaves the browser
  // holding nothing of the last person's. Held by
  // seat-links-only-on-purpose.test.ts. The Terms tick a guest carried from the
  // RSVP page goes too — it was that person's agreement, not the next one's.
  for (const name of [GUEST_SESSION_COOKIE_NAME, RSVP_TERMS_COOKIE]) {
    response.cookies.set(name, '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  return response;
}
