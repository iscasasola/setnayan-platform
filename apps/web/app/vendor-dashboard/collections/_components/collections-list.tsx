'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AtSign, BookImage, Camera, Check, ChevronDown, ChevronRight, Images, LayoutGrid, Palette, Send } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { Fold } from '@/app/_components/fold';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  COLLECTION_FILTERS,
  WHO_BADGE,
  collectionRows,
  collectionsLine,
  filterRows,
  type CollectionKey,
  type CollectionRow,
  type CollectionsFilter,
  type CollectionsInput,
} from '@/lib/supplier-collections';
import { draftLine, pruneDraft, withDraft, type PageSaved } from '@/lib/supplier-page-draft';
import { usePageDraft } from '../../website/_components/use-page-draft';

const ICON: Readonly<Record<CollectionKey, typeof Images>> = {
  page: Images,
  cards: LayoutGrid,
  albums: BookImage,
  own: Camera,
  delivered: Send,
  instagram: AtSign,
  moodboard: Palette,
};

/**
 * YOUR COLLECTIONS — the list (simpler supplier dashboard step 5 · prototype moment 8, `SCREENS.collections`):
 * one filter dropdown, the answer line, one row per store with who sees it, and the "show on my page" switch where a
 * shipped column holds it (`lib/supplier-collections.ts`). Under the list, "Add photos" — the shipped gallery
 * editors (`#gallery-media`), opened by the thumb row.
 *
 * 🔑 THE SWITCH IS A PAGE DRAFT CHANGE, NOT A SAVE. It writes the same browser draft Your page applies
 * (`usePageDraft`), so the row's badge flips at once, the line under the filter says it is waiting, and nothing
 * reaches couples until Apply on Your page — the prototype's toast word for word: "Shown on your page after Apply".
 */
/** An album's photos for its in-place grid (spec §10 #24): the first 9 display URLs and how many it holds. */
export type AlbumPreview = { urls: string[]; total: number };

export function CollectionsList({
  vendorId,
  input,
  saved,
  gallery,
  previews,
  picked = null,
  onPick,
  order = 'listed',
}: {
  vendorId: string;
  input: CollectionsInput;
  saved: PageSaved;
  /** The shipped gallery editors (portfolio · videos · Instagram), mounted in the Add photos fold. */
  gallery: ReactNode;
  /**
   * 🖼 THE PORTFOLIO TAB (THE ONE BUILD, spec §10 #24 — owner: "each album can expand"): an album with previews OPENS IN
   * PLACE on tap (a 3-column grid, first 9, the last tile "+N"); tap again closes. Absent → every row as it was.
   */
  previews?: Partial<Record<CollectionKey, AlbumPreview>>;
  /** The ✓ circle — the SEPARATE "pick for Show" control (spec §10 #24). */
  picked?: CollectionKey | null;
  onPick?: (key: CollectionKey) => void;
  /** Sort (the Portfolio thumb row): as listed, or by name. */
  order?: 'listed' | 'name';
}) {
  const toast = useToast();
  const { draft, setDraft } = usePageDraft(vendorId, saved);
  const shown = withDraft(saved, draft);
  const rows = collectionRows({ ...input, page: { ...input.page, shown: shown.sections.portfolio } });
  const [filter, setFilter] = useState<CollectionsFilter>('all');
  const filtered = filterRows(rows, filter);
  const list = order === 'name' ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered;
  const [opened, setOpened] = useState<CollectionKey | null>(null);
  const waiting = draftLine(draft, saved);

  const togglePage = () => {
    const next = !shown.sections.portfolio;
    setDraft((cur) => pruneDraft({ ...cur, sections: { ...shown.sections, portfolio: next } }, saved));
    toast.success(next ? 'Shown on your page after Apply' : 'Taken off your page after Apply');
  };

  return (
    <>
      <div data-tour="collections-filter">
      <PickMenu
        label="Show which collections"
        value={filter}
        options={COLLECTION_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        onPick={(k) => setFilter(k as CollectionsFilter)}
        dataAttr="data-collections-filter"
        className="min-h-11 w-full"
      />
      </div>
      <p className="text-[15px] text-ink" data-collections-line="">
        {(() => {
          const l = collectionsLine(rows);
          const head = l.split(' · ')[0] ?? l;
          return (
            <>
              <b className="font-semibold">{head}</b>
              {l.slice(head.length)}
            </>
          );
        })()}
      </p>
      {waiting ? (
        <Link
          href="/vendor-dashboard/website"
          className="sn-press flex min-h-11 items-center gap-2 rounded-xl bg-[color-mix(in_srgb,rgb(var(--color-warn))_12%,transparent)] px-3 py-2 text-[13.5px] font-medium text-ink"
          data-collections-waiting=""
        >
          <span className="min-w-0 flex-1">{waiting} — Apply on Your page</span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
        </Link>
      ) : null}

      <div className="divide-y divide-ink/10" data-collections-list="" data-tour="collections-list">
        {list.length === 0 ? (
          <p className="py-4 text-sm text-ink/60">Nothing here for this filter.</p>
        ) : (
          list.map((r) => (
            <CollectionRowView
              key={r.key}
              r={r}
              on={shown.sections.portfolio}
              onToggle={togglePage}
              preview={previews?.[r.key]}
              open={opened === r.key}
              onOpen={() => setOpened((cur) => (cur === r.key ? null : r.key))}
              picked={picked === r.key}
              onPick={onPick ? () => onPick(r.key) : undefined}
            />
          ))
        )}
      </div>

      <div className="border-t border-ink/10 pt-1">
        <Fold anchor="gallery-media" data="collections-add" title="Add photos" line="Your page's photos · videos · Instagram">
          <div className="pb-4">{gallery}</div>
        </Fold>
      </div>
    </>
  );
}

function CollectionRowView({
  r,
  on,
  onToggle,
  preview,
  open = false,
  onOpen,
  picked = false,
  onPick,
}: {
  r: CollectionRow;
  on: boolean;
  onToggle: () => void;
  preview?: AlbumPreview;
  open?: boolean;
  onOpen?: () => void;
  picked?: boolean;
  onPick?: () => void;
}) {
  const Icon = ICON[r.key];
  const who = WHO_BADGE[r.who];
  const thumbs = preview?.urls.slice(0, 4) ?? [];
  const inner = (
    <>
      {thumbs.length > 0 ? (
        // The album's own first photos, 2 × 2 (v113's album rows) — the icon when it has none to show.
        <span aria-hidden className="grid h-12 w-12 flex-none grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-ink/5">
          {thumbs.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element -- presigned display URLs
            <img key={u} src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
          ))}
        </span>
      ) : (
        <span aria-hidden className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink/5 text-ink/70">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-tight text-ink">{r.title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-ink/60">{r.line}</span>
      </span>
      {/* An album that opens in place carries its photos instead (the page row's switch says "on my page"). */}
      {preview && preview.urls.length > 0 && onOpen ? null : (
        <Badge tone={r.unread ? 'quiet' : who.tone} data={`collection-${r.key}`}>
          {r.unread ? 'Not read' : who.word}
        </Badge>
      )}
    </>
  );
  const rowClass = 'flex min-h-[60px] items-center gap-3 py-2.5';

  // 🖼 An album that can show its photos here: tap = open in place; the ✓ circle = pick for Show.
  if (preview && preview.urls.length > 0 && onOpen) {
    const more = preview.total - Math.min(preview.total, preview.urls.length);
    const shown = more > 0 ? preview.urls.slice(0, 8) : preview.urls;
    return (
      <div data-collection-row={r.key} data-collection-open={open ? '' : undefined}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpen} aria-expanded={open} className={`sn-press min-w-0 flex-1 text-left ${rowClass}`}>
            {inner}
            <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-ink/40 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} style={{ transitionDuration: '520ms' }} strokeWidth={2} />
          </button>
          {r.pageSwitch ? (
            <button type="button" role="switch" aria-checked={on} aria-label="Show on my page" onClick={onToggle} className={SWITCH_BUTTON}>
              <SwitchTrack on={on} />
            </button>
          ) : null}
          {onPick ? (
            <button
              type="button"
              onClick={onPick}
              aria-pressed={picked}
              aria-label={picked ? `${r.title} — picked for Show` : `Pick ${r.title} for Show`}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full`}
              data-collection-pick={r.key}
            >
              <span className={`grid h-6 w-6 place-items-center rounded-full border-[1.5px] ${picked ? 'border-transparent bg-[color:var(--m-orange)] text-white' : 'border-ink/25 text-transparent'}`}>
                <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </button>
          ) : null}
        </div>
        {/* Opens IN PLACE — the list pushes down and glides (the house 520 ms; off under reduced motion). */}
        <div
          className="grid transition-[grid-template-rows] motion-reduce:transition-none"
          style={{ gridTemplateRows: open ? '1fr' : '0fr', transitionDuration: '520ms', transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' }}
          aria-hidden={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="grid grid-cols-3 gap-1 pb-3" data-album-grid={r.key}>
              {shown.map((u) => (
                <li key={u} className="aspect-square overflow-hidden rounded-md bg-ink/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- presigned display URLs */}
                  <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                </li>
              ))}
              {more > 0 ? (
                <li className="aspect-square">
                  <a href={r.href} tabIndex={open ? undefined : -1} className="grid h-full w-full place-items-center rounded-md bg-ink/[0.06] text-[17px] font-semibold text-ink/70" data-album-more="">
                    +{(preview.total - shown.length).toLocaleString('en-PH')}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (r.pageSwitch) {
    return (
      <div className={rowClass} data-collection-row={r.key}>
        {inner}
        <button type="button" role="switch" aria-checked={on} aria-label="Show on my page" onClick={onToggle} className={SWITCH_BUTTON}>
          <SwitchTrack on={on} />
        </button>
      </div>
    );
  }
  const arrow = <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />;
  return r.href.startsWith('#') ? (
    <a href={r.href} className={`sn-press ${rowClass}`} data-collection-row={r.key}>
      {inner}
      {arrow}
    </a>
  ) : (
    <Link href={r.href} className={`sn-press ${rowClass}`} data-collection-row={r.key}>
      {inner}
      {arrow}
    </Link>
  );
}
