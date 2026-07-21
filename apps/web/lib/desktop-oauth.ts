'use client';

/**
 * Desktop (Tauri) OAuth via the system browser + a localhost loopback.
 *
 * WHY: Google (and Apple) refuse OAuth inside an embedded WebView
 * ("disallowed_useragent"), so the in-app server-action redirect to the consent
 * screen dead-ends in the Tauri WebView. The fix is the standard desktop pattern:
 * run consent in the user's real browser and catch the redirect on a throwaway
 * localhost server the app owns.
 *
 * FLOW (all in the WebView, driven over window.__TAURI__ — see src-tauri:
 * withGlobalTauri + capabilities/default.json grant the bundled remote app the
 * oauth/opener commands):
 *   1. plugin:oauth|start          → bind a localhost port, return it.
 *   2. supabase.signInWithOAuth({ redirectTo: http://localhost:<port>,
 *      skipBrowserRedirect: true }) → returns the provider URL. PKCE: the
 *      code_verifier is stored in THIS WebView's cookie store, so the exchange
 *      in step 5 (same store) succeeds.
 *   3. plugin:opener|open_url      → open that URL in the system browser.
 *   4. user consents; the provider → Supabase → redirects to the loopback with
 *      ?code=…; the plugin emits `oauth://url` with the full redirect URL.
 *   5. supabase.exchangeCodeForSession(code) sets the session in the WebView →
 *      navigate to `next`.
 *
 * SAFE BY CONSTRUCTION: everything here is gated on window.__TAURI__, which only
 * exists in the rebuilt desktop app. Web + mobile never call this.
 *
 * OWNER CONFIG (one-time): Supabase → Auth → URL Configuration → Redirect URLs:
 * add `http://localhost:*` (the loopback port is chosen at runtime). Google Cloud
 * Console needs NO change — Google only ever redirects to Supabase's own callback.
 */

import { createClient } from '@/lib/supabase/client';

export type DesktopOAuthProvider = 'google' | 'apple' | 'facebook';

interface TauriCore {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
}
interface TauriEvent {
  listen: (
    event: string,
    handler: (e: { payload: unknown }) => void,
  ) => Promise<() => void>;
}
interface TauriGlobal {
  core: TauriCore;
  event: TauriEvent;
}

function tauri(): TauriGlobal | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __TAURI__?: TauriGlobal };
  const t = w.__TAURI__;
  return t && t.core && t.event ? t : null;
}

/** True only inside the Tauri desktop shell (globalTauri injected). */
export function isTauri(): boolean {
  return tauri() !== null;
}

/** Route any desktop sign-in failure to the login page with a friendly note. */
function fail(message: string): void {
  window.location.assign(`/login?error=${encodeURIComponent(message)}`);
}

/** Give up the loopback if the user abandons the browser (frees the port + UI). */
const LOOPBACK_TIMEOUT_MS = 5 * 60_000;

/**
 * Run the desktop loopback OAuth flow for `provider`, then land on `next`.
 *
 * Google/Apple refuse OAuth in an embedded WebView, so consent runs in the
 * SYSTEM browser and the redirect is caught on a throwaway localhost loopback the
 * app owns; the WebView then exchanges the PKCE code (same cookie store that
 * started the flow) and navigates. Only runs inside the desktop shell (gated by
 * the `/desktop` UA + window.__TAURI__) — web/mobile never reach here. Any
 * failure routes to /login?error; email sign-in is always the fallback.
 */
export async function signInWithProviderDesktop(
  provider: DesktopOAuthProvider,
  next: string = '/dashboard',
): Promise<void> {
  const t = tauri();
  if (!t) {
    fail('Desktop sign-in is unavailable here. Please use email sign-in.');
    return;
  }
  const supabase = createClient();

  let port: number;
  try {
    port = (await t.core.invoke('plugin:oauth|start')) as number;
  } catch {
    fail('Could not start the desktop sign-in helper. Please use email sign-in.');
    return;
  }

  // One-shot guard: the loopback may fire, time out, or error during setup —
  // whichever happens first wins, and cleanup runs exactly once.
  let settled = false;
  let unlisten: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    try {
      unlisten?.();
    } catch {
      /* noop */
    }
    void t.core.invoke('plugin:oauth|cancel', { port }).catch(() => {});
  };

  unlisten = await t.event.listen('oauth://url', (e) => {
    if (settled) return;
    void (async () => {
      try {
        const redirect = new URL(String(e.payload));
        const errDesc =
          redirect.searchParams.get('error_description') ?? redirect.searchParams.get('error');
        const code = redirect.searchParams.get('code');
        if (errDesc) {
          settled = true;
          cleanup();
          fail(errDesc);
          return;
        }
        if (!code) return; // ignore stray hits on the loopback
        settled = true;
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        cleanup();
        if (error) {
          fail(error.message);
          return;
        }
        window.location.assign(next);
      } catch (err) {
        settled = true;
        cleanup();
        fail(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      }
    })();
  });

  timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    fail('Sign-in timed out. Please try again.');
  }, LOOPBACK_TIMEOUT_MS);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `http://localhost:${port}`, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    settled = true;
    cleanup();
    fail(error?.message ?? `${provider} sign-in could not start.`);
    return;
  }

  try {
    await t.core.invoke('plugin:opener|open_url', { url: data.url });
  } catch {
    settled = true;
    cleanup();
    fail('Could not open your browser for sign-in. Please use email sign-in.');
  }
}
