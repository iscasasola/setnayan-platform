/**
 * Travel itinerary chrome (ai-travel-scheduling) — rendered ONLY for
 * `event_type='travel'` events on the Schedule page's Event-Day view; every
 * other event type never mounts these, so their schedule surface is
 * byte-identical.
 *
 * Two server-rendered pieces over the pure lib/schedule-travel engine:
 *
 *   • TravelClashGuard — the GRD-06 clash guard rows (overlapping tours +
 *     nights with no hotel booked), styled the way guards render everywhere
 *     else (the dashboard Watch idiom: GUARD eyebrow + deterministic copy).
 *   • TravelItineraryView — the day-by-day lens: each trip day with the
 *     hotel night-block covering that night and the tour time-blocks on it.
 *
 * Read-only projections of the one master timeline — blocks are still
 * added/edited/deleted through the existing block cards below them.
 */
import { AlertTriangle, BedDouble, Compass, MoonStar } from 'lucide-react';

import { formatBlockTime, formatBlockTimeRange } from '@/lib/schedule';
import {
  travelClashCopy,
  type TravelClash,
  type TravelItinerary,
} from '@/lib/schedule-travel';
import type { ScheduleBlockRow } from '@/lib/schedule';

/** The GRD-06 clash guard — overlapping tour time-blocks + lodging-gap
 *  nights. Renders nothing when the itinerary is conflict-free. */
export function TravelClashGuard({ clashes }: { clashes: TravelClash[] }) {
  if (clashes.length === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5">
      <header className="space-y-1">
        <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Guard · itinerary clashes · {clashes.length}
        </p>
        <p className="max-w-prose text-sm text-ink/65">
          Your trip has scheduling conflicts. Fix the times below — no two tours
          can share a slot, and every trip night needs a stay.
        </p>
      </header>
      <ul className="space-y-2">
        {clashes.map((clash, i) => (
          <li
            key={
              clash.kind === 'tour_overlap'
                ? `overlap:${clash.slot}:${clash.itemA}:${clash.itemB}`
                : `gap:${clash.nights[0] ?? i}`
            }
            className="flex gap-2.5"
          >
            <span
              aria-hidden
              className="mt-1.5 h-2 w-2 flex-none rounded-full bg-terracotta"
            />
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.13em] text-terracotta">
                {clash.kind === 'tour_overlap' ? 'Tours clash' : 'Night uncovered'}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink/75">
                {travelClashCopy(clash)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The day-by-day itinerary lens: hotel night-blocks + tour time-blocks per
 *  trip day. Renders nothing until the trip has at least one day on file. */
export function TravelItineraryView({
  itinerary,
}: {
  itinerary: TravelItinerary<ScheduleBlockRow>;
}) {
  if (itinerary.days.length === 0) return null;
  return (
    <section className="space-y-3">
      <p className="sn-eye">
        Trip itinerary · {itinerary.days.length} day
        {itinerary.days.length === 1 ? '' : 's'}
      </p>
      <ol className="space-y-2">
        {itinerary.days.map((day) => (
          <li key={day.dayKey} className="sn-row space-y-2 p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                Day {day.dayNumber}
                <span className="ml-2 font-mono text-xs font-normal text-ink/55">
                  {day.dateLabel}
                </span>
              </p>
              {day.isLodgingGap ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
                  <MoonStar aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                  No stay booked
                </span>
              ) : null}
            </header>
            {day.tours.length === 0 && day.lodging.length === 0 ? (
              <p className="text-xs text-ink/50">
                Nothing planned yet — add a tour or activity for this day.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {day.tours.map((t) => (
                  <li key={t.block_id} className="flex items-center gap-2 text-sm text-ink/80">
                    <Compass
                      aria-hidden
                      className="h-3.5 w-3.5 flex-none text-ink/45"
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 truncate">{t.label}</span>
                    <span className="ml-auto flex-none font-mono text-xs text-ink/55">
                      {t.end_at
                        ? formatBlockTimeRange(t.start_at, t.end_at)
                        : formatBlockTime(t.start_at)}
                    </span>
                  </li>
                ))}
                {day.lodging.map((l) => (
                  <li key={l.block_id} className="flex items-center gap-2 text-sm text-ink/80">
                    <BedDouble
                      aria-hidden
                      className="h-3.5 w-3.5 flex-none text-ink/45"
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 truncate">{l.label}</span>
                    <span className="ml-auto flex-none font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                      Overnight
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
