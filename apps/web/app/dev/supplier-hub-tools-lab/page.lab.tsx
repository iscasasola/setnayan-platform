/**
 * /dev/supplier-hub-tools-lab — the second five hub tools (DECISION_LOG 2026-11-23 "THE TEN MOST-SHARED UNBUILT HUB
 * TOOLS"; drawing `prototypes/hub_tools_working_2026-10-28/`) on the SHIPPED event-day body, inside the real supplier
 * shell. No sign-in, no database: the tools are the shipped components, handed sample rows and an in-memory saver
 * (`lab-hub-tools.tsx`), so every press works. DEV-ONLY: production builds 404 this route first thing.
 *
 *   ?s=band        Tech rider (checklist) + Set list (ordered list, ▲ ▼)
 *   ?s=caterer     Dietary & allergies (from the RSVPs) + Quantity vs guests (counter)
 *   ?s=souvenirs   Personalisation list (per-person) + Quantity vs guests
 *   ?s=empty       the three row tools with nothing in them yet
 *   ?s=unread      every tool's read failed — each says so in its place
 *   ?s=not-food    Dietary & allergies for a supplier not booked for food
 *   ?s=no-headcount  Quantity vs guests when the guest count could not be read
 *   ?s=rest        the free rest · part 1 (24 Nov): Ceremony details · Proofs & approval · Safety permit & cue
 *                  (checklists) · Fittings · Looks · Crew roster · Room list (per-person) · Chair schedule ·
 *                  Reservation slots · Brackets & scoring (ordered lists, ▲ ▼; Brackets keeps a score)
 *   ?s=rest-empty  the same ten, nothing added yet · ?s=rest-unread  the same ten, every read failed
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '@/app/vendor-dashboard/_components/supplier-look.css';
import { SupplierLabShell } from '../_components/supplier-lab-shell';
import { EventDayBody } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/event-day-body';
import { buildDayOfFrame } from '@/lib/vendor-dayof-frame';
import { formatCount } from '@/lib/format-number';
import { LabHubTools, type LabState } from './lab-hub-tools';

const EVENT_ID = '00000000-0000-4000-8000-00000000e001';
const COUPLE = 'Claire & Indalecio';
const PLACE = 'Seda Vertis North';
const ATTENDING = 131;
const INVITED = 160;

const STATES: Record<string, { label: string; tools: LabState; attending: number | null }> = {
  band: { label: 'Band · Tech rider + Set list', tools: 'band', attending: ATTENDING },
  caterer: { label: 'Caterer · Dietary & allergies + Quantity vs guests', tools: 'caterer', attending: ATTENDING },
  souvenirs: { label: 'Souvenirs · Personalisation list + Quantity vs guests', tools: 'souvenirs', attending: ATTENDING },
  empty: { label: 'Nothing added yet (empty states)', tools: 'empty', attending: ATTENDING },
  unread: { label: 'Every read failed (honest states)', tools: 'unread', attending: ATTENDING },
  'not-food': { label: 'Dietary & allergies · not booked for food', tools: 'not-food', attending: ATTENDING },
  'no-headcount': { label: 'Quantity vs guests · the guest count could not be read', tools: 'souvenirs', attending: null },
  rest: { label: 'The free rest · part 1 — ten more tools (checklists, per-person, ordered lists)', tools: 'rest', attending: ATTENDING },
  'rest-empty': { label: 'The ten more tools · nothing added yet', tools: 'rest-empty', attending: ATTENDING },
  'rest-unread': { label: 'The ten more tools · every read failed', tools: 'rest-unread', attending: ATTENDING },
};

const FRAME = buildDayOfFrame({
  access: { genericKit: true, unlockedSet: null, eligibleSet: null, unlockedSets: [], eligibleSets: [], reason: 'no_specialization_for_category' },
  genericModuleIds: ['run_of_show', 'pax_headcount'],
});

export default async function SupplierHubToolsLabPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { s } = await searchParams;
  const state = s ? STATES[s] : undefined;
  if (!state) {
    return (
      <main className="min-h-dvh px-4 py-8" data-supplier-hub-tools-lab="list">
        <h1 className="text-sn-2xl font-semibold text-ink">Hub tools · the second five</h1>
        <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
          {Object.entries(STATES).map(([key, st]) => (
            <li key={key}>
              <Link href={`/dev/supplier-hub-tools-lab?s=${key}`} className="flex min-h-11 items-center py-3 text-sn-lg text-ink">
                {st.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <div data-supplier-look="" data-supplier-hub-tools-lab={s}>
      <SupplierLabShell measure="own" page="/vendor-dashboard/on-the-day">
        <EventDayBody
          eventId={EVENT_ID}
          view="day"
          bar={{
            eventId: EVENT_ID,
            name: COUPLE,
            dayWords: 'Sat, Dec 12',
            view: 'day',
            exitHref: '/vendor-dashboard/on-the-day',
            chatHref: '#chat',
            about: `${PLACE} · ${formatCount(ATTENDING)} of ${formatCount(INVITED)} guests coming · Your tools for the day — only this event.`,
          }}
          counts={[
            { key: 'now', value: '—', word: 'now' },
            { key: 'next', value: '—', word: 'next' },
            { key: 'coming', value: state.attending == null ? '—' : `${formatCount(ATTENDING)}/${formatCount(INVITED)}`, word: state.attending == null ? 'couldn’t load' : 'coming (RSVP)' },
          ]}
          programUnread={false}
          focal={{ coupleName: COUPLE, place: PLACE, viewer: 'lab-viewer', eventDate: '2026-12-12', checkin: false }}
          blocks={[]}
          nav={FRAME.nav}
          genericDomId={FRAME.genericDomId}
          showRunOfShow={false}
          march={null}
          headcount={state.attending == null ? null : { attending: ATTENDING, invited: INVITED }}
          tools={[]}
          hubTools={<LabHubTools state={state.tools} attending={state.attending} />}
          reviews={null}
          desk={null}
          otherView={null}
        />
      </SupplierLabShell>
    </div>
  );
}
