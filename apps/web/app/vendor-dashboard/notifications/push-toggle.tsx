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

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function PushToggle() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [disabling, setDisabling] = useState(false);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PermissionState);
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
    <div className="mb-6 flex items-center justify-between rounded-xl border border-ink/10 bg-cream px-4 py-3">
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
                ? 'Blocked in browser settings.'
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
  );
}
