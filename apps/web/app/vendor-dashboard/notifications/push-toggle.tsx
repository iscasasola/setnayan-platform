'use client';

/**
 * PushToggle — vendor Notifications settings surface.
 *
 * Displays the current push notification status and lets the vendor enable
 * push (subscribing this device and registering its token) or disable it
 * (deactivating ALL their registered tokens server-side, across every
 * device — the shared admin/couple toggle has no equivalent, which is why
 * this card is not just a swap-in of that component).
 *
 * Rendered inside the /vendor-dashboard/notifications page as a settings
 * card above the notification feed.
 *
 * 🔑 ENABLE IS INLINE, NOT A REDIRECT TO THE LAYOUT BANNER. It used to say
 * "Allow via banner below" and leave it there — but PushNotificationRegistrar
 * (mounted on the vendor layout) hides its own banner for 30 days after a
 * vendor dismisses it, and never shows at all once permission is 'denied'.
 * A vendor who dismissed the banner once and later opened this settings page
 * to turn notifications on found a sentence pointing at nothing. The enable
 * flow here duplicates the registrar's subscribe-and-register steps against
 * the SAME table (vendor_push_tokens via registerPushToken) so either path
 * lands in a state the other can see and disable.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  deactivateAllPushTokens,
  registerPushToken,
} from '@/app/vendor-dashboard/actions/push-tokens';
import { unblockSteps, type UnblockGuide } from '@/lib/push-unblock-steps';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type PermissionState = 'unsupported' | 'no_vapid' | 'default' | 'granted' | 'denied';

export function PushToggle() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<UnblockGuide | null>(null);

  useEffect(() => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      // Same posture as PushNotificationRegistrar: no key configured, no push
      // to offer. Distinct from 'unsupported' so the copy can say WHY.
      setPermission('no_vapid');
      return;
    }
    setPermission(Notification.permission as PermissionState);
    if (Notification.permission === 'denied') {
      const standalone =
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone) ||
        window.matchMedia?.('(display-mode: standalone)').matches === true;
      setGuide(unblockSteps({ userAgent: navigator.userAgent, standalone }));
    }
  }, []);

  const handleEnable = useCallback(async () => {
    setEnabling(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        setPermission(result === 'denied' ? 'denied' : 'default');
        if (result === 'denied') {
          const standalone =
            Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone) ||
            window.matchMedia?.('(display-mode: standalone)').matches === true;
          setGuide(unblockSteps({ userAgent: navigator.userAgent, standalone }));
        }
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        });
      }
      await registerPushToken(JSON.stringify(sub.toJSON()), 'web');
      setPermission('granted');
      setDisabled(false);
    } catch (err) {
      console.error('[PushToggle] enable failed', err);
      setError('Could not turn these on just now — try again in a moment.');
    } finally {
      setEnabling(false);
    }
  }, []);

  const handleDisable = useCallback(async () => {
    setDisabling(true);
    try {
      await deactivateAllPushTokens();
      setDisabled(true);
      setPermission('default'); // show the enable control again
    } catch (err) {
      console.error('[PushToggle] deactivateAllPushTokens failed', err);
    } finally {
      setDisabling(false);
    }
  }, []);

  if (permission === 'unsupported') return null;

  const isActive = permission === 'granted' && !disabled;

  return (
    <div className="mb-6 sn-row px-4 py-3">
      <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {isActive ? (
          <Bell aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
        ) : (
          <BellOff aria-hidden className="h-5 w-5 text-ink/40" strokeWidth={1.75} />
        )}
        <div>
          <p className="text-sm font-medium text-ink">Push notifications</p>
          <p className="text-xs text-ink/55">
            {isActive
              ? 'On — you\'ll get an instant alert when a couple sends an inquiry.'
              : permission === 'denied'
                ? 'This device is blocking them. Nothing is broken — the steps below switch them back on.'
                : permission === 'no_vapid'
                  ? 'Not available yet on this deployment.'
                  : 'Off — enable to get instant alerts.'}
          </p>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        </div>
      </div>

      {isActive ? (
        <button
          type="button"
          onClick={handleDisable}
          disabled={disabling}
          className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {disabling ? 'Disabling…' : 'Disable'}
        </button>
      ) : permission === 'default' ? (
        <button
          type="button"
          onClick={handleEnable}
          disabled={enabling}
          className="rounded-lg bg-mulberry px-3 py-1.5 text-xs font-semibold text-cream transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enabling ? 'Enabling…' : 'Enable'}
        </button>
      ) : null}
      </div>

      {/*
        🔑 THE DENIED BRANCH USED TO RENDER FIVE WORDS AND NO CONTROL AT ALL —
        "Blocked in browser settings." and then `: null`. A blocked vendor was
        left with a dead card and nowhere to go, and no code can re-open the
        browser prompt for them. Same fix as the shared toggle, same pure
        helper: say which buttons to press on the device in front of you.
      */}
      {guide && permission === 'denied' ? (
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
        </div>
      ) : null}
    </div>
  );
}
