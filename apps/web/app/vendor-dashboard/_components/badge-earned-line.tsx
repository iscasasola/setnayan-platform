'use client';

import { useEffect, useState } from 'react';
import { Share } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { Notice, NoticeSlot, NOTICE_ACTION } from '@/app/_components/notices/notices';
import { newlyEarned, type EarnedNews, type ShopBadgeFacts } from '@/lib/shop-badges';
import { GiftMoments } from '@/app/_components/gift-moment/gift-moments';

/**
 * 🏅 "IMPROVES EVERY TIME" — ONE line on Today when a badge is NEWLY earned (owner 2026-10-28: *"we want to build it
 * now so it improves everytime"*).
 *
 * 🔔 IT IS A NEWS NOTICE NOW (ONE NOTICE SYSTEM, owner approved 14 Nov 2026). It registers with the page's notices and
 * is drawn by the one look (`NoticeLine`): the pill, ONE short line with the reason behind the ⓘ, Save to print, and
 * the news close word, Got it. On Today the `earned` slot (under the photo, owner 13 Nov) IS the page's top, so this
 * component also places that slot — anything else waiting on Today (an alerts ask, a second news) sits on the same
 * two lines or behind "N more" in the bell.
 *
 * 🔑 "NEWLY" WITHOUT NEW SCHEMA. The badges are worked out live (`lib/shop-badges.ts`, facts from
 * `/api/vendor/badges?view=facts`, fetched AFTER Today has drawn). The close is kept by the notice memory (your
 * account, so it follows you to a new phone); the older browser store (`setnayan.badges_seen.<shop>`) is still READ,
 * so a badge already dismissed before this change never comes back, and still WRITTEN, so `newlyEarned` moves on to
 * the next rung.
 *
 * ⚠ Only "earned" is said — never "within reach": the ladder has no rule for how close is close (owner: "don't guess").
 */
const KEY = (vendorId: string) => `setnayan.badges_seen.${vendorId}`;

function readSeen(vendorId: string): string[] {
  try {
    const raw = window.localStorage.getItem(KEY(vendorId));
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function BadgeEarnedLine({
  factsUrl = '/api/vendor/badges?view=facts',
  giftsUrl = '/api/unwrap?shop=1',
  labFiles,
}: {
  factsUrl?: string;
  /**
   * 🎁 The badge rewards' gift moment (owner 14 Nov 2026: "this effect also applies to shops when they get a badge. and
   * a reward"). Asked only AFTER the facts read above answers — that read is the door that PAYS a newly earned reward,
   * so a reward earned on this visit plays on this visit. null = none (a lab with no session).
   */
  giftsUrl?: string | null;
  /** /dev only — each badge's print file as a data: URI, so the lab saves the real file with no session. */
  labFiles?: Record<string, string>;
}) {
  const [news, setNews] = useState<{ vendorId: string; n: EarnedNews } | null>(null);
  const [swept, setSwept] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(factsUrl, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<{ vendorId: string; facts: ShopBadgeFacts }>) : null))
      .then((j) => {
        if (!live || !j) return;
        const n = newlyEarned(j.facts, readSeen(j.vendorId));
        if (n) setNews({ vendorId: j.vendorId, n });
      })
      // A failed read is not news: the line simply does not appear (nothing on Today waits on it).
      .catch(() => undefined)
      .finally(() => live && setSwept(true));
    return () => {
      live = false;
    };
  }, [factsUrl]);

  return (
    <>
      {news ? (
        <Notice
          kind="news"
          noticeKey={`badge-earned:${news.vendorId}:${news.n.key}`}
          mark={<ShopBadgePill badge={news.n.badge} size="xs" className="shrink-0" />}
          title={news.n.sentence}
          detail={news.n.detail}
          actions={
            <SaveFileLink
              href={labFiles?.[news.n.key] ?? `/api/vendor/badges?badge=${encodeURIComponent(news.n.key)}`}
              filename={`setnayan-${news.n.key.replace(/[^a-z0-9]+/gi, '-')}.svg`}
              className={NOTICE_ACTION}
              data-badge-earned-save=""
            >
              <Share aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Save to print
            </SaveFileLink>
          }
          onClose={() => {
            try {
              window.localStorage.setItem(KEY(news.vendorId), JSON.stringify(news.n.keys));
            } catch {
              /* private window — the notice memory still holds it */
            }
          }}
        />
      ) : null}
      {swept && giftsUrl ? <GiftMoments url={giftsUrl} /> : null}
      <NoticeSlot place="top" className="mt-3 mb-1 border-b border-ink/10" />
    </>
  );
}
