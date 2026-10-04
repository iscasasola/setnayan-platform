/**
 * WHO SEES GOOGLE / APPLE, AND WHICH FLOW EACH BUTTON TAKES — one pure rule.
 *
 * Read by the server (`lib/request-platform.ts#getOAuthGate`, for /login,
 * /signup, /open-shop) and by the browser (`detect-oauth-shell.ts`, for the
 * in-place sign-in card). It imports nothing request-scoped so both sides — and
 * the tests — run the SAME function. A second hand-typed copy is how "who sees
 * Google" drifted between the marketing nav and /login once already.
 *
 * THE THREE SHELLS
 *   · web     — a normal browser: the server-action redirect (OAuthButtonRow).
 *   · desktop — the Tauri app (`SetnayanApp/desktop` UA): system browser +
 *               localhost loopback (lib/desktop-oauth.ts).
 *   · mobile  — the Capacitor phone app (bare `SetnayanApp` UA, or the
 *               client-type cookie). Google REFUSES sign-in inside an embedded
 *               web view ("disallowed_useragent"), so the server-action redirect
 *               can never be used here.
 *
 * THE PHONE APP (DECISION_LOG 2026-09-30 "…GOOGLE + APPLE SIGN-IN COME TO THE
 * PHONE APPS BEFORE THE APPLE CHECK"). A phone build that carries the native
 * sign-in plugin also appends `SetnayanSignIn/1` to its user-agent
 * (apps/mobile/capacitor.config.ts). Only then do the buttons show, and they
 * take the NATIVE flow (lib/native-oauth.ts): the Sign in with Apple sheet on
 * iOS, and Google through the SYSTEM browser (ASWebAuthenticationSession /
 * Custom Tabs) — never the in-app web view.
 *
 * 🔑 WHY A MARKER AND NOT "ANY PHONE APP". The binary already in people's hands
 * (and in Apple's review queue) has no plugin. Showing it the buttons would put
 * a door with no room behind it on the first screen — the same failure as the
 * Facebook button (lib/signin-buttons-are-configured.test.ts). The desktop app
 * solved the identical problem the same way (`SetnayanApp/desktop`).
 */

export type ClientShell = 'web' | 'desktop' | 'mobile';

/** The user-agent token a phone build with the native sign-in plugin appends. */
export const NATIVE_SIGN_IN_UA_MARKER = 'SetnayanSignIn/1';

export type OAuthGate = {
  /** Render the Google / Apple buttons at all. */
  show: boolean;
  /** Tauri: system browser + localhost loopback. */
  desktop: boolean;
  /** Phone app: Apple sheet (iOS) + system browser, returning by setnayan://. */
  native: boolean;
};

export const NO_OAUTH: OAuthGate = { show: false, desktop: false, native: false };

/** The shell a request (or this browser) comes from. */
export function classifyShell(
  ua: string | null | undefined,
  clientType: string | null | undefined,
  capacitorBridgeLive = false,
): ClientShell {
  const agent = ua ?? '';
  if (/SetnayanApp\/desktop/i.test(agent)) return 'desktop';
  if (
    /SetnayanApp/i.test(agent) ||
    clientType === 'capacitor' ||
    clientType === 'tauri' ||
    capacitorBridgeLive
  ) {
    return 'mobile';
  }
  return 'web';
}

/** Does this user-agent belong to a phone build that carries the native sign-in plugin? */
export function hasNativeSignIn(ua: string | null | undefined): boolean {
  return /\bSetnayanSignIn\/\d+/.test(ua ?? '');
}

/** The owner's NEXT_PUBLIC_OAUTH_* flags, as OAuthButtonRow reads them (`OAUTH_FLAGS`). */
export type OAuthFlags = { any: boolean; apple: boolean };

/**
 * The OAuth gate for a shell. All flags off means no buttons anywhere.
 */
export function oauthGate(shell: ClientShell, ua: string | null | undefined, flags: OAuthFlags): OAuthGate {
  if (!flags.any) return NO_OAUTH;
  if (shell === 'web') return { show: true, desktop: false, native: false };
  if (shell === 'desktop') return { show: true, desktop: true, native: false };
  // The phone app: only a build that can run the native flow. An older build
  // stays email-only — never the web redirect, which Google refuses here. And
  // only with Apple on: guideline 4.8 — no Google in the app without Sign in
  // with Apple beside it.
  if (hasNativeSignIn(ua) && flags.apple) return { show: true, desktop: false, native: true };
  return NO_OAUTH;
}
