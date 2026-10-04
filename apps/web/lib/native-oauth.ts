'use client';

/**
 * Google + Apple sign-in INSIDE THE PHONE APP (Capacitor) — B3, DECISION_LOG
 * 2026-09-30 "…GOOGLE + APPLE SIGN-IN COME TO THE PHONE APPS BEFORE THE APPLE
 * CHECK". Apple guideline 4.8: offering Google in the app requires Sign in with
 * Apple, so the two ship together.
 *
 * WHY NOT THE WEB REDIRECT. Google refuses sign-in inside an embedded web view
 * ("disallowed_useragent"), and the app IS a web view. So the in-app web view
 * never opens a provider's page. Two native flows instead, both through the
 * in-repo `SetnayanAuth` plugin (apps/mobile — Swift on iOS, Java on Android):
 *
 *   APPLE ON iOS — the native Sign in with Apple sheet.
 *     1. a random nonce; its SHA-256 goes to the sheet (Apple puts it in the token)
 *     2. SetnayanAuth.signInWithApple → the identity token
 *     3. supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce }) —
 *        the session lands in THIS web view's cookies
 *     4. → /auth/callback?native=1&next=… — the same landing as every other
 *        door (terms on the RSVP page, vendor intent, the You card), never a copy
 *
 *   GOOGLE (and APPLE ON ANDROID) — the SYSTEM browser.
 *     1. supabase.auth.signInWithOAuth({ redirectTo: setnayan://auth/callback?…,
 *        skipBrowserRedirect: true }) → the provider URL. PKCE: the verifier is
 *        stored in THIS web view's cookies.
 *     2. SetnayanAuth.openAuthSession → iOS ASWebAuthenticationSession / Android
 *        Custom Tabs. The person signs in there (Safari's / Chrome's own Google
 *        session — a guest who saved their invitation with Google is one tap).
 *     3. the provider → Supabase → setnayan://auth/callback?code=…&next=…
 *        iOS: the session hands the URL back here. Android: the OS reopens the
 *        app and NativeBridge's `appUrlOpen` handler maps it (lib/app-url-path).
 *     4. the web view opens /auth/callback?code=… — the EXISTING route exchanges
 *        the code (the verifier cookie is in this same jar) and lands on `next`.
 *
 * 🔒 Tokens are never logged, stored, or put in a URL by this file. The custom
 * scheme can be claimed by another app, which is why only a PKCE code ever
 * travels on it: without the verifier in this web view's cookies it is useless.
 *
 * Any failure routes to /login?error (the card maps it to a fixed sentence);
 * a person who simply closes the sheet / browser stays where they were.
 */

import { createClient } from '@/lib/supabase/client';
import { mintTurnstileToken } from '@/lib/turnstile-client';
import type { OAuthIntentAccountType } from '@/lib/oauth-signup';
import {
  NATIVE_AUTH_PLUGIN,
  NATIVE_CALLBACK_SCHEME,
  nativeCallbackPath,
  nativeOAuthPlan,
  nativeRedirectTo,
  nativeSessionLandingPath,
  type NativeOAuthProvider,
  type NativePlatform,
} from '@/lib/native-oauth-plan';

// ── the native bridge ───────────────────────────────────────────────────────

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  nativePromise?: (plugin: string, method: string, options?: Record<string, unknown>) => Promise<unknown>;
};

function capacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() && typeof cap.nativePromise === 'function' ? cap : null;
}

/** The phone this is running on, or null outside the Capacitor app. */
export function nativePlatform(): NativePlatform | null {
  const p = capacitor()?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : null;
}

function callPlugin(method: string, options: Record<string, unknown>): Promise<unknown> {
  const cap = capacitor();
  if (!cap?.nativePromise) return Promise.reject(new Error('unavailable'));
  return cap.nativePromise(NATIVE_AUTH_PLUGIN, method, options);
}

/** A person closing the sheet / browser is not an error. */
function wasCancelled(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'CANCELED' || code === 'CANCELLED';
}

function fail(message: string, next: string): void {
  window.location.assign(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Resolves when the flow left this screen or was cancelled (then: false). */
async function appleSheet(next: string, accountType: OAuthIntentAccountType): Promise<boolean> {
  const rawNonce = randomNonce();
  let result: { identityToken?: unknown; givenName?: unknown; familyName?: unknown };
  try {
    result = (await callPlugin('signInWithApple', { nonce: await sha256Hex(rawNonce) })) as typeof result;
  } catch (err) {
    if (wasCancelled(err)) return false;
    fail('Apple sign-in could not finish. Please try again or use email.', next);
    return true;
  }
  const token = typeof result?.identityToken === 'string' ? result.identityToken : '';
  if (!token) {
    fail('Apple sign-in could not finish. Please try again or use email.', next);
    return true;
  }
  const supabase = createClient();
  // The id-token grant is a captcha-gated sign-in once Supabase captcha is on;
  // the headless mint resolves undefined while it is off (no-op).
  const captchaToken = await mintTurnstileToken('native_apple').catch(() => undefined);
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token,
    nonce: rawNonce,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) {
    fail(error.message, next);
    return true;
  }
  // Apple hands over the name ONCE, on the first authorization, and never puts
  // it in the token — keep it on the account or it is gone for good.
  const given = typeof result.givenName === 'string' ? result.givenName.trim() : '';
  const family = typeof result.familyName === 'string' ? result.familyName.trim() : '';
  if (given || family) {
    await supabase.auth
      .updateUser({ data: { full_name: [given, family].filter(Boolean).join(' '), given_name: given, family_name: family } })
      .catch(() => undefined);
  }
  window.location.assign(nativeSessionLandingPath(next, accountType));
  return true;
}

async function systemBrowser(
  provider: NativeOAuthProvider,
  next: string,
  accountType: OAuthIntentAccountType,
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: nativeRedirectTo(next, accountType), skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    fail(error?.message ?? `${provider} sign-in could not start.`, next);
    return true;
  }
  let opened: { url?: unknown };
  try {
    // 🔒 The provider page opens in the SYSTEM browser, never this web view —
    // Google refuses the web view (guarded by native-oauth.test.ts).
    opened = (await callPlugin('openAuthSession', {
      url: data.url,
      callbackScheme: NATIVE_CALLBACK_SCHEME,
    })) as typeof opened;
  } catch (err) {
    if (wasCancelled(err)) return false;
    fail('Could not open your browser for sign-in. Please use email sign-in.', next);
    return true;
  }
  // iOS hands the return URL back; Android returns through `appUrlOpen`
  // (NativeBridge), so there is nothing more to do here.
  if (typeof opened?.url === 'string') {
    const path = nativeCallbackPath(opened.url);
    if (!path) {
      fail('Sign-in did not come back. Please try again.', next);
      return true;
    }
    window.location.assign(path);
  }
  return true;
}

/**
 * Run the phone-app sign-in for `provider`, then land on `next`. Resolves
 * `false` if the person cancelled (the caller re-enables its buttons).
 */
export async function signInWithProviderNative(
  provider: NativeOAuthProvider,
  next: string,
  accountType: OAuthIntentAccountType = 'customer',
): Promise<boolean> {
  const platform = nativePlatform();
  if (!platform) {
    fail('This sign-in works in the Setnayan app. Please use email sign-in here.', next);
    return true;
  }
  try {
    return nativeOAuthPlan(provider, platform) === 'apple-sheet'
      ? await appleSheet(next, accountType)
      : await systemBrowser(provider, next, accountType);
  } catch {
    fail('Sign-in failed. Please try again.', next);
    return true;
  }
}
