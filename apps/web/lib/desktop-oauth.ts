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

/**
 * Run the loopback OAuth flow for `provider`, then land on `next`.
 *
 * ⚠ DEBUG INSTRUMENTATION (2026-06-26): this build surfaces the exact failure
 * point via `alert()` + console so the loopback can be diagnosed on a real
 * desktop install (CI can't exercise it). Only ever runs inside the desktop
 * shell (gated by the `/desktop` UA + window.__TAURI__), so web users never see
 * it. Revert to the quiet error-routing version once the round-trip is confirmed.
 */
export async function signInWithProviderDesktop(
  provider: DesktopOAuthProvider,
  next: string = '/dashboard',
): Promise<void> {
  const log: string[] = [];
  const dbg = (m: string) => {
    log.push(m);
    // eslint-disable-next-line no-console
    console.log('[sn-oauth]', m);
  };
  const stop = (where: string, err?: unknown) => {
    const detail =
      err === undefined ? '' : `\n→ ${err instanceof Error ? err.message : String(err)}`;
    // eslint-disable-next-line no-alert
    window.alert(
      `Setnayan desktop sign-in — STOPPED AT: ${where}${detail}\n\n— trace —\n${log.join('\n')}`,
    );
  };

  try {
    const w = window as unknown as { __TAURI__?: Record<string, unknown> };
    dbg(
      `__TAURI__=${typeof w.__TAURI__}` +
        (w.__TAURI__ ? ` keys=[${Object.keys(w.__TAURI__).join(',')}]` : ''),
    );
    const t = tauri();
    if (!t) {
      stop('Tauri bridge missing — window.__TAURI__.core/event not found');
      return;
    }
    dbg(`core.invoke=${typeof t.core?.invoke}  event.listen=${typeof t.event?.listen}`);

    const supabase = createClient();

    dbg('invoke plugin:oauth|start …');
    let port: number;
    try {
      port = (await t.core.invoke('plugin:oauth|start')) as number;
    } catch (e) {
      stop('plugin:oauth|start (likely a capability/permission grant)', e);
      return;
    }
    dbg(`oauth loopback started, port=${port}`);

    const unlisten = await t.event.listen('oauth://url', (e) => {
      void (async () => {
        try {
          dbg('oauth://url event received');
          const redirect = new URL(String(e.payload));
          const errDesc =
            redirect.searchParams.get('error_description') ?? redirect.searchParams.get('error');
          if (errDesc) {
            stop('provider returned an error in the redirect', errDesc);
            return;
          }
          const code = redirect.searchParams.get('code');
          if (!code) {
            dbg('redirect had no ?code, ignoring');
            return;
          }
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            stop('exchangeCodeForSession', error.message);
            return;
          }
          window.location.assign(next);
        } finally {
          try {
            unlisten();
          } catch {
            /* noop */
          }
          try {
            await t.core.invoke('plugin:oauth|cancel', { port });
          } catch {
            /* noop */
          }
        }
      })();
    });
    dbg('listening on oauth://url');

    dbg('supabase.signInWithOAuth (skipBrowserRedirect) …');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `http://localhost:${port}`, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      stop('signInWithOAuth', error?.message ?? 'no url returned');
      return;
    }
    dbg(`got provider URL: ${data.url.slice(0, 70)}…`);

    dbg('invoke plugin:opener|open_url …');
    try {
      await t.core.invoke('plugin:opener|open_url', { url: data.url });
    } catch (e) {
      stop('plugin:opener|open_url (opening the system browser)', e);
      return;
    }
    dbg('open_url returned — the system browser should now be open');
  } catch (e) {
    stop('unexpected error', e);
  }
}
