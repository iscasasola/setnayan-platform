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

export type DesktopOAuthProvider = 'google' | 'apple';

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

function fail(message: string): void {
  window.location.assign(`/login?error=${encodeURIComponent(message)}`);
}

/**
 * Run the loopback OAuth flow for `provider`, then land on `next`. Rejects only
 * if the Tauri bridge is missing; provider/exchange errors route to /login?error.
 */
export async function signInWithProviderDesktop(
  provider: DesktopOAuthProvider,
  next: string = '/dashboard',
): Promise<void> {
  const t = tauri();
  if (!t) throw new Error('Not running in the Setnayan desktop app');

  const supabase = createClient();
  let port: number;
  try {
    port = (await t.core.invoke('plugin:oauth|start')) as number;
  } catch {
    fail('Could not start the desktop sign-in helper. Please try email sign-in.');
    return;
  }

  let unlisten: (() => void) | undefined;
  const cleanup = async () => {
    try {
      unlisten?.();
    } catch {
      /* noop */
    }
    try {
      await t.core.invoke('plugin:oauth|cancel', { port });
    } catch {
      /* noop */
    }
  };

  unlisten = await t.event.listen('oauth://url', (e) => {
    void (async () => {
      try {
        const redirect = new URL(String(e.payload));
        const errDesc =
          redirect.searchParams.get('error_description') ?? redirect.searchParams.get('error');
        if (errDesc) {
          fail(errDesc);
          return;
        }
        const code = redirect.searchParams.get('code');
        if (!code) return; // ignore unrelated hits on the loopback
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          fail(error.message);
          return;
        }
        window.location.assign(next);
      } finally {
        await cleanup();
      }
    })();
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `http://localhost:${port}`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) {
    await cleanup();
    fail(error?.message ?? `${provider} sign-in could not start.`);
    return;
  }

  try {
    await t.core.invoke('plugin:opener|open_url', { url: data.url });
  } catch {
    await cleanup();
    fail('Could not open your browser for sign-in. Please try email sign-in.');
  }
}
