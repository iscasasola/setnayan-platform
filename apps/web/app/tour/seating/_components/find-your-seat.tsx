'use client';

/**
 * FindYourSeat — the public-tour "find your table" experience (Stop 3 · client-only).
 *
 * The parent RSC resolves the published floor plan (fetchTables), the seat
 * assignments (fetchAssignments), and a display-safe seat list ONCE, server-side,
 * and hands it all down as plain serializable props. This component is purely
 * presentational + locally interactive:
 *
 *   • Interactive — a name-search box. Typing filters the (already-loaded) seat
 *     list IN MEMORY; picking a match sets the highlighted table_id in LOCAL
 *     React state, which lights up that table on the reused <WayfindingMap> and
 *     draws the entrance path. NO server call; a reload resets it.
 *
 * The map itself is the shipped, props-only <WayfindingMap> (app/_components/
 * wayfinding-map.tsx) — reused verbatim, not forked. We only supply its props.
 *
 * PII: the seat list carries names + table mapping ONLY (the parent stripped the
 * internal guest_id and every contact / qr / meal field server-side). Nothing
 * sensitive reaches this client component.
 */

import { useMemo, useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import type { EventTableRow } from '@/lib/seating';
import type { EntrancePos } from '@/lib/indoor-blueprint';

/** One display-safe seat: a guest's name and the table it maps to. No ids,
 *  no contact, no seat number — just what a guest needs to find their place. */
export type TourSeat = {
  name: string;
  tableId: string;
  tableLabel: string;
};

type Props = {
  tables: EventTableRow[];
  seats: TourSeat[];
  entrance: EntrancePos;
};

const MAX_SUGGESTIONS = 6;

export function FindYourSeat({ tables, seats, entrance }: Props) {
  const [query, setQuery] = useState('');
  const [targetTableId, setTargetTableId] = useState<string | null>(null);

  // In-memory filter. Pure substring match on the already-loaded list — no
  // network, no fetch. Empty query shows nothing (the map stays in its calm,
  // un-highlighted state until the guest types).
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return seats
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [seats, query]);

  const selected = useMemo(
    () => seats.find((s) => s.tableId === targetTableId) ?? null,
    [seats, targetTableId],
  );

  function pick(seat: TourSeat) {
    setTargetTableId(seat.tableId);
    setQuery(seat.name);
  }

  function onChange(value: string) {
    setQuery(value);
    // Typing again clears the highlight so the map doesn't lie about a stale pick.
    if (targetTableId !== null) setTargetTableId(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
      {/* Search column */}
      <div className="rounded-2xl border border-[#C5A059]/40 bg-[#FBF8F1] p-5 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#8C6932]">
          Find your seat
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#1E2229]">Type your name</h2>
        <p className="mt-1.5 text-sm text-[#5F5E5A]">
          Start typing and we&rsquo;ll point you to your table.
        </p>

        <div className="relative mt-4">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A8F86]"
          />
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Maria"
            aria-label="Search for your name"
            className="min-h-[48px] w-full rounded-full border border-[#1E2229]/15 bg-white py-3 pl-10 pr-4 text-sm text-[#1E2229] outline-none transition-colors placeholder:text-[#9A8F86] focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/30"
          />
        </div>

        {/* Result list — in-memory, no network. */}
        <div className="mt-4">
          {query.trim() && matches.length === 0 ? (
            <p className="text-sm text-[#5F5E5A]">
              No guest by that name. Try another spelling.
            </p>
          ) : null}

          {matches.length > 0 ? (
            <ul className="flex flex-col gap-1.5" aria-label="Matching guests">
              {matches.map((seat) => {
                const isActive = seat.tableId === targetTableId && seat.name === query;
                return (
                  <li key={`${seat.name}-${seat.tableId}`}>
                    <button
                      type="button"
                      onClick={() => pick(seat)}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors ${
                        isActive
                          ? 'border-[#5C2542]/40 bg-[#5C2542]/[0.06]'
                          : 'border-[#1E2229]/10 bg-white hover:border-[#C5A059]/50 hover:bg-[#FBF6EA]'
                      }`}
                    >
                      <span className="truncate text-sm font-medium text-[#1E2229]">
                        {seat.name}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[#8C6932]">
                        <MapPin aria-hidden className="h-3.5 w-3.5" />
                        {seat.tableLabel}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* Confirmation line once a guest is picked. */}
        {selected ? (
          <div className="mt-4 rounded-xl border border-[#5C2542]/25 bg-[#5C2542]/[0.05] px-4 py-3">
            <p className="text-sm text-[#5F5E5A]">
              <span className="font-semibold text-[#1E2229]">{selected.name}</span>, you&rsquo;re at{' '}
              <span className="font-semibold text-[#5C2542]">{selected.tableLabel}</span>. Follow the
              path on the map.
            </p>
          </div>
        ) : null}
      </div>

      {/* Map column — the shipped read-only renderer, reused verbatim. */}
      <div>
        <WayfindingMap tables={tables} entrance={entrance} targetTableId={targetTableId} />
        <p className="mt-3 text-center text-xs text-[#9A8F86]">
          The stage sits at the top; your table glows when you pick a name.
        </p>
      </div>
    </div>
  );
}
