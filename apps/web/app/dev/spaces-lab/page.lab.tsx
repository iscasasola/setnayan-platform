/**
 * /dev/spaces-lab — 🏛 SHOP › SPACES (owner 19 Nov 2026) on fixture rows: no sign-in, no database.
 * DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * Draws the REAL screen the page mounts (`SpacesScreen`), fed fixtures instead of the shop's read — the 375 px proof:
 *   (default)          a venue-and-rentals shop on Sat 14 Feb: a booked hall, a closed room, counted chairs …
 *   ?plan=plus         below Pro: names given (Hall001 …), the 🔒 floor-plan row and the 🔒 name row
 *   ?state=empty       a shop with no space yet (the tile is hidden on Shop; the page itself says how to add)
 *   ?state=refused     a refused read (says so, with Try again — never "no spaces yet")
 *   ?state=day         the day's holders could not be read (tiles say nothing about the day, never "Free")
 *   ?state=first       a venue CARD with no hall yet: the Uses row's "None yet ▾ · add the first" (drawing screen 8)
 * Buttons post the REAL action; pressing them here needs a session (the lab draws, it does not save). Names are samples.
 */
import { notFound } from 'next/navigation';
import type { SpacesRead } from '@/lib/spaces.server';
import type { Space } from '@/lib/spaces';
import { SpacesScreen } from '@/app/vendor-dashboard/spaces/_components/spaces-screen';
import { AddFirstSpace } from '@/app/vendor-dashboard/spaces/_components/add-first-space';

const sp = (o: Partial<Space> & Pick<Space, 'id' | 'kind' | 'name'>): Space => ({
  seated: null, standing: null, widthM: null, lengthM: null, connectsTo: null, floor: null, count: null, inRepair: 0, details: {}, ...o,
});
const DAY = '2027-02-14';
const SAMPLE: SpacesRead = {
  spaces: [
    sp({ id: 'h1', kind: 'hall', name: 'Hall001', seated: 300, standing: 400, widthM: 20, lengthM: 30, connectsTo: 'h2' }),
    sp({ id: 'h2', kind: 'hall', name: 'Hall002', seated: 150, standing: 200, widthM: 12, lengthM: 20, connectsTo: 'h1' }),
    sp({ id: 'r1', kind: 'room', name: 'Room001', floor: '2F', details: { type: 'Deluxe', beds: 2 } }),
    sp({ id: 'r2', kind: 'room', name: 'Room002', floor: '2F', details: { type: 'Deluxe', beds: 2 } }),
    sp({ id: 'c1', kind: 'cart', name: 'Cart001', details: { type: 'Fries', needsPower: true } }),
    sp({ id: 'o1', kind: 'object', name: 'Object001', count: 200, inRepair: 8, details: { type: 'Chairs' } }),
    sp({ id: 'v1', kind: 'vehicle', name: 'Vehicle001', details: { type: 'Bridal car', seats: 4, driver: true } }),
    sp({ id: 'g1', kind: 'clothing', name: 'Clothing001', count: 4, details: { type: 'Gown', colour: 'Champagne', sizes: { S: 1, M: 2, L: 1 } } }),
    sp({ id: 'i1', kind: 'item', name: 'Item001', details: { type: 'Arch' } }),
  ],
  tables: {
    groups: [
      { id: 'h1', kind: 'hall', name: 'Hall001', widthM: 20, lengthM: 30, sortOrder: 0 },
      { id: 'h2', kind: 'hall', name: 'Hall002', widthM: 12, lengthM: 20, sortOrder: 1 },
      { id: 'r1', kind: 'room', name: 'Room001', widthM: null, lengthM: null, sortOrder: 2 },
      { id: 'r2', kind: 'room', name: 'Room002', widthM: null, lengthM: null, sortOrder: 3 },
    ],
    units: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((name, i) => ({
      id: `t${i + 1}`, groupId: 'h1', kind: 'table' as const, name, shape: i === 5 ? ('long' as const) : ('round' as const), chairs: i === 5 ? 12 : 10, chairsAtEnds: i === 5, sortOrder: i,
    })),
    doors: [{ id: 'd1', groupId: 'h1', kind: 'main', wall: 'front', along: 'middle' }],
  },
  day: {
    date: DAY,
    bookings: [{ poolId: 'h1', eventId: 'e1', title: 'Reyes wedding' }],
    blocks: [{ poolId: 'r2', source: 'manual', startDate: DAY, endDate: DAY, label: 'In repair' }],
  },
};

export default async function SpacesLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const state = typeof sp.state === 'string' ? sp.state : 'sample';
  const pro = sp.plan !== 'plus';
  const data: SpacesRead | null =
    state === 'refused' ? null : state === 'empty' ? { spaces: [], tables: { groups: [], units: [], doors: [] }, day: { date: DAY, bookings: [], blocks: [] } } : state === 'day' ? { ...SAMPLE, day: null } : SAMPLE;
  if (state === 'first') {
    return (
      <main className="mx-auto w-full max-w-2xl bg-cream px-4 pb-40 pt-4 lg:max-w-4xl" data-spaces-lab="">
        <h1 className="text-[22px] font-semibold text-ink">Grand Hall</h1>
        <p className="mt-1 text-[14px] text-ink/70">Service card · More settings</p>
        <AddFirstSpace today={DAY} proOpen={pro} firstHall={{ widthM: 20, lengthM: 30, seated: 300 }} />
      </main>
    );
  }
  const named: SpacesRead | null =
    data && !pro ? data : data && pro ? { ...data, spaces: data.spaces.map((s) => (s.id === 'h1' ? { ...s, name: 'Grand Ballroom' } : s.id === 'h2' ? { ...s, name: 'Garden Hall' } : s)) } : data;
  return (
    <main className="mx-auto w-full max-w-2xl bg-cream px-4 pb-40 pt-4 lg:max-w-4xl" data-spaces-lab="">
      <h1 className="text-[22px] font-semibold text-ink">Spaces</h1>
      <p className="mt-1 text-[14px] text-ink/70">Set once for the shop. Your cards pick from here.</p>
      <SpacesScreen
        key={`${state}-${String(sp.plan)}`}
        initial={named}
        today={DAY}
        proOpen={pro}
        shopKind="hall"
        firstHall={{ widthM: 20, lengthM: 30, seated: 300 }}
      />
    </main>
  );
}
