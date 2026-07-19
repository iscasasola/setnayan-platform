'use client';

/**
 * PushNotificationRegistrar — vendor-dashboard-only client component.
 *
 * Handles the full Web Push opt-in + token registration lifecycle for the
 * vendor doorway. Renders null (invisible) once the vendor has already
 * granted permission; shows a non-blocking banner on first visit to invite
 * the vendor to enable push.
 *
 * Flow:
 *   1. On mount: detect push support (navigator.serviceWorker + PushManager).
 *   2. If permission === 'default': show a subtle, dismissible banner.
 *   3. On [Enable]: request Notification permission.
 *      - granted → register SW → subscribe → call registerPushToken('web').
 *      - denied  → hide banner permanently (browser permission is sticky).
 *   4. If permission is already 'granted': silently refresh the subscription
 *      token on each mount (browser may rotate the push endpoint).
 *
 * VAPID public key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 * When the env var is absent the component skips registration entirely —
 * the in-app notification + email still fire, push is optional.
 *
 * Non-blocking by design: the banner is a fixed bottom strip (above the
 * bottom nav on mobile), never a modal or alert. Dismissing hides it for a
 * cooldown window (30 days); denying browser permission hides it permanently.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  registerPushToken,
} from '@/app/vendor-dashboard/actions/push-tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert the standard base64url VAPID public key to a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Returns true when the runtime supports Web Push. */
function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Dismissal is durable, not per-session: once the vendor closes the banner we
// respect that for a cooldown window (localStorage stores the epoch-ms after
// which it may re-surface). This avoids re-nagging on every new tab/session
// while still eventually re-offering push to vendors who never resolved the
// browser permission. Browser-level Allow/Block still ends the prompt forever.
const DISMISSED_UNTIL_KEY = 'setnayan_push_banner_dismissed_until';
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** True when a prior dismissal is still within its cooldown window. */
function isWithinDismissCooldown(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_UNTIL_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PushNotificationRegistrar() {
  // 'idle'    — hasn't checked yet (SSR / first render)
  // 'unsupported' — browser doesn't support push
  // 'banner'  — prompt the vendor (permission === 'default')
  // 'pending' — user clicked Enable, awaiting browser prompt
  // 'done'    — token registered (or silently refreshed)
  // 'dismissed' — vendor dismissed the banner for this session
  // 'denied'  — browser permission denied
  type State = 'idle' | 'unsupported' | 'banner' | 'pending' | 'done' | 'dismissed' | 'denied';
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Register the SW and subscribe, then persist the endpoint token. */
  const subscribeAndRegister = useCallback(async (): Promise<void> => {
    if (!VAPID_PUBLIC_KEY) {
      // VAPID not configured — no-op gracefully.
      console.warn('[PushNotificationRegistrar] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; skipping push registration.');
      return;
    }

    const swReg = await navigator.serviceWorker.ready;

    // Check if there's already an active subscription.
    let subscription = await swReg.pushManager.getSubscription();

    if (!subscription) {
      // Subscribe with our VAPID public key.
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast to ArrayBuffer satisfies the PushSubscribeOptions.applicationServerKey
        // BufferSource union in TypeScript's lib.dom.d.ts.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }

    // Store the full subscription JSON — the server needs endpoint + p256dh + auth
    // to encrypt Web Push messages. Storing only the endpoint is not sufficient.
    await registerPushToken(JSON.stringify(subscription.toJSON()), 'web');
  }, []);

  useEffect(() => {
    if (!isPushSupported()) {
      setState('unsupported');
      return;
    }

    const permission = Notification.permission;

    if (permission === 'denied') {
      setState('denied');
      return;
    }

    if (permission === 'granted') {
      // Already granted — silently refresh in the background.
      subscribeAndRegister().catch((err: unknown) => {
        console.warn('[PushNotificationRegistrar] silent refresh failed', err);
      });
      setState('done');
      return;
    }

    // permission === 'default' — respect a still-active dismissal cooldown.
    if (isWithinDismissCooldown()) {
      setState('dismissed');
      return;
    }

    setState('banner');
  }, [subscribeAndRegister]);

  const handleEnable = useCallback(async () => {
    setState('pending');
    setError(null);

    try {
      const result = await Notification.requestPermission();

      if (result === 'granted') {
        await subscribeAndRegister();
        setState('done');
      } else if (result === 'denied') {
        setState('denied');
      } else {
        // 'default' — user dismissed the browser prompt without choosing.
        setState('banner');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setState('banner');
      console.error('[PushNotificationRegistrar] push registration failed', err);
    }
  }, [subscribeAndRegister]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(
        DISMISSED_UNTIL_KEY,
        String(Date.now() + DISMISS_COOLDOWN_MS),
      );
    } catch {
      // Private-mode / storage-disabled: fall back to hiding for this session
      // only. Better a re-nag than a crash.
    }
    setState('dismissed');
  }, []);

  // Only the 'banner' and 'pending' states render visible UI.
  if (state !== 'banner' && state !== 'pending') return null;

  return (
    /*
     * Non-blocking consent banner — sits above the bottom nav on mobile
     * (z-40 ensures it floats above content but below modals/sheets).
     * Never a modal; never auto-focused; never blocks interaction.
     */
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-lg items-center gap-3 sn-row px-4 py-3 shadow-lg backdrop-blur-sm sm:bottom-6 lg:bottom-6"
    >
      <Bell
        aria-hidden
        className="h-5 w-5 shrink-0 text-terracotta"
        strokeWidth={1.75}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          Enable push notifications
        </p>
        <p className="mt-0.5 text-xs text-ink/60">
          Get instant alerts when a couple sends you an inquiry.
        </p>
        {error ? (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={state === 'pending'}
          className="rounded-lg bg-mulberry px-3 py-1.5 text-xs font-semibold text-cream transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === 'pending' ? 'Enabling…' : 'Enable'}
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss push notification prompt"
          className="rounded-md p-1 text-ink/40 transition-colors hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
