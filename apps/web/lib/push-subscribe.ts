/**
 * push-subscribe.ts — THE ONE WAY A SIGNED-IN DEVICE SAYS YES TO WEB PUSH.
 *
 * Lifted out of `app/_components/push-toggle.tsx` (2026-10-31) so the guest-reply
 * ask on Guests (`reply-push-ask.tsx`) runs the SAME path the profile switch runs,
 * not a second copy of it: ask the browser → subscribe through the registered
 * service worker with the VAPID key → save the row through `savePushSubscription`
 * (RLS: a user only ever writes their own). A save that is refused rolls the
 * browser subscription back, so the device never believes it is on when the
 * server has no row.
 *
 * Browser-only: call from an event handler or an effect, never during render.
 */
import { savePushSubscription } from '@/lib/push-actions';

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** Does this browser have Web Push at all (and do we have a key to use it)? */
export function webPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

// VAPID public keys are base64url; the Push API's applicationServerKey wants a
// BufferSource. Back the Uint8Array with a concrete ArrayBuffer (not the
// generic ArrayBufferLike) so it satisfies the lib.dom BufferSource type.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Is THIS device already subscribed? False on any failure (an unknown is not a yes). */
export async function deviceIsSubscribed(): Promise<boolean> {
  if (!webPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return Boolean(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/**
 * Ask, subscribe, save. `'on'` only when the server holds the row; `'denied'`
 * when the person (or the browser) said no; `'off'` for everything else — a
 * dismissed prompt, a refused save (rolled back), a thrown API.
 */
export async function subscribeThisDevice(): Promise<'on' | 'denied' | 'off'> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
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
    if (result.ok) return 'on';
    // Roll back the browser subscription so state stays consistent.
    await sub.unsubscribe().catch(() => {});
    return 'off';
  } catch {
    return 'off';
  }
}
