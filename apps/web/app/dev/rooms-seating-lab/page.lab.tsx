/**
 * /dev/rooms-seating-lab — 🛏 ROOMS & SEATING (piece A, owner 2026-11-18) on fixture rows: no sign-in, no database.
 * DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * Draws the REAL screen the page mounts (`RoomsSeatingScreen`), fed fixtures instead of the shop's read — the 390 px proof:
 *   ?show=rooms · halls · tables   each section with sample rows
 *   ?state=empty                   a new shop with nothing yet
 *   ?state=refused                 a refused read (says so, with Try again — never "no rooms yet")
 * Buttons post the REAL action; pressing them here needs a session (the lab draws, it does not save). Names are samples.
 */
import { notFound } from 'next/navigation';
import { isSection, type RoomsSeating, type Unit } from '@/lib/rooms-seating';
import { RoomsSeatingScreen } from '@/app/vendor-dashboard/rooms-seating/_components/rooms-seating-screen';

const room = (id: string, groupId: string, name: string, i: number): Unit => ({ id, groupId, kind: 'room', name, shape: null, chairs: null, chairsAtEnds: false, sortOrder: i });
const table = (id: string, groupId: string, name: string, shape: Unit['shape'], chairs: number, ends: boolean, i: number): Unit => ({ id, groupId, kind: 'table', name, shape, chairs, chairsAtEnds: ends, sortOrder: i });

const SAMPLE: RoomsSeating = {
  groups: [
    { id: 'f2', kind: 'floor', name: '2nd floor', widthM: null, lengthM: null, sortOrder: 0 },
    { id: 'f3', kind: 'floor', name: '3rd floor', widthM: null, lengthM: null, sortOrder: 1 },
    { id: 'a1', kind: 'dining_area', name: 'Garden terrace', widthM: 20, lengthM: 14, sortOrder: 0 },
  ],
  units: [
    room('r201', 'f2', '201', 0), room('r202', 'f2', '202', 1), room('r203', 'f2', '203', 2),
    room('r301', 'f3', '301', 0), room('r302', 'f3', '302', 1), room('rph', 'f3', 'Penthouse', 2),
    table('t9', 'a1', 'T9', 'round', 8, false, 0),
    table('t10', 'a1', 'T10', 'long', 10, true, 1),
    table('b1', 'a1', 'B1', 'half_moon', 4, false, 2),
    table('t11', 'a1', 'T11', 'long', 4, false, 3),
  ],
  doors: [
    { id: 'd1', groupId: null, kind: 'main', wall: 'front', along: 'middle' },
    { id: 'd2', groupId: null, kind: 'service', wall: 'back', along: 'right' },
    { id: 'd3', groupId: 'a1', kind: 'main', wall: 'left', along: 'middle' },
  ],
};

export default async function RoomsSeatingLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const show = isSection(sp.show) ? sp.show : 'rooms';
  const state = typeof sp.state === 'string' ? sp.state : 'sample';
  const data = state === 'refused' ? null : state === 'empty' ? { groups: [], units: [], doors: [] } : SAMPLE;
  return (
    <main className="mx-auto w-full max-w-2xl bg-cream px-4 pb-40 pt-4" data-rooms-seating-lab="">
      <h1 className="text-[22px] font-semibold text-ink">Rooms &amp; seating</h1>
      <p className="mt-1 text-[14px] text-ink/70">Make your rooms, halls and tables once. Each service card then picks the ones it sells.</p>
      <RoomsSeatingScreen key={`${show}-${state}`} initial={data} hallSize={state === 'empty' ? null : { widthM: 24, lengthM: 18 }} show={show} />
    </main>
  );
}
