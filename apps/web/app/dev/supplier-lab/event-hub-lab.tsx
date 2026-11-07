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
import type { EventScanService } from '@/lib/supplier-scan.server';
import type { ScanAnswer } from '@/lib/supplier-scan';

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
 * 🎟 `&scan=` on the Scanner view — the supplier claim scanner on lab numbers (prototype
 * `supplier_scan_2026-10-03_fable.html` frames B · C′): `on` a photo booth in Once, 41 claimed of 118 · `two` a second
 * service (the service dropdown) · `fresh` no scans yet · `unread` the list could not be read. `&answer=` opens on a
 * result line: claimed · already · souvenir-desk · not · nosignal · name (a host-approved coordinator's view).
 */
const SCAN_SERVICES: Record<string, EventScanService[] | 'unreadable'> = {
  on: [{ coverageId: 1, label: 'Photo booth', mode: 'once', tally: { claimed: 41, total: 118, lastNumber: 41, souvenir: false, ordered: 0, ready: 0, served: 0, unique: 0, sessions: 0, open: null } }],
  two: [
    { coverageId: 1, label: 'Photo booth', mode: 'once', tally: { claimed: 41, total: 118, lastNumber: 41, souvenir: false, ordered: 0, ready: 0, served: 0, unique: 0, sessions: 0, open: null } },
    { coverageId: 2, label: 'Souvenir / Giveaways', mode: 'once', tally: { claimed: 96, total: 118, lastNumber: 88, souvenir: true, ordered: 0, ready: 0, served: 0, unique: 0, sessions: 0, open: null } },
  ],
  fresh: [{ coverageId: 1, label: 'Photo booth', mode: 'once', tally: { claimed: 0, total: 118, lastNumber: 0, souvenir: false, ordered: 0, ready: 0, served: 0, unique: 0, sessions: 0, open: null } }],
  unread: 'unreadable',
  // Ordered → Received (slice 2): prints — 38 numbers, 12 ordered, 3 ready, 20 received.
  // Unlimited (slice 3): 214 scans, 96 guests.
  unlimited: [{ coverageId: 4, label: 'Photo booth', mode: 'unlimited', tally: { claimed: 96, total: 118, lastNumber: 214, souvenir: false, ordered: 0, ready: 0, served: 214, unique: 96, sessions: 0, open: null } }],
  // Group session (slice 3): shot #0107 open with 3 guests; 41 shots so far.
  group: [{ coverageId: 5, label: 'Photo booth', mode: 'group_session', tally: { claimed: 88, total: 118, lastNumber: 107, souvenir: false, ordered: 9, ready: 6, served: 0, unique: 103, sessions: 41, open: { number: 107, guests: 3 } } }],
  'group-idle': [{ coverageId: 5, label: 'Photo booth', mode: 'group_session', tally: { claimed: 88, total: 118, lastNumber: 106, souvenir: false, ordered: 6, ready: 6, served: 0, unique: 100, sessions: 40, open: null } }],
  // Roaming (slice 4): shot #0231 open with 2 guests.
  roaming: [{ coverageId: 6, label: 'Photo & video', mode: 'roaming', tally: { claimed: 57, total: 118, lastNumber: 231, souvenir: false, ordered: 4, ready: 8, served: 0, unique: 70, sessions: 64, open: { number: 231, guests: 2 } } }],
  prints: [{ coverageId: 3, label: 'Photo booth prints', mode: 'ordered_received', tally: { claimed: 20, total: 118, lastNumber: 38, souvenir: false, ordered: 12, ready: 3, served: 0, unique: 0, sessions: 0, open: null } }],
};
const SCAN_ANSWERS: Record<string, ScanAnswer> = {
  claimed: { outcome: 'claimed', number: 42, claimed: 42, total: 118 },
  already: { outcome: 'already', number: 17 },
  'souvenir-desk': { outcome: 'already', number: null },
  not: { outcome: 'not_guest' },
  nosignal: { outcome: 'no_signal' },
  first: { outcome: 'claimed', number: 42, claimed: 42, total: 118, name: 'Ana' },
  name: { outcome: 'claimed', number: 42, claimed: 42, total: 118, name: 'Ana Reyes' },
  ordered: { outcome: 'ordered', number: 42 },
  'not-ready': { outcome: 'not_ready', number: 42 },
  received: { outcome: 'received', number: 42, claimed: 21, total: 118 },
  served: { outcome: 'served', number: 215, served: 215, unique: 96 },
  added: { outcome: 'added', number: 107, guests: 3 },
  'picked-up': { outcome: 'picked_up', number: 107, claimed: 3, of: 5 },
  'no-session': { outcome: 'no_session' },
  'roam-added': { outcome: 'added', number: 231, guests: 2, mode: 'roaming' },
};

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

export function EventHubLab({ view: rawView, scan, answer, state }: { view?: string; scan?: string; answer?: string; state?: string }) {
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
          <EventHubScanner
            eventId="ic"
            run={scan ? null : RUN}
            floorIsYours={!scan}
            scan={scan ? (SCAN_SERVICES[scan] ?? []) : []}
            scanAnswer={answer ? (SCAN_ANSWERS[answer] ?? null) : null}
          />
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
