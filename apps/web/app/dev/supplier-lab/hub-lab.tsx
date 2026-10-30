/**
 * /dev/supplier-lab?s=hub — 🗓 THE SUPPLIER'S HUB (set up) on the prototype's own people (supplier dashboard v13, owner
 * "Approved." 2026-10-29; prototype `renderHub`, its sample shop "The Wedding Project"). DEV-ONLY. Lab today = Fri 18 Dec
 * 2026 — Indalecio & Claire's day — so "Open the Event Hub" shows as it does on the day (it opens on the day only).
 *
 *   &seg=setup|crew|pages   the three segments (Set up · Crew · The event's pages)
 *   &ev=ic                  Indalecio & Claire — you run it AND your shop is booked (today)
 *   &ev=rf                  Reyes & Flores — your service only (styling), ahead
 *   &ev=lk                  a day still locked by its booking fee — Set up is the lock, nothing else
 *   &ev=mj                  Marco & Joy — you run it, your shop holds no day on it
 *   &shell=1                inside the REAL One Shell (the Hub ▾ moves up into the pinned row from 701)
 *
 * It draws the REAL Hub components (`HubScreen` · `HubEventMenu` · `HubEventCard` · the shipped tools configurator ·
 * the shipped team switches · the door rows) over fixtures. The writes those components carry are the SHIPPED actions;
 * with no session every one refuses — nothing is written from here.
 */
import { resolveModules } from '@/lib/vendor-dayof-modules';
import { forYourServicePages } from '@/lib/supplier-event-lines';
import { Armchair, CalendarDays, ClipboardList, FileText, Palette, PanelsTopLeft, Users } from 'lucide-react';
import { hubAddChoices, hubEvents, hubScheduleLine, hubSegmentOf, pickHubEvent, type HubEvent, type HubSegment } from '@/lib/hub-events';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import { HubEventMenu } from '@/app/vendor-dashboard/on-the-day/_components/hub-event-menu';
import {
  HubDoorRow,
  HubEventCard,
  HubEventInfo,
  HubEyebrow,
  HubLockRow,
  HubPageRow,
  HubPageRows,
  HubRunOfShow,
  HubScreen,
} from '@/app/vendor-dashboard/on-the-day/_components/hub-screen';
import { HubThumbRow } from '@/app/vendor-dashboard/on-the-day/_components/hub-thumb-row';
import { ModuleConfigurator } from '@/app/vendor-dashboard/on-the-day/_components/module-configurator';
import { AccessGrants } from '@/app/vendor-dashboard/on-the-day/_components/access-grants';
import { CheckinDeskRows, MessageEveryoneRows, SeatFinderRow } from '@/app/vendor-dashboard/_components/events-you-run-rows';
import type { EventYouRun } from '@/lib/events-you-run';
import QRCode from 'qrcode';
import { CrewPanel } from '@/app/vendor-dashboard/on-the-day/_components/crew-panel';
import { CrewEventHub, CrewNameForm, CrewStatus } from '@/app/join/crew/[token]/_components/crew-screens';
import { CREW_STATUS_WORDS } from '@/lib/crew-pass';

export const HUB_LAB_TODAY = '2026-12-18';

const DAYS = [
  { eventId: 'ic', eventName: 'Indalecio & Claire', bookedDate: '2026-12-18' },
  { eventId: 'rf', eventName: 'Reyes & Flores', bookedDate: '2026-12-22' },
  { eventId: 'lk', eventName: 'Santos & Lim', bookedDate: '2027-01-30' },
  { eventId: 'old', eventName: 'Dela Rosa family', bookedDate: '2026-11-08' },
];
const RUNS = [
  { eventId: 'ic', name: 'Indalecio & Claire', date: '2026-12-18', href: '/dashboard/ic', canAnnounce: true, rank: 0 as const },
  { eventId: 'mj', name: 'Marco & Joy', date: '2027-02-06', href: '/dashboard/mj', canAnnounce: true, rank: 0 as const },
];
const LOCK = {
  headline: 'Pay the booking fee to open this event — its details, its Event Hub and its crew.',
  cta: 'Pay the booking fee',
  payHref: '/vendor-dashboard/booking-fees',
};

// A schedule time is the venue's WALL CLOCK stored in a UTC column (`formatWallClock`), so 13:00 is written 13:00Z.
const at = (hhmm: string) => `2026-12-18T${hhmm}:00Z`;
const block = (id: string, hhmm: string, label: string, location: string | null = null): RunOfShowBlock => ({
  block_id: id,
  label,
  start_at: at(hhmm),
  end_at: null,
  location,
  run_state: 'scheduled' as RunOfShowBlock['run_state'],
  actual_start_at: null,
});
const BLOCKS: RunOfShowBlock[] = [
  block('b1', '13:00', 'Call time · crew at Seda Vertis North', 'Lobby'),
  block('b2', '14:00', 'Styling walk-through · ceremony arch', 'Garden'),
  block('b3', '14:30', 'Guests arrive · check-in at the door', 'Foyer'),
  block('b4', '15:00', 'Processional', 'Garden'),
  block('b5', '15:40', 'Ceremony ends · photos'),
  block('b6', '17:00', 'Cocktails · reception doors open'),
  block('b7', '18:00', 'Grand entrance'),
  block('b8', '18:30', 'Dinner is served'),
  block('b9', '19:30', 'First dance · toasts'),
  block('b10', '20:30', 'Cake cutting'),
  block('b11', '21:30', 'Last dance · send-off'),
];

const PLACE: Record<string, string> = { ic: 'Seda Vertis North, Quezon City', rf: 'Taal Vista, Tagaytay' };

const runRow = (e: HubEvent): EventYouRun => ({
  eventId: e.eventId,
  name: e.name,
  line: 'Wedding · Coordinator',
  seatWord: 'Coordinator' as EventYouRun['seatWord'],
  canAnnounce: e.canAnnounce,
  placeLine: 'Wedding',
  status: 'Today',
  needs: '',
  anchor: { event_type: 'wedding', event_date: e.date, date_candidates: null, date_window_start: null, created_at: null },
  href: e.runHref ?? `/dashboard/${e.eventId}`,
  rank: 0,
  date: e.date,
});

export async function HubLab({ seg: rawSeg, ev }: { seg?: string; ev?: string }) {
  const seg: HubSegment = hubSegmentOf(rawSeg);
  const list = hubEvents({ days: DAYS, runs: RUNS, locks: { lk: LOCK }, today: HUB_LAB_TODAY });
  const event = pickHubEvent(list, ev ?? null)!;
  const tiles = event.eventId === 'rf' ? ['stylist_decorator'] : ['coordinator', 'stylist_decorator'];
  const modules = resolveModules(['coordinator', 'stylist_decorator'], tiles, null).map((m) => ({
    id: m.id,
    label: m.label,
    blurb: m.blurb,
    enabled: m.enabled,
    counselGated: m.counselGated,
  }));
  const run = event.runs ? runRow(event) : null;

  let body;
  if (event.lock) body = <HubLockRow lock={event.lock} />;
  else if (seg === 'crew') {
    const labQrUrl = 'https://www.setnayan.com/join/crew/0123456789abcdef0123456789abcdef';
    const labQrSvg = await QRCode.toString(labQrUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 240 });
    body = event.booked ? (
      <div>
        <CrewPanel
          shopId="lab-shop"
          eventId={event.eventId}
          eventName={event.name}
          qr={{ url: labQrUrl, svg: labQrSvg, endsWords: 'ends Dec 19, 12:00 AM' }}
          passes={[
            { passId: 'p-joy', name: 'Ate Joy Mendoza', role: 'member', status: 'allowed' },
            { passId: 'p-ben', name: 'Kuya Ben', role: 'helper', status: 'waiting' },
          ]}
        />
      <AccessGrants
        eventId={event.eventId}
        members={[
          { userId: 'u-tess', name: 'Tess Villanueva', roleLabel: 'Owner', isOwnerAdmin: true, granted: true },
          { userId: 'u-joy', name: 'Ate Joy Mendoza', roleLabel: 'Agent', isOwnerAdmin: false, granted: true },
          { userId: 'u-ben', name: 'Kuya Ben', roleLabel: 'Viewer', isOwnerAdmin: false, granted: false },
        ]}
      />
      </div>
    ) : (
      <p className="py-3 text-[14px] text-ink/65">No day of yours on this event — there is no Event Hub for a crew to join.</p>
    );
  } else if (seg === 'pages') {
    // The page's own rule: Guests counts only where the brief is read (booked + unlocked); Schedule from the run of show.
    const guests = event.booked ? '180 invited · 162 coming' : 'Their guest list';
    const sched = hubScheduleLine(BLOCKS);
    const help = 'You can help here — as much as the hosts allowed you.';
    const ICON: Record<string, typeof Users> = { mood: Palette, seats: Armchair, run: CalendarDays, sheet: ClipboardList, card: FileText };
    body = event.runHref ? (
      <div data-hub-pages="run">
        <HubEyebrow about="The same screens the hosts use, opened inside your app.">The event’s pages</HubEyebrow>
        <p className="pb-1 text-[13.5px] text-ink/65">You run it — as much as the hosts allowed you.</p>
        <HubPageRows>
          <HubPageRow pageKey="guests" icon={Users} label="Guests" line={guests} href={`${event.runHref}/guests`} access={help} />
          <HubPageRow pageKey="seats" icon={Armchair} label="Seats" line="Tables and who sits where" href={`${event.runHref}/seating`} access={help} />
          <HubPageRow pageKey="schedule" icon={CalendarDays} label="Schedule" line={sched ?? 'The run of show, hour by hour'} href={`${event.runHref}/schedule`} access={help} />
          <HubPageRow pageKey="maker" icon={PanelsTopLeft} label="Event Hub (the Maker)" line="The guests’ page for the event" href={`${event.runHref}/launch`} access={help} />
        </HubPageRows>
      </div>
    ) : (
      <div data-hub-pages="booked">
        <HubEyebrow about="The same screens the hosts use, opened inside your app.">The event’s pages</HubEyebrow>
        <p className="pb-1 text-[13.5px] text-ink/65">View only — ask the hosts for more.</p>
        <HubPageRows>
          {forYourServicePages({ eventId: event.eventId, stage: 'booked', shopServices: ['stylist_decorator'], eventTiles: ['stylist_decorator'] }).map((d) => (
            <HubPageRow
              key={d.key}
              pageKey={d.key}
              icon={ICON[d.key] ?? FileText}
              label={d.label}
              line={d.key === 'run' && sched ? sched : d.line}
              href={d.href}
              access="View only — ask the hosts for more."
            />
          ))}
        </HubPageRows>
      </div>
    );
  } else if (!event.booked) {
    body = (
      <div>
        <HubEyebrow about="You run this event as the hosts' coordinator. Your shop is not booked for a day on it.">Events you run</HubEyebrow>
        {event.runHref ? <HubDoorRow href={event.runHref} label="Open their event" line="The hosts' event dashboard, as their coordinator" data="run" /> : null}
        {run ? <CheckinDeskRows events={[run]} /> : null}
        {run ? <MessageEveryoneRows events={[run]} enabled /> : null}
      </div>
    );
  } else {
    body = (
      <div>
        <div id="hub-tools" className="scroll-mt-28">
          <ModuleConfigurator eventId={event.eventId} modules={modules} />
        </div>
        <HubRunOfShow blocks={BLOCKS} moreHref={`/vendor-dashboard/clients/${event.eventId}?tab=schedule`} />
        {run ? <CheckinDeskRows events={[run]} /> : null}
        {run ? <MessageEveryoneRows events={[run]} enabled /> : null}
        {event.when === 'today' ? (
          <div className="space-y-3" data-hub-day="">
            <HubEyebrow about="Today's tools. The Event Hub has the run of the day itself.">The Day</HubEyebrow>
            <SeatFinderRow eventId={event.eventId} name={event.name} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper" data-supplier-lab="hub">
      <HubScreen
        menu={
          <HubEventMenu
            events={list}
            selectedId={event.eventId}
            seg={seg}
            today={HUB_LAB_TODAY}
            info={
              <HubEventInfo
                event={event}
                title={`${event.name} · Wedding`}
                place={PLACE[event.eventId] ?? null}
              />
            }
          />
        }
        event={event}
        seg={seg}
        pane={<HubEventCard event={event} title={`${event.name} · Wedding`} place={PLACE[event.eventId] ?? null} />}
        thumb={<HubThumbRow seg={seg} add={hubAddChoices(event)} />}
      >
        {body}
      </HubScreen>
    </div>
  );
}

/**
 * /dev/supplier-lab?s=crew-phone&state=name|waiting|member|helper|ended — 📱 the CREW PHONE's screens (owner 2026-10-29),
 * drawn with the REAL `crew-screens.tsx` over the prototype's people. The scanner is the shipped `SeatScanner` look,
 * stood in by its Scan button (the real one carries a server action this lab does not mount).
 */
export const CREW_PHONE_STATES = ['name', 'waiting', 'member', 'helper', 'ended'] as const;
export function CrewPhoneLab({ state }: { state?: string }) {
  if (state === 'name') return <CrewNameForm token={'0'.repeat(32)} shopWords="The Wedding Project" anonymous={false} />;
  if (state === 'waiting') return <CrewStatus {...CREW_STATUS_WORDS.waiting} waiting />;
  if (state === 'ended') return <CrewStatus {...CREW_STATUS_WORDS.ended} />;
  const role = state === 'member' ? 'member' : 'helper';
  return (
    <CrewEventHub
      scanner={
        <div className="rounded-2xl bg-ink/[0.04] p-4 text-center text-[14px] text-ink/65" data-lab-scanner="">
          Scan a guest’s pass — their table shows here.
        </div>
      }
      eventName="Indalecio & Claire"
      shopName="The Wedding Project"
      dayWords="Fri, Dec 18, 2026"
      place="Seda Vertis North, Quezon City"
      name={role === 'member' ? 'Ate Joy Mendoza' : 'Kuya Ben'}
      role={role}
      blocks={BLOCKS}
      endsWords="ends Dec 19, 12:00 AM"
    />
  );
}
