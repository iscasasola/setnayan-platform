import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { EventYouRun } from '@/lib/events-you-run';
import { RowIcon, TodayEyebrow } from './supplier-today-first-screen';

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
            <span className="block truncate text-[13px] text-sn-accent" data-needs="">{e.needs}</span>
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

/** The shipped Check-in desk's address for an event (`app/dashboard/[eventId]/guests/checkin`). */
export const checkinDeskHref = (eventId: string) => `/dashboard/${eventId}/guests/checkin`;

/**
 * 🎫 **Check-in desk** — one row per event this supplier runs as the hosts' coordinator, on their Hub (owner,
 * verbatim, 2026-10-28: *"coordinators can also scan qr codes for attendance in the reception"*). Each opens the
 * couple's SHIPPED desk, which admits a live coordinator through its own check (a `coordinator` member whose guest
 * list is shared — the hosts' switch ON shares it). Only events still ahead or today: after the day there is no door
 * to scan at. Hairline rows, no frame; the whole row is the door.
 */
export function CheckinDeskRows({ events }: { events: readonly EventYouRun[] }) {
  const live = events.filter((e) => e.rank !== 2);
  if (live.length === 0) return null;
  return (
    <div data-hub-checkin="">
      <TodayEyebrow>Check-in desk</TodayEyebrow>
      <div className="[&>a:first-child]:border-t-0">
        {live.map((e) => (
          <Link
            key={e.eventId}
            href={checkinDeskHref(e.eventId)}
            data-hub-checkin-row={e.eventId}
            className="home-row min-h-11 !grid-cols-[36px_minmax(0,1fr)_auto]"
          >
            <RowIcon name="scan" />
            <span className="min-w-0">
              <span className="home-t block truncate text-[15px] leading-tight text-ink">{e.name}</span>
              <span className="block truncate text-[13px] text-ink/60">Scan guests in at the reception · {e.status}</span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[14px] font-medium text-sn-accent">
              Open
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** The shipped announcement composer's address (`schedule/_components/announce-button.tsx`), opened on arrival. */
export const messageEveryoneHref = (eventId: string) => `/dashboard/${eventId}/schedule?announce=1`;

/**
 * 📣 **Message everyone** — one row per event this supplier runs where the broadcast's own rule lets them send (S9,
 * owner 2026-10-29: the coordinator's tools *"must exist on the supplier dashboard as well"*). Each opens the couple's
 * SHIPPED announcement sheet on the Schedule (`sendCoordinatorBroadcast` → `coordinator_broadcasts`) — no new
 * channel. Drawn only while the feature is on (`enabled`, the Schedule's own `isCoordinatorP3Enabled`) and only for
 * events still ahead or today. Hairline rows, the whole row is the door.
 */
export function MessageEveryoneRows({ events, enabled }: { events: readonly EventYouRun[]; enabled: boolean }) {
  const live = enabled ? events.filter((e) => e.rank !== 2 && e.canAnnounce) : [];
  if (live.length === 0) return null;
  return (
    <div data-message-everyone="">
      <TodayEyebrow>Message everyone</TodayEyebrow>
      <div className="[&>a:first-child]:border-t-0">
        {live.map((e) => (
          <Link
            key={e.eventId}
            href={messageEveryoneHref(e.eventId)}
            data-message-everyone-row={e.eventId}
            className="home-row min-h-11 !grid-cols-[36px_minmax(0,1fr)_auto]"
          >
            <RowIcon name="chat" />
            <span className="min-w-0">
              <span className="home-t block truncate text-[15px] leading-tight text-ink">{e.name}</span>
              <span className="block truncate text-[13px] text-ink/60">An announcement every guest sees</span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[14px] font-medium text-sn-accent">
              Write
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** The live console's seat finder (`on-the-day/live/[eventId]` · `SeatScanner`, anchored `#seat-finder`). */
export const seatFinderHref = (eventId: string) => `/vendor-dashboard/on-the-day/live/${eventId}#seat-finder`;

/**
 * 🪑 **Find a guest's seat** — one row on the Hub for today's booked event (S9, owner 2026-10-29), straight to the
 * SHIPPED scanner inside its live console, which keeps its own rule (the hosts shared the seat plan, or it says why
 * it is closed). The same hairline row as the Check-in desk.
 */
export function SeatFinderRow({ eventId, name }: { eventId: string; name: string }) {
  return (
    <div data-hub-seat-finder="">
      <div className="[&>a:first-child]:border-t-0">
        <Link href={seatFinderHref(eventId)} className="home-row min-h-11 !grid-cols-[36px_minmax(0,1fr)_auto]">
          <RowIcon name="scan" />
          <span className="min-w-0">
            <span className="home-t block truncate text-[15px] leading-tight text-ink">Find a guest’s seat</span>
            <span className="block truncate text-[13px] text-ink/60">Scan their pass · {name}</span>
          </span>
          <span className="inline-flex items-center gap-0.5 text-[14px] font-medium text-sn-accent">
            Open
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
          </span>
        </Link>
      </div>
    </div>
  );
}
