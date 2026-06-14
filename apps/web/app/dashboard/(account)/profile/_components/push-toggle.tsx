'use client';

/**
 * Push-notification opt-in toggle (compliance/push-offline — Apple guideline
 * 4.2 "minimum functionality"). Lives in the customer-profile Feedback section
 * next to the haptics toggle — the home for device/notification preferences.
 *
 * Deliberately NON-INTRUSIVE: the browser permission prompt only fires when the
 * user flips this switch ON — never on first paint, never on login. If push
 * isn't supported (no VAPID key, no service worker, no Push API — e.g. iOS
 * Safari outside an installed PWA), the control renders a quiet "not available"
 * note instead of a dead switch.
 *
 * On enable: ask Notification permission → subscribe via the registered service
 * worker using the VAPID public key → POST the subscription to
 * savePushSubscription. On disable: unsubscribe locally → removePushSubscription.
 */

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { savePushSubscription, removePushSubscription } from '@/lib/push-actions';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

// VAPID public keys are base64url; the Push API's applicationServerKey wants a
// BufferSource. Back the Uint8Array with a concrete ArrayBuffer (not the
// generic ArrayBufferLike) so it satisfies the lib.dom BufferSource type.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = 'unknown' | 'unsupported' | 'denied' | 'off' | 'on';

export function PushToggle() {
  const [status, setStatus] = useState<Status>('unknown');
  const [busy, setBusy] = useState(false);

  // Determine current state after mount (SSR-safe — these APIs are browser-only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window &&
        Boolean(VAPID_PUBLIC_KEY);
      if (!supported) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(existing ? 'on' : 'off');
      } catch {
        if (!cancelled) setStatus('off');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      });
      if (result.ok) {
        setStatus('on');
      } else {
        // Roll back the browser subscription so state stays consistent.
        await sub.unsubscribe().catch(() => {});
        setStatus('off');
      }
    } catch {
      setStatus('off');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setStatus('off');
    } catch {
      setStatus('off');
    } finally {
      setBusy(false);
    }
  }

  const on = status === 'on';
  const interactive = status === 'on' || status === 'off';

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-ink/10 bg-cream p-4">
      <span className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink/70"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-ink">
            Push notifications
          </span>
          <span className="text-xs text-ink/55">
            {status === 'unsupported'
              ? 'Not available on this device or browser. On iPhone, add Setnayan to your Home Screen first.'
              : status === 'denied'
                ? 'Blocked in your browser settings. Re-enable notifications for this site to turn them on.'
                : 'Get alerted on this device when a vendor messages you or a new inquiry comes in — even when the app is closed.'}
          </span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Push notifications"
        disabled={!interactive || busy}
        onClick={on ? disable : enable}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          on ? 'bg-terracotta' : 'bg-ink/20'
        } ${!interactive || busy ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-cream shadow transition-transform ${
            on ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
