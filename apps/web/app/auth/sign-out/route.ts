import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GUEST_SESSION_COOKIE_NAME, readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eraseFaceTaggingSelfie, eraseFaceTaggingSelfiesForUser } from '@/lib/face-selfie-erase';
import { RSVP_TERMS_COOKIE } from '@/lib/terms-agreement';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 🧽 SIGNING OUT ERASES THE FACE-TAGGING SELFIE (owner 2026-09-30: *"face
  // tagging selfie will erase upon log out"*) — at every event whose seat this
  // account holds, and for the invitation pass this browser carries (it is
  // cleared below). Read BEFORE the session ends: afterwards nothing names
  // whose selfie it was. Tags already made stay (lib/face-selfie-erase.ts).
  // Best-effort — an erase that fails never keeps anyone signed in.
  const {
    data: { user: leaving },
  } = await supabase.auth.getUser();
  const pass = await readGuestSession().catch(() => null);
  const admin = createAdminClient();
  if (leaving) await eraseFaceTaggingSelfiesForUser(admin, leaving.id).catch(() => 0);
  if (pass?.event_id && pass.guest_id) {
    await eraseFaceTaggingSelfie(admin, pass.event_id, pass.guest_id).catch(() => null);
  }

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
