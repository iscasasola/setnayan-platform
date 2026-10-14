'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AtSign, BookImage, Camera, ChevronRight, Images, LayoutGrid, Palette, Send } from 'lucide-react';
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
export function CollectionsList({
  vendorId,
  input,
  saved,
  gallery,
}: {
  vendorId: string;
  input: CollectionsInput;
  saved: PageSaved;
  /** The shipped gallery editors (portfolio · videos · Instagram), mounted in the Add photos fold. */
  gallery: ReactNode;
}) {
  const toast = useToast();
  const { draft, setDraft } = usePageDraft(vendorId, saved);
  const shown = withDraft(saved, draft);
  const rows = collectionRows({ ...input, page: { ...input.page, shown: shown.sections.portfolio } });
  const [filter, setFilter] = useState<CollectionsFilter>('all');
  const list = filterRows(rows, filter);
  const waiting = draftLine(draft, saved);

  const togglePage = () => {
    const next = !shown.sections.portfolio;
    setDraft((cur) => pruneDraft({ ...cur, sections: { ...shown.sections, portfolio: next } }, saved));
    toast.success(next ? 'Shown on your page after Apply' : 'Taken off your page after Apply');
  };

  return (
    <>
      <PickMenu
        label="Show which collections"
        value={filter}
        options={COLLECTION_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        onPick={(k) => setFilter(k as CollectionsFilter)}
        dataAttr="data-collections-filter"
        className="min-h-11 w-full"
      />
      <p className="text-[15px] text-ink" data-collections-line="">
        {(() => {
          const l = collectionsLine(rows);
          const head = l.split(' · ')[0];
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

      <div className="divide-y divide-ink/10" data-collections-list="">
        {list.length === 0 ? (
          <p className="py-4 text-sm text-ink/60">Nothing here for this filter.</p>
        ) : (
          list.map((r) => (
            <CollectionRowView key={r.key} r={r} on={shown.sections.portfolio} onToggle={togglePage} />
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

function CollectionRowView({ r, on, onToggle }: { r: CollectionRow; on: boolean; onToggle: () => void }) {
  const Icon = ICON[r.key];
  const who = WHO_BADGE[r.who];
  const inner = (
    <>
      <span aria-hidden className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink/5 text-ink/70">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-tight text-ink">{r.title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-ink/60">{r.line}</span>
      </span>
      <Badge tone={r.unread ? 'quiet' : who.tone} data={`collection-${r.key}`}>
        {r.unread ? 'Not read' : who.word}
      </Badge>
    </>
  );
  const rowClass = 'flex min-h-[60px] items-center gap-3 py-2.5';
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
  // A fragment opens a fold on THIS page — a plain anchor, so the browser sends the hashchange the fold listens for
  // (a client-router link would move the address without one).
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
