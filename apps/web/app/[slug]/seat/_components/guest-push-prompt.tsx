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
 *   • this is an alerts ASK in the one notice system (inventory #33, owner
 *     approved 14 Nov 2026): a To-do line, "Turn on alerts · Not now", that
 *     stops after the second "Not now"; once the browser has an answer
 *     (granted / denied) it is gone for good — a declined permission can never
 *     be re-asked programmatically.
 *
 * NEVER BLOCKS the seat pass: this renders alongside the pass, not over it,
 * and has no effect on whether the guest can see their seat.
 */

import { useEffect, useState } from 'react';
import type { CloseRecord } from '@/lib/notices';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-action';
import { saveGuestPushSubscription } from '../actions/guest-push-actions';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

// The older per-browser "asked" flag — only READ now, as the notice's legacy, so a guest who already
// answered is not asked again. The one notice memory keeps every new answer.
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

    if (!supported) return;

    // Permission was already decided outside this banner (e.g. granted via
    // the couple's own device settings) — nothing to ask, and 'denied' can
    // never be re-asked, so either way the banner stays hidden.
    if (Notification.permission !== 'default') return;

    setVisible(true);
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await subscribeAndSave();
      }
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <InlineNotice
      kind="todo"
      ask
      noticeKey="alerts-ask:guest-seat"
      title="Get seat & schedule alerts"
      detail="We’ll let you know on this device if your table changes or something at the venue needs your attention — even if you close this page."
      actions={
        <button type="button" onClick={handleEnable} disabled={busy} className={NOTICE_ACTION}>
          {busy ? 'Turning on…' : 'Turn on alerts'}
        </button>
      }
      legacy={(): CloseRecord | null => (alreadyAsked() ? { closedAt: Date.now(), count: 2 } : null)}
      onClose={() => setVisible(false)}
    />
  );
}
