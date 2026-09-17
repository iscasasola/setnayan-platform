/**
 * /auth/confirm — completes an email link in ANY browser.
 *
 * The sibling of /auth/callback, and deliberately NOT a change to it:
 *   - /auth/callback exchanges a `?code=` (PKCE). It needs the code verifier
 *     cookie, so it only completes in the browser that started the flow. That
 *     is correct for OAuth and for a magic link the person clicks where they
 *     asked for it.
 *   - THIS route verifies a `token_hash` (`verifyOtp`). The whole proof is in
 *     the URL, nothing is read from client storage, so it completes on any
 *     device.
 *
 * 🔑 PASSWORD RECOVERY CANNOT USE THE FIRST ONE. Somebody locked out asks on
 * their laptop and opens the mail on their phone. Measured on production
 * 2026-09-18, /auth/callback answered that with
 * `?error=PKCE code verifier not found in storage…` — see lib/auth-confirm-link.ts.
 *
 * ⚠ THIS ROUTE ESTABLISHES A SESSION FROM A GET. That is inherent to email
 * links (so does /auth/callback). What keeps it safe is that the token is
 * single-use, short-lived, minted only by us, and `type` is checked against an
 * allowlist rather than passed through.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { stampLastLogin } from '@/lib/login-activity';
import { parseConfirmOtpType } from '@/lib/auth-confirm-link';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  // An UNRECOGNISED type is refused, never defaulted — see parseConfirmOtpType.
  const type = parseConfirmOtpType(url.searchParams.get('type'));
  // Same open-redirect guard every other auth door uses.
  const next = safeNext(url.searchParams.get('next'));

  if (!tokenHash || !type) {
    // No proof on the link at all. Say the true thing — a link this shape is
    // either truncated by a mail client or already stripped — and send them to
    // the one control that fixes it.
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          'That link is incomplete. Request a new one and open it directly from the email.',
        )}`,
        url.origin,
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    // 🚨 THE RAW MESSAGE IS NOT SHOWN. humanAuthError() at the render decides
    // what a person reads; this only carries it. That gate is what stopped a
    // Supabase SDK paragraph about `@supabase/ssr` reaching the sign-in card.
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  await stampLastLogin(supabase);
  return NextResponse.redirect(new URL(next, url.origin));
}
