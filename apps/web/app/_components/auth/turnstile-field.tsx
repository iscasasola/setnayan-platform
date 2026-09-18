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

import { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';
import {
  decideSubmitGate,
  TURNSTILE_HOLDER_MARGIN_RECLAIM_PX,
  TURNSTILE_HOLDER_MIN_WIDTH_PX,
  TURNSTILE_WIDGET_SIZE,
} from '@/lib/turnstile-submit-gate';

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
  /**
   * 🔴 THE BUTTON IS TAPPABLE BEFORE THE TOKEN EXISTS, AND THAT IS THE COMMON
   * PATH — NOT AN EDGE CASE.
   *
   * `appearance:'interaction-only'` means a legitimate visitor sees NOTHING
   * here, so there is no widget to wait for and no reason to hesitate: the page
   * paints, the button is right there, they tap. If Cloudflare has not answered
   * yet the hidden field is empty, the server action refuses, and the person is
   * bounced to a retry notice for doing the one thing the screen invited.
   *
   * Measured on production the hour captcha went live: the FIRST tap on
   * /papic/claim was refused, and so was the second. The error copy is good
   * ("Your link is fine. Give it one more go.") — but the best error message is
   * the one nobody has to read.
   *
   * So a tap that arrives early is QUEUED, not failed: hold the submit, and
   * re-submit the moment the token lands. Nothing about the server contract
   * changes — it still receives a token or refuses.
   */
  const queuedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [waiting, setWaiting] = useState(false);

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
    /**
     * Release a queued submit and let the form go through. Used both when the
     * token arrives and when it never will — see the timeout below. NEVER trap
     * the person in a pending state: if the check cannot complete, the server's
     * own honest refusal is a better outcome than a button that does nothing.
     */
    const release = () => {
      queuedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setWaiting(false);
    };

    const onSubmit = (e: Event) => {
      const token = inputRef.current?.value ?? '';

      // No token yet, but a widget exists to produce one → hold the submit and
      // let the callback below re-fire it. `widgetId` is the load-bearing half:
      // if the script was blocked (ad-blocker, offline) there is nothing to
      // wait for, so we fall through and the server decides — unchanged.
      const gate = decideSubmitGate({
        token,
        hasWidget: Boolean(widgetId),
        alreadyQueued: queuedRef.current,
      });
      if (gate === 'queue') {
        e.preventDefault();
        queuedRef.current = true;
        setWaiting(true);
        timerRef.current = setTimeout(() => {
          // The check did not finish — or needs an interaction the person has
          // not given. Submit anyway; the action answers for itself.
          release();
          form?.requestSubmit();
        }, 10_000);
        return;
      }

      // Proceeding. Spend the token locally too — a Turnstile token is
      // single-use and a failed submit does NOT remount us (see above).
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
          size: TURNSTILE_WIDGET_SIZE,
          callback: (token: string) => {
            if (inputRef.current) inputRef.current.value = token;
            // A tap was already waiting on this token — deliver it now.
            if (queuedRef.current) {
              release();
              form?.requestSubmit();
            }
          },
          'expired-callback': () => {
            if (inputRef.current) inputRef.current.value = '';
          },
          'error-callback': () => {
            if (inputRef.current) inputRef.current.value = '';
            // Do not hold a submit hostage to a check that has already failed.
            if (queuedRef.current) {
              release();
              form?.requestSubmit();
            }
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
      if (timerRef.current) clearTimeout(timerRef.current);
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
      {/*
        min-width is load-bearing, not styling: below Cloudflare's 300px
        minimum the `flexible` widget lays out at ZERO HEIGHT, so an
        interactive challenge cannot be shown and cannot be solved. The
        card's padding leaves 293px at a 375px viewport — measured, live.
        The negative inline margin reclaims that shortfall from the padding
        instead of widening the page.
      */}
      <div
        ref={holderRef}
        data-turnstile
        className="cf-turnstile"
        style={{
          minWidth: `${TURNSTILE_HOLDER_MIN_WIDTH_PX}px`,
          marginInline: `-${TURNSTILE_HOLDER_MARGIN_RECLAIM_PX}px`,
        }}
      />
      {waiting ? (
        <p role="status" aria-live="polite" className="m-mono text-xs opacity-70">
          Checking you&rsquo;re human&hellip;
        </p>
      ) : null}
    </>
  );
}
