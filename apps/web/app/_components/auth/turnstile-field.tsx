'use client';

/**
 * <TurnstileField> — drops a Cloudflare Turnstile challenge into any auth
 * `<form>`. It writes the solved token into a hidden `<input name="captcha_token">`
 * that the form's server action reads via `captchaTokenFromForm()`.
 *
 * GRACEFUL-OFF: with no `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set, this renders
 * NOTHING — no script, no widget, no hidden field — so every auth form behaves
 * exactly as it does today. The moment the key is set (and Supabase captcha is
 * enabled), the widget appears and tokens start flowing. See lib/turnstile.ts.
 *
 * `appearance="interaction-only"` keeps it invisible for legitimate humans
 * (managed mode auto-solves in the background) and only surfaces an interactive
 * challenge when Cloudflare judges the visitor suspicious — the low-friction
 * default the tap-through funnels need.
 */

import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;

/** Load the Turnstile script exactly once per page. */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('turnstile script failed')),
      );
      if (window.turnstile) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile script failed'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileField({ action }: { action?: string }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !holderRef.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    const form = holderRef.current.closest('form');

    /**
     * 🔴 A TURNSTILE TOKEN IS SINGLE-USE, AND A FAILED SUBMIT DOES NOT REMOUNT US.
     *
     * Every one of these forms is a server action that ends in `redirect()` back
     * to the same route on failure. That is an RSC navigation, NOT a fresh page
     * load: React keeps this component in the same tree position, the effect
     * above never re-runs, and the hidden input still holds the token the server
     * just consumed. Cloudflare rejects a replayed token, so the SECOND attempt
     * fails no matter what the person types — and the third, and the fourth.
     *
     * The failure is invisible in every environment we can test in, because with
     * no site key none of this renders at all.
     *
     * So: the moment the surrounding form is submitted, spend the token locally
     * too — blank the input and ask Cloudflare for a fresh one. The browser has
     * already serialised the old value into the POST by the time `submit`
     * fires, so this cannot rob the in-flight request of its token.
     */
    const onSubmit = () => {
      if (inputRef.current) inputRef.current.value = '';
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.reset(widgetId);
        } catch {
          /* widget already gone — the next mount will make a new one */
        }
      }
    };
    form?.addEventListener('submit', onSubmit);

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !holderRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(holderRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (token: string) => {
            if (inputRef.current) inputRef.current.value = token;
          },
          'expired-callback': () => {
            if (inputRef.current) inputRef.current.value = '';
          },
          'error-callback': () => {
            if (inputRef.current) inputRef.current.value = '';
          },
        });
      })
      .catch(() => {
        // Script blocked (ad-blocker / offline). Leave the token empty; the
        // server call proceeds and Supabase decides — fail-closed only when
        // captcha is actually enabled, never a silent client crash.
      });

    return () => {
      cancelled = true;
      form?.removeEventListener('submit', onSubmit);
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* widget already gone */
        }
      }
    };
  }, [action]);

  // No key → render nothing at all. Forms submit exactly as they do today.
  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <input ref={inputRef} type="hidden" name="captcha_token" defaultValue="" />
      <div ref={holderRef} data-turnstile className="cf-turnstile" />
    </>
  );
}
