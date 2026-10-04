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

/** After the Apple sheet: the callback that runs the shared landing for a session already set. */
export function nativeSessionLandingPath(rawNext: string, accountType: OAuthIntentAccountType = 'customer'): string {
  return `${buildOAuthCallbackUrl({ appUrl: '', rawNext, accountType }).url}&${NATIVE_SESSION_PARAM}=1`;
}
