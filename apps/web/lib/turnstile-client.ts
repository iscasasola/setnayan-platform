'use client';

/**
 * Headless Turnstile token mint — for auth flows that have NO visible form to
 * host a <TurnstileField> (the anon-draft onboarding "continue" tap, the
 * Papic/Panood claim actions). Renders a managed widget off to the side of the
 * viewport, executes it, and resolves the token so a client caller can pass it
 * into the server action that calls `signInAnonymously`.
 *
 * GRACEFUL-OFF: no site key → resolves `undefined` immediately (no script, no
 * DOM). Every anon server action treats `undefined` as "no token" → `{}` →
 * current behavior. So this is inert until captcha is activated.
 *
 * `appearance:'interaction-only'` means the injected container stays invisible
 * for legitimate humans and only paints a challenge when Cloudflare demands
 * one — hence the fixed, centered, high-z container (a `display:none` host
 * could never show that fallback challenge).
 */

import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
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

/**
 * Mint a single Turnstile token. Resolves `undefined` when captcha isn't
 * configured, the script is blocked, or a challenge times out — callers pass
 * that straight through; Supabase enforces only when captcha is enabled.
 */
export async function mintTurnstileToken(
  action?: string,
): Promise<string | undefined> {
  if (!TURNSTILE_SITE_KEY || typeof window === 'undefined') return undefined;
  try {
    await loadScript();
  } catch {
    return undefined;
  }
  if (!window.turnstile) return undefined;
  const turnstile = window.turnstile;

  return new Promise<string | undefined>((resolve) => {
    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '50%';
    holder.style.top = '50%';
    holder.style.transform = 'translate(-50%, -50%)';
    holder.style.zIndex = '2147483647';
    document.body.appendChild(holder);

    let settled = false;
    let widgetId: string | undefined;
    const cleanup = () => {
      if (widgetId) {
        try {
          turnstile.remove(widgetId);
        } catch {
          /* already gone */
        }
      }
      holder.remove();
    };
    const finish = (token: string | undefined) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };

    // Hard timeout so a stuck/blocked challenge never hangs the flow.
    const timer = window.setTimeout(() => finish(undefined), 15000);

    try {
      widgetId = turnstile.render(holder, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        appearance: 'interaction-only',
        callback: (token: string) => {
          window.clearTimeout(timer);
          finish(token);
        },
        'error-callback': () => {
          window.clearTimeout(timer);
          finish(undefined);
        },
        'timeout-callback': () => {
          window.clearTimeout(timer);
          finish(undefined);
        },
      });
    } catch {
      window.clearTimeout(timer);
      finish(undefined);
    }
  });
}
