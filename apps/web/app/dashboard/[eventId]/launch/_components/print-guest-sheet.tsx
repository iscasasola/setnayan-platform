'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Search } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { MAX_PICKED_GUESTS, filterPickGuests, pickFilterValues, pickedGuestsHref } from '@/lib/print-picked-guests';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { PrintSaveButton } from './print-save-button';
import { formatCount } from '@/lib/format-number';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { GUEST_SEARCH_FROM, guestPickGroups, type PrintGuest } from '@/lib/studio-prints-settings';
import { groupHeadClass, pickOptionClass, pickTickClass } from '../../website/editor/_components/pick-menu-place';

/**
 * 👤 VIEW AS ▾ — WHICH GUEST (owner 2026-10-17, prototype `prints_settings_and_downloads_2026-10-17.html` `openGuests`; controller
 * 2026-10-17: *"View as ▾ must have the prototype's 'Search guests' box. Real events have 100–200 guests"*).
 *
 * The guest picker of every guest print, as a sheet: "Search guests" at its head once the list is longer than `GUEST_SEARCH_FROM`,
 * then the guests in their groups — Coming · N, Not replied yet · N, Maybe · N — a tick on the guest shown. A typed search filters
 * every group and keeps each head with its WHOLE count (`guestPickGroups`); nothing matched is said.
 *
 * ⚡ ITS OWN LAZY PIECE: `studio-prints-settings.tsx` imports it with `dynamic()` the first time View as ▾ is pressed — the shared
 * house dropdown (`PickMenu`, at its inline-size line) never grows, and nothing of it is in the Maker's first load.
 * The option and head looks are the house dropdown's own (`pick-menu-place.ts`).
 */
export function GuestPickSheet({
  guests,
  value,
  onPick,
  onClose,
}: {
  guests: readonly PrintGuest[];
  value: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const headId = useId();
  useModalA11y({ open: true, onClose, containerRef: box });
  const groups = useMemo(() => guestPickGroups(guests, query), [guests, query]);
  const searchable = guests.length > GUEST_SEARCH_FROM;
  const node = (
    <div data-print-guest-sheet-layer="" className="fixed inset-0 z-[96]">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink/35" />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        data-print-guest-sheet=""
        className="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col rounded-t-3xl bg-cream shadow-[0_-18px_40px_-18px_rgba(30,26,18,.45)] lg:inset-x-auto lg:left-1/2 lg:w-[26rem] lg:-translate-x-1/2"
      >
        <div aria-hidden className="flex justify-center pt-2.5">
          <i className="h-1 w-10 rounded-full bg-ink/20" />
        </div>
        <h2 id={headId} className="px-5 pb-2 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink/55">
          View as
        </h2>
        {searchable ? (
          <label data-print-guest-search="" className="mx-4 mb-2 flex h-11 items-center gap-2 rounded-xl bg-ink/[0.05] px-3.5 text-ink/55">
            <Search aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.9} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guests"
              aria-label="Search guests"
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-ink/45 focus:outline-none"
            />
          </label>
        ) : null}
        <ul role="listbox" aria-label="View as — which guest" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {groups.map((g, gi) => (
            <li key={g.head} role="group" aria-label={g.head} data-pick-group={g.head} className={gi > 0 ? 'mt-1 border-t border-ink/10 pt-1' : ''}>
              <p aria-hidden className={groupHeadClass(true)}>
                {g.head}
              </p>
              <ul role="none">
                {g.options.map((o) => (
                  <li key={o.key} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.key === value}
                      data-pick-option={o.key}
                      onClick={() => {
                        onPick(o.key);
                        onClose();
                      }}
                      className={pickOptionClass(false, o.key === value)}
                    >
                      <span className="font-semibold">{o.label}</span>
                      {o.key === value ? (
                        <span aria-hidden data-pick-tick="" className={pickTickClass(false)}>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {groups.length === 0 ? (
            <li role="none" data-print-guest-search-none="" className="px-3 py-4 text-[14px] text-ink/60">
              No guest named “{query.trim()}”.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}

/**
 * 🎟 PICK GUESTS — SOME GUESTS' PASSES OR QR CODES IN ONE FILE (owner 2026-10-25: *"instead of just making me select all, allow me to
 * pick multiple guests to compile together as well."*).
 *
 * Opened in place from "Pick guests" beside "All guests" (which stays the default) on the Event pass and the Guest QR codes rows.
 * The shared `Sheet`: "Search guests", Side ▾ and Group ▾ (the house dropdown, `PickMenu` — never a pill row), the guests with a tick
 * box each, "Select all shown" / "Clear", "12 picked", and ONE button — "Print 12 passes". The file is the all-guests file's own
 * address narrowed by `guests=<ids>` (`pickedGuestsHref`); the route checks every id against this event's list and refuses one it
 * does not know (`lib/print-picked-guests.ts`). Same lazy chunk as View as ▾.
 */
export function GuestManySheet({
  guests,
  href,
  file,
  noun,
  onClose,
}: {
  guests: readonly PrintGuest[];
  /** The all-guests file's address. */
  href: string;
  /** The all-guests file's name — the picked file is named after it. */
  file: string;
  /** What one guest's thing is called — "pass" · "QR code". */
  noun: { one: string; many: string };
  onClose: () => void;
}) {
  const headId = useId();
  const [query, setQuery] = useState('');
  const [side, setSide] = useState('');
  const [group, setGroup] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const sides = useMemo(() => pickFilterValues(guests, (g) => g.side), [guests]);
  const groups = useMemo(() => pickFilterValues(guests, (g) => g.group), [guests]);
  const shown = useMemo(() => filterPickGuests(guests, { query, side, group }), [guests, query, side, group]);
  const ids = useMemo(() => guests.filter((g) => picked.has(g.id)).map((g) => g.id), [guests, picked]);
  const over = ids.length > MAX_PICKED_GUESTS;
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const n = ids.length;
  const words = `Print ${formatCount(n)} ${n === 1 ? noun.one : noun.many}`;
  /* Portalled like View as ▾'s sheet: the row it opens from can sit inside a scrolling, transformed or hidden panel. */
  const node = (
    <Sheet open onClose={onClose} labelledById={headId}>
      <div data-print-pick-sheet="" className="flex max-h-[80dvh] min-h-0 flex-col">
        <h2 id={headId} className="px-5 pb-2 pt-4 font-display text-[19px] text-ink">
          Pick guests
        </h2>
        <label data-print-pick-search="" className="mx-4 mb-2 flex h-11 shrink-0 items-center gap-2 rounded-xl bg-ink/[0.05] px-3.5 text-ink/55">
          <Search aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.9} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guests"
            aria-label="Search guests"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-ink/45 focus:outline-none"
          />
        </label>
        {sides.length > 0 || groups.length > 0 ? (
          <div data-print-pick-filters="" className="flex shrink-0 flex-wrap gap-2 px-4 pb-2">
            {sides.length > 0 ? (
              <PickMenu label="Side" value={side} options={[{ key: '', label: 'Any side' }, ...sides.map((s) => ({ key: s, label: s }))]} onPick={setSide} dataAttr="data-print-pick-side" compact />
            ) : null}
            {groups.length > 0 ? (
              <PickMenu label="Group" value={group} options={[{ key: '', label: 'Any group' }, ...groups.map((s) => ({ key: s, label: s }))]} onPick={setGroup} dataAttr="data-print-pick-group" compact />
            ) : null}
          </div>
        ) : null}
        <div className="flex shrink-0 items-center gap-3 border-b border-ink/10 px-5 pb-2 text-[13px]">
          <span data-print-pick-count="" className="font-semibold text-ink">
            {formatCount(n)} picked
          </span>
          <button
            type="button"
            data-print-pick-all-shown=""
            onClick={() => setPicked((p) => new Set([...p, ...shown.map((g) => g.id)]))}
            className="ml-auto min-h-10 font-medium text-terracotta"
          >
            Select all shown
          </button>
          <button type="button" data-print-pick-clear="" onClick={() => setPicked(new Set())} className="min-h-10 font-medium text-ink/60">
            Clear
          </button>
        </div>
        <ul aria-label="Guests" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
          {shown.map((g) => (
            <li key={g.id}>
              <label data-print-pick-guest={g.id} className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-ink/[0.04]">
                <input type="checkbox" checked={picked.has(g.id)} onChange={() => toggle(g.id)} className="h-5 w-5 shrink-0 accent-terracotta" />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{g.name}</span>
                {g.side || g.group ? <span className="shrink-0 text-[12px] text-ink/50">{[g.side, g.group].filter(Boolean).join(' · ')}</span> : null}
              </label>
            </li>
          ))}
          {shown.length === 0 ? (
            <li data-print-pick-none="" className="px-3 py-4 text-[14px] text-ink/60">
              No guest matches.
            </li>
          ) : null}
        </ul>
        <div className="shrink-0 border-t border-ink/10 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3" data-print-pick-print="">
          {over ? <p className="pb-2 text-[12.5px] text-ink/60">Pick up to {formatCount(MAX_PICKED_GUESTS)} guests at a time — or print All guests.</p> : null}
          {n > 0 && !over ? (
            <PrintSaveButton href={pickedGuestsHref(href, ids)} file={file.replace(/\.pdf$/, `-${formatCount(n)}-picked.pdf`)} variant="action" main wide label={words} />
          ) : (
            <ActionButton tone="brand" main label={n > 0 ? words : `Print ${noun.many}`} icon={Printer} disabled />
          )}
        </div>
      </div>
    </Sheet>
  );
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}
