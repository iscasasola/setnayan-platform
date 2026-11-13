'use client';

/**
 * reply-push-ask.tsx — "GET A NOTICE ON THIS PHONE WHEN GUESTS REPLY?" ON GUESTS —
 * an alerts ASK in the one notice system (inventory #21, owner approved 14 Nov
 * 2026): a To-do line (it was a sheet), "Yes · Not now"; it stops after the
 * second "Not now" and never takes the top while anything else waits.
 *
 * Owner, 2026-10-31: guest replies stopped emailing the hosts and go to the
 * phone instead ("The notification on the phone not on the app"). The only way
 * to say yes used to be a switch in the profile, and prod held zero push
 * subscriptions — so this asks at the one moment it makes sense: the host has a
 * reply and is looking at their list.
 *
 *   · WHETHER is decided by `replyAskMode` (lib/reply-push-ask.ts, pure, tested):
 *     a reply exists, not the iPhone app, not already on, not blocked, not
 *     already answered (the one notice memory; the old per-device answer is its legacy).
 *   · NEVER ON FIRST PAINT: it registers REPLY_ASK_DELAY_MS after the list settles.
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

import { useEffect, useState } from 'react';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-action';
import { closeNotice } from '@/app/_components/notices/notice-store';
import { deviceOs } from '@/lib/apple-device';
import { isStoreShellInBrowser } from '@/lib/store-shell';
import { deviceIsSubscribed, subscribeThisDevice, webPushSupported } from '@/lib/push-subscribe';
import { nativePushPermission, registerNativePush } from '@/lib/native-push';
import type { CloseRecord } from '@/lib/notices';
import { REPLY_ASK_COPY, REPLY_ASK_DELAY_MS, readLastAnswer, replyAskMode, type ReplyAskMode } from '@/lib/reply-push-ask';

const KEY = 'alerts-ask:guest-replies';

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
        // Whether it was already answered is the one notice memory's question (the <Notice> below).
        lastAnsweredAtMs: null,
        nowMs: Date.now(),
      });
      if (!cancelled) setMode(next);
    }, REPLY_ASK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasReply]);

  async function yes() {
    setBusy(true);
    try {
      // Same moment, same words — inside the iPhone app the Yes is APNs, on the web it is Web Push.
      if (mode === 'native') await registerNativePush();
      else await subscribeThisDevice();
    } finally {
      // A Yes is remembered like a close, so a failed Yes never asks again tomorrow.
      closeNotice({ id: KEY, key: KEY, kind: 'todo', ask: true, title: REPLY_ASK_COPY.title });
      setBusy(false);
      setMode(null);
    }
  }

  if (!mode) return null;
  const ios = mode === 'ios-home-screen';
  return (
    <Notice
      kind="todo"
      ask
      noticeKey={KEY}
      title={REPLY_ASK_COPY.title}
      // iPhone Safari in a tab has no Yes: the how is behind the ⓘ.
      detail={ios ? `${REPLY_ASK_COPY.iosLine}. ${REPLY_ASK_COPY.iosHow}` : REPLY_ASK_COPY.info}
      actions={
        ios ? null : (
          <button type="button" onClick={yes} disabled={busy} className={NOTICE_ACTION}>
            {busy ? 'Turning on…' : REPLY_ASK_COPY.yes}
          </button>
        )
      }
      // The per-device answer kept before the one notice system — honoured, so nobody is asked again early.
      legacy={(): CloseRecord | null => {
        const at = readLastAnswer(storage());
        return at ? { closedAt: at, count: 1 } : null;
      }}
      onClose={() => setMode(null)}
    />
  );
}
