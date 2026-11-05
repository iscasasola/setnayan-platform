/**
 * /dev/supplier-lab?s=event-hub&view=day|scanner|announce — 🧭 THE SUPPLIER'S EVENT HUB (the live day-of page,
 * `on-the-day/live/[eventId]`) in its v13 frame, on the prototype's people (owner "Approved." 2026-10-29; prototype
 * `renderEventHub`). DEV-ONLY. It draws the REAL pieces the live page draws — `EventHubBar`, `EventHubCounts`, the
 * Scanner and Announce views, the `FloorClock` and the `RunOfShowHeader` — over fixtures; the specialization desks
 * (Floor Command's requests and seat finder, the song desk, the stage script) read the database and are stood in by a
 * line naming them. Nothing is written from here.
 */
import { EventHubBar, EventHubCounts } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/event-hub-bar';
import { EventHubAnnounce, EventHubScanner } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/event-hub-views';
import { FloorClock } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-clock';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import { ScheduleUpdater } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/schedule-updater';
import { nextAdvanceAction, remainingBlockCount } from '@/lib/floor-command';
import { eventHubViewOf } from '@/lib/event-hub-views';
import type { EventYouRun } from '@/lib/events-you-run';
import type { RunOfShowBlock } from '@/lib/run-of-show';

const at = (hhmm: string) => `2026-12-18T${hhmm}:00Z`; // the venue's wall clock in a UTC column
const block = (id: string, hhmm: string, label: string, run_state: RunOfShowBlock['run_state']): RunOfShowBlock => ({
  block_id: id,
  label,
  start_at: at(hhmm),
  end_at: null,
  location: null,
  run_state,
  actual_start_at: null,
});
const BLOCKS: RunOfShowBlock[] = [
  block('b1', '13:00', 'Call time · crew at Seda Vertis North', 'done' as RunOfShowBlock['run_state']),
  block('b2', '14:00', 'Styling walk-through · ceremony arch', 'live' as RunOfShowBlock['run_state']),
  block('b3', '14:30', 'Guests arrive · check-in at the door', 'upcoming' as RunOfShowBlock['run_state']),
  block('b4', '15:00', 'Processional', 'upcoming' as RunOfShowBlock['run_state']),
  block('b5', '18:30', 'Dinner is served', 'upcoming' as RunOfShowBlock['run_state']),
];
const RUN = {
  eventId: 'ic',
  name: 'Indalecio & Claire',
  line: 'Wedding · Coordinator',
  seatWord: 'Coordinator',
  canAnnounce: true,
  placeLine: 'Wedding · Seda Vertis North',
  status: 'Today',
  needs: '',
  anchor: { event_type: 'wedding', event_date: '2026-12-18', date_candidates: null, date_window_start: null, created_at: null },
  href: '/dashboard/ic',
  rank: 0,
  date: '2026-12-18',
} as unknown as EventYouRun;

/**
 * 🗓 The run of show after a Change the schedule (2026-11-04): `moved` = Guests arrive moved later 10 min, the parts after
 * it with it; `skipped` = Processional skipped. Fixtures only — the lab's Move / Skip write nothing (no database here).
 */
function blocksAfter(state: string | undefined): RunOfShowBlock[] {
  if (state === 'moved') {
    return BLOCKS.map((b, i) => (i >= 2 ? { ...b, start_at: new Date(Date.parse(b.start_at) + 10 * 60_000).toISOString().replace('.000Z', 'Z') } : b));
  }
  if (state === 'skipped') return BLOCKS.map((b) => (b.block_id === 'b4' ? { ...b, run_state: 'skipped' } : b));
  return BLOCKS;
}

export function EventHubLab({ view: rawView, state }: { view?: string; state?: string }) {
  const view = eventHubViewOf(rawView);
  const blocks = blocksAfter(state);
  return (
    <div className="min-h-screen bg-paper" data-supplier-lab="event-hub">
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6" data-event-hub-view={view}>
        <div>
          <EventHubBar
            eventId="ic"
            name="Indalecio & Claire"
            dayWords="Fri, Dec 18"
            view={view}
            exitHref="/vendor-dashboard/on-the-day?event=ic"
            chatHref="/vendor-dashboard/messages/t-ic"
            about="Seda Vertis North, Quezon City · 162 of 180 guests coming · Your tools for the day — only this event."
          />
          <EventHubCounts
            tiles={[
              { key: 'now', value: '2:00 PM', word: 'now · Styling walk-through', href: '#schedule', hot: true },
              { key: 'next', value: state === 'moved' ? '2:40 PM' : '2:30 PM', word: 'next · Guests arrive', href: '#schedule' },
              { key: 'coming', value: '162/180', word: 'coming (RSVP)' },
            ]}
          />
        </div>
        {view === 'scanner' ? (
          <EventHubScanner eventId="ic" run={RUN} floorIsYours />
        ) : view === 'announce' ? (
          <EventHubAnnounce
            eventId="ic"
            run={RUN}
            enabled
            recent={[{ broadcast_id: 'a1', body: 'Please take your seats', sender_role: 'coordinator', created_at: '2026-12-18T06:20:00Z' } as never]}
          />
        ) : (
          <>
            <div id="schedule" className="sn-tile-dark relative p-5 sm:p-6">
              <p className="truncate text-2xl font-light text-paper">Indalecio &amp; Claire</p>
              <p className="mt-0.5 truncate text-sm text-paper/60">Seda Vertis North, Quezon City</p>
              <div className="mt-4">
                <FloorClock blocks={blocks} />
              </div>
            </div>
            <RunOfShowHeader eventId="ic" initial={blocks} />
            {/* Floor Command's running order — the REAL control (Start / Done · next and Change the schedule). */}
            <ScheduleUpdater
              eventId="ic"
              action={nextAdvanceAction(blocks, new Date('2026-12-18T14:10:00Z'))}
              remaining={remainingBlockCount(blocks)}
              driftMinutes={null}
              parts={blocks}
              crewAsks={
                state === 'asks'
                  ? [
                      { suggestionId: 's1', blockId: 'b4', who: 'Ate Joy Mendoza', label: 'Processional', startAt: at('15:00') },
                      { suggestionId: 's2', blockId: 'b5', who: 'Kuya Ben', label: 'Dinner is served', startAt: at('18:30') },
                    ]
                  : []
              }
            />
            <p className="text-[13px] text-ink/60" data-lab-standin="">
              Below this on the live page: Floor Command&rsquo;s requests and seat finder, the headcount, your tools and live
              reviews — read from the database, not drawn in the lab.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
