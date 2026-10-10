/**
 * Find a supplier — a category's suppliers, as rows (frame 7).
 *
 * The rows are the page's own, moved here unchanged so they can be drawn twice
 * — the suppliers in reach, and (once asked for) the ones farther away — and so
 * `/dev/suppliers-lab?find=<category>` can draw the SAME rows on fixtures at
 * 375 px. No 'use client': it is rendered on the server, and only the
 * pressable bit (Ask for a quote) is a client component.
 */
import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';
import { formatPhpRounded } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import type { CategoryVendorResult } from '../../_actions/category-search';
import { FindAskButton, ShowFartherButton } from './find-supplier-controls';

export type FindSupplierRow = Pick<
  CategoryVendorResult,
  'vendorProfileId' | 'name' | 'logoUrl' | 'city' | 'startsAtPhp' | 'rating' | 'reviewCount' | 'relationshipDepth'
>;

export function FindSupplierList({
  eventId,
  tile,
  rows,
}: {
  eventId: string;
  /** The category being browsed — what asking files the supplier under. */
  tile: string;
  rows: readonly FindSupplierRow[];
}) {
  return (
    <ul className="mt-2">
      {rows.map((r) => {
        const isBooked = r.relationshipDepth === 3;
        const initials = r.name
          .split(/\s+/)
          .map((w) => w[0] ?? '')
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return (
          <li key={r.vendorProfileId} className="border-t border-ink/10 py-3">
            <div className="flex items-start gap-3">
              {r.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.logoUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/5 text-[13px] font-semibold text-ink/70"
                >
                  {initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{r.name}</p>
                <p className="text-[13px] text-ink/60">
                  {[r.city, r.startsAtPhp != null ? `from ${formatPhpRounded(r.startsAtPhp)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {r.rating != null ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-ink/60">
                    <Star className="h-3 w-3" aria-hidden />
                    {r.rating.toFixed(1)}
                    {r.reviewCount ? ` · ${formatCount(r.reviewCount)}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-14">
              {isBooked ? (
                <>
                  <span className="text-[12.5px] font-semibold text-ink/60">Booked</span>
                  <Link
                    href={`/dashboard/${eventId}/messages`}
                    className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-mulberry"
                  >
                    Open chat
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </>
              ) : (
                // ONE button — the approved row (`ib('chat','Ask for a quote',…,
                // 'main')`). "Save" is retired here: owner 2026-10-07, "Save is
                // retired because the marketplace now sits on the page". Asking
                // saves the supplier as it asks (`FindAskButton`).
                <FindAskButton eventId={eventId} vendorProfileId={r.vendorProfileId} tile={tile} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * FARTHER AWAY (owner 2026-10-10: "yes offer the farther away option. in case
 * the need to search more"). Find lists the suppliers who reach the event's
 * place; this is the shipped expander from the bench's search overlay, with its
 * words: closed, one row to open it; open, a divider and the suppliers outside
 * their service area, nearest first — or the overlay's sentence when there are
 * none.
 *
 * `rows` is null while closed (nothing was searched). The caller searches with
 * `includeFarther` AND `hideUnbookable`: farther is about distance only.
 */
export function FindFartherAway({
  eventId,
  tile,
  openHref,
  rows,
}: {
  eventId: string;
  tile: string;
  /** The same page with `far=1` — where the row goes when pressed. */
  openHref: string;
  rows: readonly FindSupplierRow[] | null;
}) {
  if (rows === null) return <ShowFartherButton href={openHref} />;
  return (
    <div data-find-farther-open="">
      <div className="mx-0.5 mb-3 mt-1.5 flex items-center gap-2.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink/55 before:h-px before:flex-1 before:bg-ink/15 before:content-[''] after:h-px after:flex-1 after:bg-ink/15 after:content-['']">
        <span>Farther away · outside their service area</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink/65">
          No suppliers farther away — everyone covering your area is listed above.
        </p>
      ) : (
        <FindSupplierList eventId={eventId} tile={tile} rows={rows} />
      )}
    </div>
  );
}
