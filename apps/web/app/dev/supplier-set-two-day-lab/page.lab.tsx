/**
 * /dev/supplier-set-two-day-lab — page 8 of "supplier pages, set two" (owner-approved 21 Nov 2026, drawing
 * `prototypes/supplier_pages_set2_2026-11-21/supplier_pages_set2_v2_fable.html` `#p8`): the event day's Hub console and
 * the Papic desk, each state the drawing draws, inside the REAL supplier shell (`SupplierLabShell`) with the blue look
 * on. No sign-in, no database: the page BODIES are the shipped components, handed fixtures in place of the reads.
 * DEV-ONLY: production builds 404 this route first thing.
 *
 *   (no params)   the list of states
 *   ?s=<state>    one state — `day`, `day-program-unread`, `scanner`, `papic-consent`, `papic-camera` (the consent's
 *                 button pressed by the shot; a browser with no camera shows the shipped "Camera unavailable"),
 *                 `papic-not-the-day`, `papic-unread`
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import '@/app/vendor-dashboard/_components/supplier-look.css';
import { SupplierLabShell } from '../_components/supplier-lab-shell';
import { EventDayBody, type DayCount, type DayTool } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/event-day-body';
import { EventHubScanner } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/event-hub-views';
import { SpecializationSlot } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/specialization-slot';
import { LiveReviews } from '@/app/vendor-dashboard/on-the-day/_components/live-reviews';
import { PapicDeskBody, PapicReadFailed } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/papic-desk-body';
import { OwnCapturesView } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/own-captures-strip';
import { PortfolioCreditsCard } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-credits-card';
import { PortfolioAlbumView } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-album-section';
import { buildDayOfFrame } from '@/lib/vendor-dayof-frame';
import { getModule, type DayOfModuleId } from '@/lib/vendor-dayof-modules';
import { dayOfModuleHref } from '@/lib/vendor-dayof-module-href';
import { deriveRunOfShow, type RunOfShowBlock } from '@/lib/run-of-show';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { formatCount } from '@/lib/format-number';
import type { OpenRail } from '@/lib/payment-channels';
import type { ShopPapicPack } from '@/lib/vendor-papic-credits';

const EVENT_ID = '00000000-0000-4000-8000-00000000e001';
const COUPLE = 'Claire & Indalecio';
const PLACE = 'Seda Vertis North';
const ATTENDING = 142;
const INVITED = 186;

/** A wall-clock moment `min` minutes from now in Manila, stored the way `start_at` is (the venue's clock as UTC). */
function wall(min: number): string {
  return new Date(Date.now() + 8 * 60 * 60_000 + min * 60_000).toISOString();
}
function block(id: string, label: string, at: number, state: RunOfShowBlock['run_state']): RunOfShowBlock {
  return { block_id: id, label, start_at: wall(at), end_at: null, location: null, run_state: state, actual_start_at: null, block_type: '', is_public: true };
}
const BLOCKS: RunOfShowBlock[] = [
  block('b1', 'Ceremony', -120, 'done'),
  block('b2', 'Cocktails', -35, 'live'),
  block('b3', 'Dinner service', 25, 'upcoming'),
  block('b4', 'First dance', 110, 'upcoming'),
  block('b5', 'Send-off', 230, 'upcoming'),
];

function countsFor(blocks: RunOfShowBlock[]): DayCount[] {
  const ros = deriveRunOfShow(blocks, new Date(), DEFAULT_EVENT_TZ);
  return [
    { key: 'now', value: ros.current ? formatWallClock(ros.current.start_at) || '—' : '—', word: ros.current ? `now · ${ros.current.label}` : 'now', href: '#schedule', hot: true },
    { key: 'next', value: ros.next ? formatWallClock(ros.next.start_at) || '—' : '—', word: ros.next ? `next · ${ros.next.label}` : 'next', href: '#schedule' },
    { key: 'coming', value: `${formatCount(ATTENDING)}/${formatCount(INVITED)}`, word: 'coming (RSVP)' },
  ];
}

const TOOL_IDS: DayOfModuleId[] = ['production_sheet', 'vendor_papic', 'delivery_handover'];
const TOOLS: DayTool[] = TOOL_IDS.map((id) => {
  const m = getModule(id);
  return { id, label: m.label, blurb: m.blurb, href: dayOfModuleHref(id, EVENT_ID) ?? '#' };
});

/** The band's desk, held but not yet on their plan — the shipped slot's own "locked" words, no desk mounted. */
const FRAME = buildDayOfFrame({
  access: { genericKit: true, unlockedSet: null, eligibleSet: 'song_desk', unlockedSets: [], eligibleSets: ['song_desk'], reason: 'below_tier_floor' },
  genericModuleIds: ['run_of_show', 'pax_headcount', ...TOOL_IDS, 'live_reviews'],
});

function day(view: 'day' | 'scanner', programUnread: boolean, deskDoor = false) {
  const blocks = programUnread ? [] : BLOCKS;
  return (
    <EventDayBody
      eventId={EVENT_ID}
      view={view}
      bar={{
        eventId: EVENT_ID,
        name: COUPLE,
        dayWords: 'Sat, Dec 12',
        view,
        exitHref: '/vendor-dashboard/on-the-day',
        chatHref: '#chat',
        about: `${PLACE} · ${formatCount(ATTENDING)} of ${formatCount(INVITED)} guests coming · Your tools for the day — only this event.`,
      }}
      counts={countsFor(blocks)}
      programUnread={programUnread}
      focal={{ coupleName: COUPLE, place: PLACE, viewer: 'lab-viewer', eventDate: '2026-12-12', checkin: false }}
      blocks={blocks}
      nav={FRAME.nav}
      genericDomId={FRAME.genericDomId}
      showRunOfShow
      march={null}
      headcount={{ attending: ATTENDING, invited: INVITED }}
      tools={TOOLS}
      reviews={<LiveReviews vendorProfileId="lab-shop" initial={[]} />}
      desk={<SpecializationSlot model={FRAME} eventId={EVENT_ID} vendorProfileId="lab-shop" coupleName={COUPLE} blocks={blocks} bookedCategories={['band']} />}
      otherView={view === 'scanner' ? <EventHubScanner eventId={EVENT_ID} run={null} floorIsYours={false} scan={[]} deskDoorParts={deskDoor ? ['guests', 'suppliers'] : []} /> : null}
    />
  );
}

const RAILS: OpenRail[] = [
  { id: 'gcash', label: 'GCash' },
  { id: 'bdo', label: 'BDO' },
];
/** A catalogue row as the reader hands it (the lab's own stand-in — the live page reads the catalogue). */
const PACKS: ShopPapicPack[] = [{ code: 'lab-pack', title: 'Papic Plus', credits: 300, pricePhp: 2999 }];

function papic({ isEventDay, coupleName = COUPLE }: { isEventDay: boolean; coupleName?: string }) {
  const capture = isEventDay ? { uploadOwner: null, plan: 'free', planLabel: 'Free', photosTaken: 7 } : null;
  return (
    <PapicDeskBody
      eventId={EVENT_ID}
      isEventDay={isEventDay}
      backHref={isEventDay ? `/vendor-dashboard/on-the-day/live/${EVENT_ID}` : '/vendor-dashboard/on-the-day'}
      coupleName={coupleName}
      capture={capture}
      shotStrip={<OwnCapturesView tiles={[]} />}
      walletCard={<PortfolioCreditsCard eventId={EVENT_ID} credits={60} left={48} offerPack packs={PACKS} openRails={RAILS} />}
      album={
        <PortfolioAlbumView
          eventId={EVENT_ID}
          summary="No photos yet"
          share={{ ready: false, isUltra: false, shared: false, asked: false }}
          canPutOnPage
          eventEnded={!isEventDay}
          coupleName={coupleName}
          creditsLeft={48}
          vendorProfileId={null}
          tiles={[]}
          noticeByPhoto={new Map()}
        />
      }
      challenge={null}
    />
  );
}

const STATES: Record<string, { label: string; page: string; draw: () => ReactNode }> = {
  day: { label: 'The Day · the Hub console', page: '/vendor-dashboard/on-the-day', draw: () => day('day', false) },
  'day-program-unread': {
    label: 'The Day · the couple’s program could not be read (honest state · new)',
    page: '/vendor-dashboard/on-the-day',
    draw: () => day('day', true),
  },
  scanner: { label: 'Scanner view (PickMenu)', page: '/vendor-dashboard/on-the-day', draw: () => day('scanner', false) },
  'scanner-desk-door': {
    label: 'Scanner view · the hosts picked you for the Check-in desk’s door (new)',
    page: '/vendor-dashboard/on-the-day',
    draw: () => day('scanner', false, true),
  },
  'papic-consent': { label: 'Papic · before you shoot', page: '/vendor-dashboard/on-the-day', draw: () => papic({ isEventDay: true }) },
  'papic-camera': { label: 'Papic · the camera (press Agree)', page: '/vendor-dashboard/on-the-day', draw: () => papic({ isEventDay: true }) },
  'papic-not-the-day': { label: 'Papic · not the event day', page: '/vendor-dashboard/on-the-day', draw: () => papic({ isEventDay: false }) },
  'papic-unread': {
    label: 'Papic · this event could not be read (honest state · new)',
    page: '/vendor-dashboard/on-the-day',
    draw: () => <PapicReadFailed eventId={EVENT_ID} />,
  },
};

export default async function SupplierSetTwoDayLabPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { s } = await searchParams;
  const state = s ? STATES[s] : undefined;
  if (!state) {
    return (
      <main className="min-h-dvh px-4 py-8" data-supplier-set-two-day-lab="list">
        <h1 className="text-xl font-semibold text-ink">Supplier pages, set two · the event day</h1>
        <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
          {Object.entries(STATES).map(([key, st]) => (
            <li key={key}>
              <Link href={`/dev/supplier-set-two-day-lab?s=${key}`} className="flex min-h-11 items-center py-3 text-[15px] text-ink">
                {st.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <div data-supplier-look="" data-supplier-set-two-day-lab={s}>
      <SupplierLabShell measure="own" page={state.page}>
        {state.draw()}
      </SupplierLabShell>
    </div>
  );
}
