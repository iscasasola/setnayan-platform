'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
import { loadCloses, saveClose } from '@/lib/notice-memory';
import {
  CLAIM_WORDS,
  giftMomentSeenKey,
  giftWaitingNoticeKey,
  momentsToPlay,
  momentsWaiting,
  queueCounter,
} from '@/lib/gift-moment-queue';
import type { GiftMomentView } from '@/lib/gift-moment';

/**
 * 🎁 THE GIFT MOMENTS ON A PAGE — what plays by itself, and what waits (owner 2026-11-14; drawing
 * QSMD9BaefarMRNQAnMFiND §6 "Claiming it later").
 *
 *   · Asks `url` (GET /api/unwrap?event=… on a couple's Home, ?shop=1 on supplier Today) AFTER the page has
 *     drawn — the page's own reads never grow, and a failed read draws nothing (never "no gifts").
 *   · PLAYS BY ITSELF only what THIS ACCOUNT has never seen (each host once — remembered by the one notice memory,
 *     so it follows them to a new phone), oldest first; two shops' gifts play back to back, "1 of 2", never merged.
 *   · WAITS: every unclaimed gift is ONE notice line — "🎁 A gift from <giver> is waiting · Open" — at the page's top
 *     (the `earned` slot on Today, the event pages' top on Home) and in the bell, with NO close word: nothing closes
 *     it but claiming. Open brings the popup back (open, if it was opened before; wrapped, if not).
 *   · The popup itself (`gift-moment.tsx`) is loaded only when one is about to show.
 */
const GiftMoment = dynamic(() => import('./gift-moment'), { ssr: false });

const openedKey = (v: Pick<GiftMomentView, 'key'>) => `gift-moment-opened:${v.key}`;

type Showing = { view: GiftMomentView; counter: string | null; startOpen: boolean; fromQueue: boolean };

export function GiftMoments({ url }: { url: string }) {
  const router = useRouter();
  const [views, setViews] = useState<GiftMomentView[] | null>(null);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [queue, setQueue] = useState<GiftMomentView[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueTotal, setQueueTotal] = useState(0);
  const [showing, setShowing] = useState<Showing | null>(null);

  // 1 · the gifts, after the page has drawn.
  useEffect(() => {
    let live = true;
    fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<{ moments?: GiftMomentView[] }>) : null))
      .then((j) => {
        if (live && j && Array.isArray(j.moments)) setViews(j.moments);
      })
      // A failed read is not "no gifts": nothing is drawn, the next visit asks again.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [url]);

  // 2 · what this account has already seen / opened (the one notice memory) → the ones that play by themselves.
  //     Worked out ONCE per read: marking one seen while it plays must not reshuffle the queue under it.
  useEffect(() => {
    if (!views || views.length === 0) return;
    let live = true;
    const keys = views.flatMap((v) => [giftMomentSeenKey(v), openedKey(v)]);
    loadCloses(keys)
      .then((found) => {
        if (!live) return;
        setOpened(new Set(views.filter((v) => found.has(openedKey(v))).map((v) => v.key)));
        const play = momentsToPlay(views, (v) => found.has(giftMomentSeenKey(v)));
        setQueue(play);
        setQueueTotal(play.length);
        setQueueIndex(0);
      })
      // Unread memory: play nothing by itself (a moment is never forced twice); the waiting lines still draw.
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // Once per read of the gifts — a claim updating one view must not replay the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views === null, url]);

  const markSeen = useCallback((v: GiftMomentView) => {
    void saveClose(giftMomentSeenKey(v), null);
  }, []);

  // Show the next in the queue when nothing is up.
  useEffect(() => {
    if (showing || queueIndex >= queue.length) return;
    const v = queue[queueIndex]!;
    setShowing({ view: v, counter: queueCounter(queueIndex, queueTotal), startOpen: opened.has(v.key), fromQueue: true });
    markSeen(v);
  }, [showing, queue, queueIndex, queueTotal, opened, markSeen]);

  const later = useCallback(() => {
    setShowing((cur) => {
      if (cur?.fromQueue) setQueueIndex((i) => i + 1);
      return null;
    });
  }, []);

  const openFromLine = useCallback(
    (v: GiftMomentView) => {
      // Open from the line stops the self-playing queue: one thing at a time.
      setQueue([]);
      setShowing({ view: v, counter: null, startOpen: opened.has(v.key), fromQueue: false });
      markSeen(v);
    },
    [opened, markSeen],
  );

  const waiting = useMemo(() => (views ? momentsWaiting(views) : []), [views]);

  return (
    <>
      {waiting.map((v) => (
        <Notice
          key={v.key}
          kind="live"
          tone="info"
          closable={false}
          bell
          noticeKey={giftWaitingNoticeKey(v)}
          mark={
            <span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[15px]">
              🎁
            </span>
          }
          title={v.waitingLine}
          actions={
            <button type="button" className={NOTICE_ACTION} onClick={() => openFromLine(v)} data-gift-waiting-open={v.key}>
              {CLAIM_WORDS.open}
            </button>
          }
        />
      ))}
      {showing ? (
        <GiftMoment
          key={showing.view.key}
          view={showing.view}
          counter={showing.counter}
          startOpen={showing.startOpen}
          onOpened={() => {
            const v = showing.view;
            setOpened((prev) => new Set([...prev, v.key]));
            void saveClose(openedKey(v), null);
          }}
          onClaimed={() => {
            const v = showing.view;
            const at = new Date().toISOString();
            // The waiting line goes at once; the page catches up on its next read.
            setViews((prev) => (prev ? prev.map((x) => (x.key === v.key ? { ...x, claimedAt: x.claimedAt ?? at } : x)) : prev));
            setQueue([]);
            setShowing(null);
            router.push(v.redeemHref);
          }}
          onLater={later}
        />
      ) : null}
    </>
  );
}
