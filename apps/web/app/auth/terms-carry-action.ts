'use server';

/**
 * carrySignupTerms — the Terms tick on the sign-up card, carried to the Google / Apple callback (owner 2026-10-22,
 * Host 1 option B, prototype `journey_fixes_2026-10-22.html`).
 *
 * The card has ONE box above all three doors. The email door posts it with its form; Google and Apple leave the
 * page for the provider, so the agreement has to travel — exactly as the RSVP page's tick travels
 * (`RSVP_TERMS_COOKIE`): an httpOnly cookie, set HERE by the server, from the posted tick, and nothing else.
 * `app/auth/callback` records it on the account and spends the cookie.
 *
 * 🔑 THE OAUTH `state` PARAMETER CANNOT CARRY IT. Supabase's auth server writes its own `state` on the provider
 * redirect and consumes it on its own callback; our `/auth/callback` only ever receives `?code=` plus whatever was
 * on `redirectTo`. And a `redirectTo` query param is a URL anyone can type — the agreement would be a claim, not an
 * act. So the cookie pattern the callback already reads.
 *
 * ⚠ FAILS CLOSED: no affirmative tick posted → the cookie is CLEARED, never set. An unticked HTML checkbox posts
 * nothing at all, and nothing is a refusal (`hasAgreedToTerms`).
 */
import { cookies } from 'next/headers';
import {
  SIGNUP_TERMS_COOKIE,
  SIGNUP_TERMS_COOKIE_MAX_AGE,
  SIGNUP_TERMS_COOKIE_PATH,
  TERMS_FIELD,
  TERMS_VERSION,
  hasAgreedToTerms,
} from '@/lib/terms-agreement';

export async function carrySignupTerms(formData: FormData): Promise<{ carried: boolean }> {
  const jar = await cookies();
  if (!hasAgreedToTerms(formData.get(TERMS_FIELD))) {
    jar.set(SIGNUP_TERMS_COOKIE, '', { path: SIGNUP_TERMS_COOKIE_PATH, maxAge: 0 });
    return { carried: false };
  }
  jar.set(SIGNUP_TERMS_COOKIE, TERMS_VERSION, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: SIGNUP_TERMS_COOKIE_PATH,
    maxAge: SIGNUP_TERMS_COOKIE_MAX_AGE,
  });
  return { carried: true };
}
