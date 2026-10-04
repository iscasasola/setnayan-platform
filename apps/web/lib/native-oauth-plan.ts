/**
 * The pure half of the phone-app sign-in (lib/native-oauth.ts): which flow a
 * button takes, where the provider returns, and which path the web view opens
 * after. No browser, no Capacitor — so the server route (`/auth/callback`) and
 * the tests import it without pulling in a client module.
 */
import { appUrlToPath } from '@/lib/app-url-path';
import { buildOAuthCallbackUrl, type OAuthIntentAccountType } from '@/lib/oauth-signup';

export type NativeOAuthProvider = 'google' | 'apple';
export type NativePlatform = 'ios' | 'android';
export type NativeOAuthPlan = 'apple-sheet' | 'system-browser';

/** The in-repo native plugin's JS name (SetnayanAuthPlugin.swift / .java). */
export const NATIVE_AUTH_PLUGIN = 'SetnayanAuth';
/** The custom scheme the app registers (Info.plist CFBundleURLSchemes · AndroidManifest). */
export const NATIVE_CALLBACK_SCHEME = 'setnayan';
/** Base handed to buildOAuthCallbackUrl → `setnayan://auth/callback?…`. */
const NATIVE_APP_URL_BASE = `${NATIVE_CALLBACK_SCHEME}:/`;
/** The query flag that tells /auth/callback a native sign-in already set the session. */
export const NATIVE_SESSION_PARAM = 'native';

/*
 * 🔒 THE NATIVE LANDING MARKER (audit of train #6333, 2026-10-04).
 *
 * `/auth/callback?native=1` runs the sign-in landing — the vendor promotion
 * (`as=vendor`) and the RSVP terms stamp — for a session that is ALREADY set.
 * A recency check alone let ANY link (`/auth/callback?native=1&as=vendor`,
 * crafted by anyone) run those writes inside the five minutes after a person
 * signed in. So the landing is bound to a ONE-TIME marker that only the app's
 * own Apple-sheet call can produce:
 *
 *   1. after `signInWithIdToken` succeeds, lib/native-oauth.ts asks the server
 *      action `issueNativeLandingMarker` (app/auth/native-marker-action.ts —
 *      a server action, so Next's same-origin check refuses a cross-site post);
 *   2. the server mints 32 random bytes, sets them in an httpOnly cookie scoped
 *      to `/auth/callback` for five minutes, and hands the SAME value back;
 *   3. the web view opens `/auth/callback?native=1&native_marker=<value>`;
 *   4. the callback runs the landing only when the URL's marker equals the
 *      cookie's (constant-time), and DELETES the cookie on every native visit,
 *      matched or not — so it is spent exactly once.
 *
 * A crafted link has no cookie (or a spent one) and cannot know the value —
 * the cookie is httpOnly and the value never leaves this one round trip — so
 * the callback only redirects to `safeNext(next)` and writes nothing.
 */
/** The httpOnly cookie that holds the marker between the sheet and the callback. */
export const NATIVE_LANDING_COOKIE = 'sn_native_landing';
/** The query param that carries the same marker on the callback URL. */
export const NATIVE_MARKER_PARAM = 'native_marker';
/** How long a minted marker lives (seconds) — the same window as the fresh sign-in. */
export const NATIVE_MARKER_TTL_S = 5 * 60;
/** A marker is exactly 32 random bytes as lowercase hex. */
const NATIVE_MARKER_SHAPE = /^[0-9a-f]{64}$/;

/**
 * Does the marker on the URL match the one the server set? Both must be
 * well-formed; compared in constant time. Absent, malformed or different → false.
 */
export function nativeMarkerMatches(held: unknown, presented: unknown): boolean {
  if (typeof held !== 'string' || typeof presented !== 'string') return false;
  if (!NATIVE_MARKER_SHAPE.test(held) || !NATIVE_MARKER_SHAPE.test(presented)) return false;
  let diff = 0;
  for (let i = 0; i < held.length; i += 1) diff |= held.charCodeAt(i) ^ presented.charCodeAt(i);
  return diff === 0;
}

/** Which flow a button takes on which phone. Apple's sheet exists only on iOS. */
export function nativeOAuthPlan(provider: NativeOAuthProvider, platform: NativePlatform): NativeOAuthPlan {
  return provider === 'apple' && platform === 'ios' ? 'apple-sheet' : 'system-browser';
}

/**
 * Where the provider sends the person back: the app's own scheme, carrying
 * `next` (+ `as=vendor`) by the SAME rule as the web door (buildOAuthCallbackUrl).
 */
export function nativeRedirectTo(rawNext: string, accountType: OAuthIntentAccountType = 'customer'): string {
  return buildOAuthCallbackUrl({ appUrl: NATIVE_APP_URL_BASE, rawNext, accountType }).url;
}

/**
 * The system browser's return URL → the path the web view opens. Only our own
 * `setnayan://auth/callback` is accepted; anything else is null (ignored).
 */
export function nativeCallbackPath(returnUrl: string | null | undefined): string | null {
  if (!returnUrl || !returnUrl.startsWith(`${NATIVE_CALLBACK_SCHEME}://auth/callback`)) return null;
  const path = appUrlToPath(returnUrl);
  return path && path.startsWith('/auth/callback') ? path : null;
}

/**
 * After the Apple sheet: the callback that runs the shared landing for a
 * session already set. Without a `marker` (minting failed) the callback just
 * sends the person on to `next` and writes nothing.
 */
export function nativeSessionLandingPath(
  rawNext: string,
  accountType: OAuthIntentAccountType = 'customer',
  marker?: string | null,
): string {
  const base = `${buildOAuthCallbackUrl({ appUrl: '', rawNext, accountType }).url}&${NATIVE_SESSION_PARAM}=1`;
  return marker ? `${base}&${NATIVE_MARKER_PARAM}=${encodeURIComponent(marker)}` : base;
}
