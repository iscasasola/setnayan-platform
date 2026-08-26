'use client';

/**
 * Push-notification opt-in toggle (compliance/push-offline — Apple guideline
 * 4.2 "minimum functionality").
 *
 * 📍 MOVED HERE 2026-08-26 from the customer profile's private `_components`.
 * It is the ONLY working implementation — the vendor surface has a 90-line stub
 * whose "Enable" path just raises a banner — and the admin console had no push
 * control at all. Three trees sharing one component is why it is no longer
 * filed under one of them.
 *
 * ⚠ THE REASON THIS MATTERED: prod holds **zero** push subscriptions, and the
 * only two toggles in the product lived on the couple and vendor doorways. So
 * the person running Setnayan could not turn on phone alerts for admin work —
 * every admin notice was tray-and-email only, and the first real sale's
 * "awaiting reconciliation" notice sat unread overnight.
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
import { unblockSteps, type UnblockGuide } from '@/lib/push-unblock-steps';

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

/**
 * Who is reading this switch. Three trees share this component, and until
 * 2026-08-26 all three were told the SAME thing — *"when a vendor messages you
 * or a new inquiry comes in"* — including the admin console, where a vendor
 * never messages you and there are no inquiries. 🔑 A shared component inherits
 * the copy of whichever tree it was born in; moving it does not re-audience it.
 */
export type PushAudience = 'admin' | 'couple' | 'vendor';

const PROMISE: Record<PushAudience, string> = {
  admin:
    'Get alerted on this device when money needs confirming, a shop is waiting to be checked, or something goes past its due date — even when the app is closed.',
  couple:
    'Get alerted on this device when a supplier messages you or something on your plan needs an answer — even when the app is closed.',
  vendor:
    'Get alerted on this device when a couple messages you or a new inquiry comes in — even when the app is closed.',
};

/** Running as an installed app rather than a browser tab. On iOS this is the
 *  difference between web push existing and not existing at all. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(iosStandalone) || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function PushToggle({ audience = 'couple' }: { audience?: PushAudience } = {}) {
  const [status, setStatus] = useState<Status>('unknown');
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState<UnblockGuide | null>(null);

  /*
    Determine current state after mount (SSR-safe — these APIs are browser-only),
    AND KEEP WATCHING.

    🔑 THE WATCH IS THE POINT, not a nicety. Unblocking happens OUTSIDE this
    page — in browser settings, or in a system settings app. Resolving the
    permission once on mount meant somebody could follow the instructions to the
    letter, come back to a switch that was still dead, and reasonably conclude
    the feature was broken. That is the "a fix nobody can reach" shape, one step
    further along: a fix they DID reach, that the screen refused to notice.

    Two channels, because neither covers everything: the Permissions API fires
    `change` the instant the setting flips (Chrome, Edge, Firefox), and
    `visibilitychange` catches the rest when the tab is looked at again — which
    is exactly the moment somebody returns from settings.
  */
  useEffect(() => {
    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      Boolean(VAPID_PUBLIC_KEY);

    const resolve = async () => {
      if (cancelled) return;
      if (!supported) {
        setStatus('unsupported');
        // iOS outside an installed app lands here, and the way in is a real
        // instruction rather than a shrug — so it gets a guide too.
        setGuide(
          unblockSteps({
            userAgent: navigator.userAgent,
            standalone: isStandalone(),
          }),
        );
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        setGuide(
          unblockSteps({
            userAgent: navigator.userAgent,
            standalone: isStandalone(),
          }),
        );
        return;
      }
      setGuide(null);
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(existing ? 'on' : 'off');
      } catch {
        if (!cancelled) setStatus('off');
      }
    };

    void resolve();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void resolve();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    if (supported && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((p) => {
          if (cancelled) return;
          permissionStatus = p;
          p.addEventListener('change', onVisible);
        })
        .catch(() => {
          /* Safari and older browsers reject this name — visibilitychange covers them. */
        });
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      permissionStatus?.removeEventListener('change', onVisible);
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
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex items-center justify-between gap-4">
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
              ? 'Not available in this browser. Install Setnayan first and alerts become available.'
              : status === 'denied'
                ? 'This device is blocking them. Nothing is broken — the steps below switch them back on.'
                : PROMISE[audience]}
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

      {/*
        THE WAY OUT. A blocked device cannot be re-prompted by any code we can
        write — `requestPermission()` returns 'denied' with no dialog — so the
        only honest thing a screen can do is say exactly which buttons to press
        on the device in front of you. Steps are numbered because they are
        performed in order, somewhere else, from memory.
      */}
      {guide && (status === 'denied' || status === 'unsupported') ? (
        <div className="mt-3 border-t border-ink/10 pt-3">
          <p className="text-xs font-semibold text-ink/70">
            How to turn them on — {guide.platform}
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-ink/60 marker:text-ink/40">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guide.systemNote ? (
            <p className="mt-2 text-xs text-ink/50">{guide.systemNote}</p>
          ) : null}
          <p className="mt-2 text-xs text-ink/50">
            You do not need to come back here and press anything — this switch
            notices by itself once the device allows it.
          </p>
        </div>
      ) : null}
    </div>
  );
}
