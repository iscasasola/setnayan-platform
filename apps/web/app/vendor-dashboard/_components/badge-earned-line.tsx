'use client';

import { useEffect, useState } from 'react';
import { Share } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';
import Link from 'next/link';
import { Notice, NoticeSlot } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
import type { AwardItem } from '@/lib/award-queue';
import { AWARD_NEWS_HREF, awardNews, type AwardNews } from '@/lib/badge-earned-news';
import { BADGE_ART_H, BADGE_ART_W } from '@/lib/shop-badge-shelf';
import { verifiedV84Svg } from '@/lib/verified-v84-art';
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
 *
 * ✅ ONLY THE APPROVED BADGES (owner 17 Nov, on live: *"i still see old badges?"*). After the facts read (still THE door
 * that pays a newly earned reward), the line asks the award queue (`?view=awards`) and announces only what it plays:
 * Setnayan Verified or a tier of the five v84 badges (`awardNews`, lib/badge-earned-news.ts) — drawn with the v84 art,
 * with "See it" to Shop › Badges. A retired badge (the Events ladder, Rating, Business since, the monthly awards) is
 * never announced. Save to print stays for Verified (its print file is the v84 blue check).
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
  awardsUrl = '/api/vendor/badges?view=awards',
  giftsUrl = '/api/unwrap?shop=1',
  labFiles,
}: {
  factsUrl?: string;
  /** The award queue — what the line may announce (Verified + the five v84 badges' tiers). */
  awardsUrl?: string;
  /**
   * 🎁 The badge rewards' gift moment (owner 14 Nov 2026: "this effect also applies to shops when they get a badge. and
   * a reward"). Asked only AFTER the facts read above answers — that read is the door that PAYS a newly earned reward,
   * so a reward earned on this visit plays on this visit. null = none (a lab with no session).
   */
  giftsUrl?: string | null;
  /** /dev only — each badge's print file as a data: URI, so the lab saves the real file with no session. */
  labFiles?: Record<string, string>;
}) {
  const [news, setNews] = useState<{ vendorId: string; n: AwardNews } | null>(null);
  const [swept, setSwept] = useState(false);

  useEffect(() => {
    let live = true;
    const ask = <T,>(url: string) =>
      fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } }).then((r) => (r.ok ? (r.json() as Promise<T>) : null));
    // The facts read first: it pays what was just earned, so the queue read after it already holds it.
    ask<{ vendorId: string }>(factsUrl)
      .then(async (j) => {
        if (!live || !j) return;
        const q = await ask<{ queue: AwardItem[] | null }>(awardsUrl).catch(() => null);
        if (!live || !q) return;
        const n = awardNews(q.queue, readSeen(j.vendorId));
        if (n) setNews({ vendorId: j.vendorId, n });
      })
      // A failed read is not news: the line simply does not appear (nothing on Today waits on it).
      .catch(() => undefined)
      .finally(() => live && setSwept(true));
    return () => {
      live = false;
    };
  }, [factsUrl, awardsUrl]);

  return (
    <>
      {news ? (
        <Notice
          kind="news"
          noticeKey={`badge-earned:${news.vendorId}:${news.n.key}`}
          mark={<EarnedMark n={news.n} />}
          title={news.n.sentence}
          detail={news.n.detail}
          actions={
            <>
              <Link href={AWARD_NEWS_HREF} className={NOTICE_ACTION} data-badge-earned-see="">
                See it
              </Link>
              {news.n.key === 'verified' ? (
                <SaveFileLink
                  href={labFiles?.[news.n.key] ?? `/api/vendor/badges?badge=${encodeURIComponent(news.n.key)}`}
                  filename={`setnayan-${news.n.key.replace(/[^a-z0-9]+/gi, '-')}.svg`}
                  className={NOTICE_ACTION}
                  data-badge-earned-save=""
                >
                  <Share aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Save to print
                </SaveFileLink>
              ) : null}
            </>
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

/** The v84 picture beside the line: the tier's own art, or Verified's blue check. */
function EarnedMark({ n }: { n: AwardNews }) {
  if (n.art.kind === 'tier') {
    // eslint-disable-next-line @next/next/no-img-element -- a 28-px static picture; next/image adds JS for nothing
    return <img src={n.art.src} width={BADGE_ART_W} height={BADGE_ART_H} alt="" loading="lazy" decoding="async" className="h-auto w-7 shrink-0" data-badge-earned-art="" />;
  }
  // trusted: the approved v84 art from a constant (lib/verified-v84-art.ts), never user text
  return <span className="inline-grid h-7 w-7 shrink-0" data-badge-earned-art="" dangerouslySetInnerHTML={{ __html: verifiedV84Svg({ uid: 'earned-vr', size: 28, word: false }) }} />;
}
