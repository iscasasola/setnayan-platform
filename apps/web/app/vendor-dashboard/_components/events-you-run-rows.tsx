import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { EventYouRun } from '@/lib/events-you-run';
import { RowIcon } from './supplier-today-first-screen';

/**
 * 🗂 One row per event this supplier RUNS as the hosts' coordinator (owner "approved", 2026-10-28; prototype
 * `coordinator_door_2026-10-28` frames A and B): the round mark · the couple's names · the event line · what the day
 * is to them (in the accent) · **Open ›** into the couple's own event dashboard.
 *
 * The SAME row on Today ("Events you run", `line` = "… · Coordinator") and on the Events tab (`placeLine` = "… ·
 * the venue"). A hairline row like every Today row — no frame; the whole row is the door (≥ 44 px).
 * Rows are handed in ALREADY live (`eventsYouRun` in `lib/events-you-run.ts`); this draws, it never decides.
 */
export function EventsYouRunRows({ events, where }: { events: readonly EventYouRun[]; where: 'today' | 'events' }) {
  return (
    <div className="[&>a:first-child]:border-t-0" data-events-you-run={where}>
      {events.map((e) => (
        <Link
          key={e.eventId}
          href={e.href}
          data-event-you-run={e.eventId}
          className="home-row min-h-11 !grid-cols-[36px_minmax(0,1fr)_auto]"
        >
          <RowIcon name="run" />
          <span className="min-w-0">
            <span className="home-t block truncate text-[15px] leading-tight text-ink">{e.name}</span>
            <span className="block truncate text-[13px] text-ink/60">{where === 'today' ? e.line : e.placeLine}</span>
            <span className="block truncate text-[13px] text-sn-accent">{e.status}</span>
          </span>
          <span className="inline-flex items-center gap-0.5 text-[14px] font-medium text-sn-accent">
            Open
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
          </span>
        </Link>
      ))}
    </div>
  );
}
