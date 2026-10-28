'use client';

import { useEffect, useState } from 'react';
import { Share } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { newlyEarned, type EarnedNews, type ShopBadgeFacts } from '@/lib/shop-badges';

/**
 * 🏅 "IMPROVES EVERY TIME" — ONE line on Today when a badge is NEWLY earned (owner 2026-10-28: *"we want to build it
 * now so it improves everytime"*):
 *
 *   [pill]  You earned 50 events · Silver ✓ — your tarp and card can show it      Save to print · Got it
 *
 * 🔑 "NEWLY" WITHOUT NEW SCHEMA. The badges are worked out live (`lib/shop-badges.ts`, facts from
 * `/api/vendor/badges?view=facts`, fetched AFTER Today has drawn so Today's own reads never grow). What the supplier
 * last dismissed is kept in this browser (`setnayan.badges_seen.<shop>`): "Got it" stores every badge earned now, so
 * the line returns only when a NEW rung is reached. Considered and not used: `users.tour_seen_keys` — its only writer
 * (`completeTour`) refuses any key that is not a tour, and a second writer would be a new server action. The cost,
 * named: on a new phone the newest badge is announced once more.
 *
 * ⚠ Only "earned" is said — never "within reach": the ladder has no rule for how close is close (owner: "don't guess").
 * No email. Save to print is the shipped save (`SaveFileLink` → `usePrintSave`), the file drawn at that moment.
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
  labFiles,
}: {
  factsUrl?: string;
  /** /dev only — each badge's print file as a data: URI, so the lab saves the real file with no session. */
  labFiles?: Record<string, string>;
}) {
  const [news, setNews] = useState<{ vendorId: string; n: EarnedNews } | null>(null);

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
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [factsUrl]);

  if (!news) return null;
  const { n, vendorId } = news;
  const dismiss = () => {
    try {
      window.localStorage.setItem(KEY(vendorId), JSON.stringify(n.keys));
    } catch {
      /* private window — the line just goes for now */
    }
    setNews(null);
  };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink/10 pb-3" data-badge-earned={n.key} role="status">
      <ShopBadgePill badge={n.badge} size="xs" />
      <p className="min-w-0 flex-1 text-[14px] font-medium text-ink">{n.sentence}</p>
      <div className="flex items-center gap-2">
        <SaveFileLink
          href={labFiles?.[n.key] ?? `/api/vendor/badges?badge=${encodeURIComponent(n.key)}`}
          filename={`setnayan-${n.key.replace(/[^a-z0-9]+/gi, '-')}.svg`}
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink"
          data-badge-earned-save=""
        >
          <Share aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Save to print
        </SaveFileLink>
        <button type="button" onClick={dismiss} className="sn-press min-h-11 rounded-full px-3 text-sm font-semibold text-ink/60" data-badge-earned-dismiss="">
          Got it
        </button>
      </div>
    </div>
  );
}
