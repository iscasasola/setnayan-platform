'use client';

import { useEffect, useState } from 'react';
import { Share } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { InfoTip } from '@/app/_components/info-tip';
import { newlyEarned, type EarnedNews, type ShopBadgeFacts } from '@/lib/shop-badges';

/**
 * 🏅 "IMPROVES EVERY TIME" — ONE line on Today when a badge is NEWLY earned (owner 2026-10-28: *"we want to build it
 * now so it improves everytime"*):
 *
 *   phone (< 768)   [pill]  You earned 50 events · Silver ⓘ
 *                                              Save to print · Got it
 *   768 and wider   [pill]  You earned 50 events · Silver ⓘ          Save to print · Got it
 *
 * 📱 PHONE FIRST — THE ACTIONS GET THEIR OWN ROW (owner 2026-10-28, live shot at 390: *"mobile view does not look
 * nice"* — pill, sentence and both buttons in ONE row crushed the sentence into a 5-line column; owner 2026-10-29:
 * *"always maximize the screen use"*). Row 1 is the pill and ONE short line; the "your tarp and card can show it"
 * reason is behind the ⓘ (title + one short line visible, the rest in the ⓘ). Row 2 is the two actions, right-aligned.
 * From `md` (768) they share one row, the sentence taking the space left. If the sentence ever outgrows the room
 * beside the pill it wraps UNDER the pill at full width (flex-wrap, basis auto) — never into a narrow column.
 * 🔒 app/vendor-dashboard/_components/the-earned-line-stacks-on-a-phone.test.ts
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
    <div className="mb-3 border-b border-ink/10 pb-3 md:flex md:items-center md:gap-3" data-badge-earned={n.key} role="status">
      {/* Row 1 — the pill and ONE short line; the reason is behind the ⓘ. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 md:flex-1" data-badge-earned-head="">
        <ShopBadgePill badge={n.badge} size="xs" className="shrink-0" />
        <InfoTip label={n.sentence} labelAs="p" labelClassName="min-w-0 text-[14px] font-medium leading-snug text-ink" align="end" className="min-w-0 flex-auto">
          {n.detail}
        </InfoTip>
      </div>
      {/* Row 2 on a phone — the actions, right-aligned under the line; beside it from 768. */}
      <div className="mt-2 flex items-center justify-end gap-2 md:mt-0 md:shrink-0" data-badge-earned-actions="">
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
