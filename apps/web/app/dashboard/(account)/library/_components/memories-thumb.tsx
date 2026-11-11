'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Share, ListFilter } from 'lucide-react';
import type { LinkPickOption } from '@/app/_components/link-pick-menu';
import { PinnedRow } from '@/app/_components/pinned-row/pinned-row';
import { HomeFindRow, HomeGear, homeSegOptions } from '@/app/dashboard/(launcher)/_components/home-pin';
import hp from '@/app/dashboard/(launcher)/_components/home-profile.module.css';
import type { HomeSeg } from '@/lib/home-segments';

/**
 * memories-thumb.tsx — Memories' bottom row, drawn as THE ONE THUMB ROW (owner 2026-10-22: the Find row on every
 * list page, "On people, and memories they should also have those"; `prototypes/one_thumb_row_2026-10-22.html`):
 *   ≡ · [Search memories] — and no ＋, because nothing is added here (the right seat stays empty rather than
 *   inventing a verb).
 * ≡ is ONE dropdown (any set of choices is a dropdown) holding what were two: EVENT (All events · each event you host
 * or attended, its count on the right) and SHOW (the five lenses · "Also kept", the shipped list) — plus ⤓ Download
 * all once one event you host is picked — it opens that event's Download all page (zips by chapter in ~2 GB parts,
 * owner 2026-11-03), which hands each zip over as a file link; nothing is fetched into the page's memory here.
 * The field is the one NEW mechanism (flagged in the prototype's adoption table): it narrows the chapters already on
 * the page by their names — event, chapter, album — on the device; nothing is fetched.
 */
/*
 * 🏠 ON HOME IT IS HOME'S ONE PINNED ROW (owner 11 Nov 2026, "One profile page approve" — v3 row 7): the ≡ dropdown
 * became `Memories ▾` at the left of the shared `PinnedRow` — the SAME list (Event · Show · Also kept · Download all)
 * with Home's sections leading it — no number (a Memories total is never computed) and NO action (the seat stays empty
 * rather than inventing a verb); ⚙ at the right. The search field is the section's FIRST ROW, under it, scrolling.
 * Same words, same marks (`data-memories-thumb`, `data-memories-filter`, `data-memories-search`, the tour anchors).
 */
export function MemoriesThumb({
  events,
  eventValue,
  show,
  showValue,
  download,
  homeSegs = [],
}: {
  events: readonly LinkPickOption[] | null;
  eventValue: string;
  show: readonly LinkPickOption[];
  showValue: string;
  download: string | null;
  /** Home's sections — the picker's "Home" group. */
  homeSegs?: readonly HomeSeg[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [none, setNone] = useState(false);

  // Narrow the page's chapters by name. The chapters are server-drawn, so this marks them, nothing more.
  useEffect(() => {
    const words = q.trim().toLowerCase();
    const chapters = [...document.querySelectorAll<HTMLElement>('[data-memories-filter-name]')];
    let shown = 0;
    for (const el of chapters) {
      const hit = !words || (el.dataset.memoriesFilterName ?? '').toLowerCase().includes(words);
      el.hidden = !hit;
      if (hit) shown += 1;
    }
    setNone(Boolean(words) && chapters.length > 0 && shown === 0);
  }, [q]);

  const options = [
    ...(events ?? []).map((o) => ({ ...o, key: `event:${o.key}`, group: o.group ? `Event · ${o.group}` : 'Event' })),
    // The open view is marked in words too — the list's one tick belongs to the event when there is one.
    ...show.map((o) => ({
      ...o,
      key: `show:${o.key}`,
      group: o.group === 'Also kept' ? 'Also kept' : 'Show',
      ...(o.key === showValue && events ? { trail: { text: 'showing', tone: 'ok' as const } } : {}),
    })),
    ...(download ? [{ key: 'download', label: 'Download all', group: 'This event', href: download, icon: <Share className="h-[18px] w-[18px]" strokeWidth={1.9} /> }] : []),
  ].map((o) => ({ ...o, icon: o.icon ?? <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} /> }));

  const home = homeSegOptions(homeSegs);
  const all = [...home, ...options];
  return (
    <>
      <div className={hp.stick} data-home-pin="memories" data-memories-thumb="" data-tour="library-show">
        <PinnedRow
          data={{ 'data-home-pinned': 'memories' }}
          picker={{
            label: 'Memories — sections, event, what to show',
            value: events ? `event:${eventValue}` : `show:${showValue}`,
            buttonText: 'Memories',
            options: all,
            onPick: (k) => {
              const o = all.find((x) => x.key === k);
              if (!o) return;
              router.push(o.href, { scroll: false });
            },
          }}
          doors={[]}
          action={null}
          gear={<HomeGear />}
        />
      </div>
      <HomeFindRow words="Search memories" tour="library-search">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search memories"
          aria-label="Search memories — by event or chapter"
          autoComplete="off"
          data-memories-search=""
        />
      </HomeFindRow>
      {none ? (
        <p role="status" className="mx-auto w-full max-w-3xl py-3 text-[14px] text-ink/60" data-memories-no-match="">
          No event or chapter named “{q.trim()}” here.
        </p>
      ) : null}
    </>
  );
}
