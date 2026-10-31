'use client';

/**
 * reply-push-ask.tsx — THE ONE-TIME "GET A NOTICE ON THIS PHONE WHEN GUESTS
 * REPLY?" ON GUESTS, IN THE HOUSE SHEET.
 *
 * Owner, 2026-10-31: guest replies stopped emailing the hosts and go to the
 * phone instead ("The notification on the phone not on the app"). The only way
 * to say yes used to be a switch in the profile, and prod held zero push
 * subscriptions — so this asks at the one moment it makes sense: the host has a
 * reply and is looking at their list.
 *
 *   · WHETHER is decided by `replyAskMode` (lib/reply-push-ask.ts, pure, tested):
 *     a reply exists, not the iPhone app, not already on, not blocked, not
 *     answered in the last 30 days.
 *   · NEVER ON FIRST PAINT: it rises REPLY_ASK_DELAY_MS after the list settles.
 *   · Yes runs the SAME path as the profile switch (`subscribeThisDevice`), and
 *     the browser's permission prompt fires only from that press.
 *   · iPhone Safari in a tab has no Web Push at all — so there is no Yes; the ⓘ
 *     says how to get these from the Home Screen, once.
 *   · INSIDE THE IPHONE APP the same sheet asks at the same moment, and its Yes
 *     registers with APNs (`registerNativePush`, lib/native-push.ts) — only on a
 *     build with the push plugin, only while iOS has not been answered.
 *
 * 🔒 lib/reply-push-ask.test.ts · app/dashboard/[eventId]/guests/the-reply-ask-is-asked-once.test.ts
 */

import { useEffect, useId, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { deviceOs } from '@/lib/apple-device';
import { isStoreShellInBrowser } from '@/lib/store-shell';
import { deviceIsSubscribed, subscribeThisDevice, webPushSupported } from '@/lib/push-subscribe';
import { nativePushPermission, registerNativePush } from '@/lib/native-push';
import {
  REPLY_ASK_COPY,
  REPLY_ASK_DELAY_MS,
  readLastAnswer,
  rememberAnswer,
  replyAskMode,
  type ReplyAskMode,
} from '@/lib/reply-push-ask';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function standalone(): boolean {
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(ios) || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function ReplyPushAsk({ replied }: { replied: number }) {
  const [mode, setMode] = useState<ReplyAskMode>(null);
  const [busy, setBusy] = useState(false);
  const hasReply = replied > 0;

  useEffect(() => {
    if (!hasReply) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const os = deviceOs(navigator.userAgent, navigator.maxTouchPoints);
      const storeShell = isStoreShellInBrowser(navigator.userAgent, document.cookie);
      const supported = !storeShell && webPushSupported();
      const next = replyAskMode({
        replied: 1,
        storeShell,
        native: storeShell ? await nativePushPermission() : 'unavailable',
        supported,
        iosOutsideHomeScreen: (os === 'iphone' || os === 'ipad') && !standalone() && !supported,
        permission: 'Notification' in window ? Notification.permission : 'unsupported',
        subscribed: supported ? await deviceIsSubscribed() : false,
        lastAnsweredAtMs: readLastAnswer(storage()),
        nowMs: Date.now(),
      });
      if (!cancelled) setMode(next);
    }, REPLY_ASK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasReply]);

  const close = () => {
    if (busy) return;
    rememberAnswer(storage(), Date.now());
    setMode(null);
  };

  async function yes() {
    setBusy(true);
    try {
      // Same moment, same words — inside the iPhone app the Yes is APNs, on the web it is Web Push.
      if (mode === 'native') await registerNativePush();
      else await subscribeThisDevice();
    } finally {
      rememberAnswer(storage(), Date.now());
      setBusy(false);
      setMode(null);
    }
  }

  if (!mode) return null;
  return <ReplyAskSheet mode={mode} busy={busy} onYes={yes} onClose={close} />;
}

/** The sheet itself — drawn by `ReplyPushAsk`, and by /dev/reply-ask-lab for the screenshots. */
export function ReplyAskSheet({
  mode,
  busy,
  onYes,
  onClose,
}: {
  mode: Exclude<ReplyAskMode, null>;
  busy: boolean;
  onYes: () => void;
  onClose: () => void;
}) {
  const headingId = useId();
  const ios = mode === 'ios-home-screen';

  return (
    <Sheet open onClose={onClose} labelledById={headingId} rise>
      <div className="px-4 pb-4 pt-3.5" data-reply-push-ask={mode}>
        <InfoTip
          label={REPLY_ASK_COPY.title}
          labelAs="h3"
          labelId={headingId}
          labelClassName="text-[19px] font-semibold tracking-tight text-ink"
          align="start"
          className="pr-12"
        >
          {ios ? (
            REPLY_ASK_COPY.iosHow
          ) : (
            REPLY_ASK_COPY.info
          )}
        </InfoTip>
        <p className="mt-1 text-sm text-ink/70">{ios ? `${REPLY_ASK_COPY.iosLine}.` : REPLY_ASK_COPY.line}</p>
        {ios ? (
          <div className="mt-3.5">
            <ActionButton
              tone="brand"
              main
              icon={<Check aria-hidden strokeWidth={1.9} />}
              label={REPLY_ASK_COPY.gotIt}
              onClick={onClose}
              className="w-full"
            />
          </div>
        ) : (
          <>
            <div className="mt-3.5">
              <ActionButton
                tone="brand"
                main
                icon={<Bell aria-hidden strokeWidth={1.9} />}
                label={busy ? 'Turning on…' : REPLY_ASK_COPY.yes}
                onClick={onYes}
                disabled={busy}
                className="w-full"
              />
            </div>
            <div className="mt-1.5 text-center">
              <ActionButton
                tone="neutral"
                quiet
                icon={<X aria-hidden strokeWidth={1.9} />}
                label={REPLY_ASK_COPY.notNow}
                onClick={onClose}
                disabled={busy}
              />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
