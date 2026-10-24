'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ListFilter } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { LinkPickOption } from '@/app/_components/link-pick-menu';
import { AccountThumbRow, ThumbField, ThumbTool } from '../../_components/account-thumb-row';

/**
 * memories-thumb.tsx — Memories' bottom row, drawn as THE ONE THUMB ROW (owner 2026-10-22: the Find row on every
 * list page, "On people, and memories they should also have those"; `prototypes/one_thumb_row_2026-10-22.html`):
 *   ≡ · [Search memories] — and no ＋, because nothing is added here (the right seat stays empty rather than
 *   inventing a verb).
 * ≡ is ONE dropdown (any set of choices is a dropdown) holding what were two: EVENT (All events · each event you host
 * or attended, its count on the right) and SHOW (the five lenses · "Also kept", the shipped list) — plus ⤓ Download
 * all once one event you host is picked (the studio's own `gallery-zip`). Every option is still a plain address.
 * The field is the one NEW mechanism (flagged in the prototype's adoption table): it narrows the chapters already on
 * the page by their names — event, chapter, album — on the device; nothing is fetched.
 */
export function MemoriesThumb({
  events,
  eventValue,
  show,
  showValue,
  download,
}: {
  events: readonly LinkPickOption[] | null;
  eventValue: string;
  show: readonly LinkPickOption[];
  showValue: string;
  download: string | null;
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
    ...(download ? [{ key: 'download', label: 'Download all', group: 'This event', href: download, icon: <Download className="h-[18px] w-[18px]" strokeWidth={1.9} /> }] : []),
  ].map((o) => ({ ...o, icon: o.icon ?? <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} /> }));

  return (
    <>
      {none ? (
        <p role="status" className="mx-auto w-full max-w-3xl py-3 text-[14px] text-ink/60" data-memories-no-match="">
          No event or chapter named “{q.trim()}” here.
        </p>
      ) : null}
      <AccountThumbRow
        data={{ 'data-memories-thumb': '' }}
        tools={
          <ThumbTool>
            <span data-pick="" className="contents">
              <PickMenu
                label="Memories — event, what to show"
                value={events ? `event:${eventValue}` : `show:${showValue}`}
                options={options}
                onPick={(k) => {
                  const o = options.find((x) => x.key === k);
                  if (!o) return;
                  if (k === 'download') return window.location.assign(o.href);
                  router.push(o.href, { scroll: false });
                }}
                dataAttr="data-memories-filter"
              />
            </span>
          </ThumbTool>
        }
        field={
          <ThumbField words="Search memories">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search memories"
              aria-label="Search memories — by event or chapter"
              autoComplete="off"
              data-memories-search=""
              className="h-full min-h-0 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink/55"
            />
          </ThumbField>
        }
      />
    </>
  );
}
