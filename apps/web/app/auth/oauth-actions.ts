'use server';

/**
 * OAuth sign-in server actions for Google + Apple.
 *
 * WHY a shared module instead of duplicating in /login/actions.ts and
 * /signup/actions.ts: the OAuth flow is identical regardless of whether
 * the user enters via "Sign in" or "Create account" — Supabase auto-
 * creates the `auth.users` row on first OAuth callback if it doesn't
 * exist, and signs the existing one in otherwise. So one signInWithOAuth
 * server action handles both surfaces. The page-level actions.ts files
 * stay focused on the email + password variant.
 *
 * 2026-06-15 provider-set change (owner directive): the V1 OAuth set is
 * Google + Apple. Facebook OAuth login was removed and Apple was promoted
 * out of the V1.1 deferral. (Facebook *sharing* — lib/social/facebook.ts
 * et al. — is a separate feature and is untouched.)
 *
 * Flow:
 *   1. User clicks "Continue with Google" form button on /login or /signup
 *   2. This action calls supabase.auth.signInWithOAuth({ provider }) which
 *      returns a URL pointing at Google's OAuth consent screen
 *   3. We redirect the browser to that URL
 *   4. User completes consent on Google's side
 *   5. Google redirects to {NEXT_PUBLIC_APP_URL}/auth/callback?code=...&next=...
 *   6. The EXISTING /auth/callback/route.ts (unchanged) calls
 *      exchangeCodeForSession and redirects to `next`
 *
 * Provider config (owner-side, NOT in code):
 *   - Google: Supabase Studio → Auth → Providers → Google → toggle ON +
 *     paste Client ID + Client Secret from Google Cloud Console.
 *     Existing OAuth client from YouTube work can be reused — just need
 *     to add this app's /auth/callback URL to the Authorized redirect
 *     URIs list. See OWNER_ACTIONS.md.
 *   - Apple: Supabase Studio → Auth → Providers → Apple → toggle ON +
 *     paste Services ID (client id) + the generated client secret JWT
 *     from the Apple Developer portal. Gates on Apple Developer Program
 *     enrollment ($99/yr). Add this app's /auth/callback URL to the
 *     Return URLs for the Services ID. See OWNER_ACTIONS.md.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';

type SupabaseOAuthProvider = 'google' | 'apple';

async function signInWithProvider(
  provider: SupabaseOAuthProvider,
  formData: FormData,
) {
  const next = safeNext(formData.get('next'));
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Supabase returns { url } on success; the user's browser needs to
  // navigate to that URL to start the provider's consent flow. We
  // preserve `next` through the round trip by appending it to the
  // callback redirect — Supabase forwards arbitrary query params on
  // the redirectTo URL all the way through to /auth/callback per the
  // standard Supabase OAuth + Next.js App Router cookbook.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  if (data?.url) {
    return redirect(data.url);
  }

  // Defensive fallback — should be unreachable because supabase-js
  // always returns either { url } or { error }, never both null. If we
  // hit this path it's likely a misconfigured provider in Supabase
  // Studio (provider toggled OFF or missing credentials).
  return redirect(
    `/login?error=${encodeURIComponent(
      `${provider} sign-in is not configured. Please use email + password or contact support.`,
    )}&next=${encodeURIComponent(next)}`,
  );
}

export async function signInWithGoogle(formData: FormData) {
  return signInWithProvider('google', formData);
}

export async function signInWithApple(formData: FormData) {
  return signInWithProvider('apple', formData);
}
