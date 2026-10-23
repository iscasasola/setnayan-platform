import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GUEST_PASS_BOOK_COOKIE_NAME, GUEST_SESSION_COOKIE_NAME, readEveryGuestPass } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eraseFaceTaggingSelfie, eraseFaceTaggingSelfiesForUser } from '@/lib/face-selfie-erase';
import { RSVP_TERMS_COOKIE } from '@/lib/terms-agreement';
import { HOST_PREVIEW_PASS_COOKIE_NAME } from '@/lib/pass-account-rule';
import { ACTIVE_SHOP_COOKIE } from '@/lib/active-shop';
import { ACCOUNTS_LIST_COOKIE, accountCookiesOnSignOut } from '@/lib/account-jars';

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
  // EVERY pass this browser holds — one per event since 2026-10-12 (lib/guest-pass-book.ts).
  const passes = await readEveryGuestPass().catch(() => []);
  const admin = createAdminClient();
  if (leaving) await eraseFaceTaggingSelfiesForUser(admin, leaving.id).catch(() => 0);
  for (const pass of passes) {
    if (pass.event_id && pass.guest_id) {
      await eraseFaceTaggingSelfie(admin, pass.event_id, pass.guest_id).catch(() => null);
    }
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
  // "Sign out everywhere": the active pass AND the pass book (every event's pass).
  // The chosen shop (`sn_shop`, the avatar sheet's shop switch) goes too — it named one of THIS login's shops.
  for (const name of [GUEST_SESSION_COOKIE_NAME, GUEST_PASS_BOOK_COOKIE_NAME, RSVP_TERMS_COOKIE, HOST_PREVIEW_PASS_COOKIE_NAME, ACTIVE_SHOP_COOKIE]) {
    response.cookies.set(name, '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  // 🔁 OTHER ACCOUNTS ON THIS PHONE: signing out of the account you are on REMOVES it from the phone (owner's
  // Question 1 recommendation, Facebook's "Log out of Claire") — its row leaves the list and any jar it had is
  // expired (by name: the jar lives at /auth/accounts, so it is not sent here, but it can still be expired here).
  // The OTHER parked accounts stay; "Sign out of all accounts" is the one that clears them.
  // 🔒 One login on this phone (no accounts list) → `accountCookiesOnSignOut` answers nothing: the response is the
  // sign-out it always was. Held by lib/accounts-on-this-phone.test.ts.
  for (const c of accountCookiesOnSignOut(request.cookies.get(ACCOUNTS_LIST_COOKIE)?.value, leaving?.id, process.env.NODE_ENV === 'production')) {
    response.cookies.set(c.name, c.value, c.options);
  }

  return response;
}
