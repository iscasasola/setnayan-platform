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
 * 🔔 IT IS AN ALERTS ASK NOW (ONE NOTICE SYSTEM, owner approved 14 Nov 2026).
 * The fixed bar over the page is gone. The ask registers as a to-do notice that
 * asks (`ask`): it takes a page's top only when nothing else is waiting, else it
 * waits in the bell's "Waiting on this page"; "Not now" brings it back after 7
 * days and it stops for good after the second. Denying the browser's permission
 * still ends it at once. The older 30-day browser cooldown is still READ, so a
 * vendor who closed it before this change is not asked again early.
 */

import { useCallback, useEffect, useState } from 'react';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
import type { CloseRecord } from '@/lib/notices';
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

    // permission === 'default' — the notice memory decides whether it is asked now (the old cooldown is its legacy).
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

  /** A close kept by the older 30-day cooldown — honoured, so nobody is asked again early. */
  const legacy = useCallback((): CloseRecord | null => {
    try {
      const until = Number(localStorage.getItem(DISMISSED_UNTIL_KEY));
      return Number.isFinite(until) && until > 0 ? { closedAt: until - DISMISS_COOLDOWN_MS, count: 1 } : null;
    } catch {
      return null;
    }
  }, []);

  // Only the 'banner' and 'pending' states render visible UI.
  if (state !== 'banner' && state !== 'pending') return null;

  return (
    <Notice
      kind="todo"
      ask
      noticeKey="alerts-ask:supplier"
      title="Get an alert for every new inquiry"
      detail={
        <>
          Your phone tells you the moment a couple sends you an inquiry. You can turn it off in your browser settings.
          {error ? <span className="mt-1 block text-danger-700">{error}</span> : null}
        </>
      }
      actions={
        <button type="button" onClick={handleEnable} disabled={state === 'pending'} className={NOTICE_ACTION}>
          {state === 'pending' ? 'Turning on…' : 'Turn on alerts'}
        </button>
      }
      legacy={legacy}
    />
  );
}
