'use client';

/**
 * apps/web/app/[slug]/seat/_components/guest-push-prompt.tsx
 *
 * C8: notifications finally have a subscriber. Web push is built and mounted
 * (apps/web/lib/web-push.ts, PushToggle on the couple/vendor/admin surfaces,
 * emitNotification wired throughout) but nothing has ever asked a GUEST —
 * prod holds zero rows because there is nowhere a guest could say yes. This
 * is that ask.
 *
 * WHY HERE: the guest has just scanned their personal QR and landed on their
 * Seat Pass — the moment they've physically chosen to engage with THIS event.
 * It is the best permission prompt this product will ever get for a guest.
 *
 * MODEL: adapted from PushToggle (apps/web/app/_components/push-toggle.tsx)
 * and the vendor-dashboard registrar's subscribe flow — same
 * requestPermission → serviceWorker.ready → pushManager.subscribe(VAPID)
 * sequence, reused rather than re-derived. Two things differ because the
 * audience differs:
 *   • the write goes to saveGuestPushSubscription (guest session, not
 *     auth.uid()) instead of savePushSubscription;
 *   • this is a spontaneous, ONE-TIME banner rather than a settings toggle —
 *     it offers itself once and then gets out of the way permanently,
 *     because a declined browser permission can never be re-asked
 *     programmatically and re-nagging past a dismissal would just be noise
 *     on somebody's wedding day.
 *
 * NEVER BLOCKS the seat pass: this renders alongside the pass, not over it,
 * and has no effect on whether the guest can see their seat.
 */

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { saveGuestPushSubscription } from '../actions/guest-push-actions';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

// Ask (and remember the ask) at most once per browser. A declined permission
// is permanent in most browsers anyway; this flag also covers "asked and
// dismissed without answering" so the banner doesn't return on a re-visit.
const ASKED_KEY = 'setnayan_guest_push_asked_v1';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function markAsked(): void {
  try {
    window.localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Private browsing / storage blocked — worst case the banner can offer
    // itself again next visit, which is still never more than a dismissable
    // banner, never a blocking one.
  }
}

function alreadyAsked(): boolean {
  try {
    return window.localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

async function subscribeAndSave(): Promise<boolean> {
  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = subscription.toJSON();
  const result = await saveGuestPushSubscription({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  });
  return result.ok;
}

export function GuestPushPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      Boolean(VAPID_PUBLIC_KEY);

    if (!supported || alreadyAsked()) return;

    // Permission was already decided outside this banner (e.g. granted via
    // the couple's own device settings) — nothing to ask, and 'denied' can
    // never be re-asked, so either way the banner stays hidden.
    if (Notification.permission !== 'default') {
      markAsked();
      return;
    }

    setVisible(true);
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      markAsked();
      if (permission === 'granted') {
        await subscribeAndSave();
      }
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  function handleDismiss() {
    markAsked();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream p-4 text-left shadow-sm">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink/70"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Get seat & schedule alerts</p>
        <p className="mt-0.5 text-xs text-ink/60">
          We&rsquo;ll let you know on this device if your table changes or something at the venue
          needs your attention — even if you close this page.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className="rounded-md bg-mulberry px-3 py-1.5 text-xs font-semibold text-cream transition-opacity hover:bg-mulberry-600 disabled:opacity-60"
          >
            {busy ? 'Turning on…' : 'Turn on alerts'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-ink/55 hover:text-ink/80"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        disabled={busy}
        className="shrink-0 rounded-md p-1 text-ink/40 hover:text-ink/70"
      >
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
