'use client';

/**
 * PushToggle — vendor Notifications settings surface.
 *
 * Displays the current push notification status and lets the vendor
 * disable push (deactivating all their registered tokens server-side)
 * or navigate to enable if they haven't yet.
 *
 * Rendered inside the /vendor-dashboard/notifications page as a
 * settings card above the notification feed.
 *
 * This is a stub wired to the real deactivateAllPushTokens server action.
 * The "Enable" path just triggers the banner already mounted by
 * PushNotificationRegistrar in the vendor layout.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { deactivateAllPushTokens } from '@/app/vendor-dashboard/actions/push-tokens';
import { unblockSteps, type UnblockGuide } from '@/lib/push-unblock-steps';

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function PushToggle() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [disabling, setDisabling] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [guide, setGuide] = useState<UnblockGuide | null>(null);

  useEffect(() => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
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

  const handleDisable = useCallback(async () => {
    setDisabling(true);
    try {
      await deactivateAllPushTokens();
      setDisabled(true);
      setPermission('default'); // show banner prompt again on next visit
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
                : 'Off — enable to get instant alerts.'}
          </p>
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
      ) : permission !== 'denied' ? (
        <span className="rounded-lg bg-ink/5 px-3 py-1.5 text-xs text-ink/50">
          Allow via banner below
        </span>
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
