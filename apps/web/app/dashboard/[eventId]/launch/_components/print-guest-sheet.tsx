'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
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
