/**
 * The static sample room behind the 3D Plan homepage demo (owner spec,
 * DECISION_LOG 2026-07-03): the Maria & Jose sample wedding, as PURE DATA.
 * A homepage visitor is anonymous — nothing here reads the database; every
 * guest is fictional, so the demo has zero privacy surface (no camera, no
 * consent, no purge).
 *
 * The shape is `VenueScene` (guest-venue-3d.tsx) — the exact contract the
 * shipped guest 3D explorer renders, so the demo IS the real product's room.
 */
import type { VenueScene } from '@/app/[slug]/venue/_components/guest-venue-3d';

export type DemoGuest = {
  id: string;
  name: string;
  table: string;
  /** chair index at the table (the seat the avatar walks to) */
  seatNumber: number;
};

/** Fictional guests — every occupied chair in the sample room has a name. */
export const PLAN3D_DEMO_GUESTS: DemoGuest[] = [
  // Head table (long banquet, near the stage)
  { id: 'g-maria', name: 'Maria', table: 'Head Table', seatNumber: 3 },
  { id: 'g-jose', name: 'Jose', table: 'Head Table', seatNumber: 4 },
  { id: 'g-ninang-cora', name: 'Ninang Cora', table: 'Head Table', seatNumber: 2 },
  { id: 'g-ninong-ben', name: 'Ninong Ben', table: 'Head Table', seatNumber: 5 },
  // Table 1 — the Reyes side
  { id: 'g-lola-remedios', name: 'Lola Remedios', table: 'Table 1', seatNumber: 0 },
  { id: 'g-lolo-andres', name: 'Lolo Andres', table: 'Table 1', seatNumber: 1 },
  { id: 'g-tita-baby', name: 'Tita Baby', table: 'Table 1', seatNumber: 2 },
  { id: 'g-tito-jun', name: 'Tito Jun', table: 'Table 1', seatNumber: 3 },
  { id: 'g-ate-grace', name: 'Ate Grace', table: 'Table 1', seatNumber: 5 },
  { id: 'g-kuya-dan', name: 'Kuya Dan', table: 'Table 1', seatNumber: 6 },
  // Table 2 — the Santos side
  { id: 'g-mama-linda', name: 'Mama Linda', table: 'Table 2', seatNumber: 0 },
  { id: 'g-papa-ric', name: 'Papa Ric', table: 'Table 2', seatNumber: 1 },
  { id: 'g-tita-nene', name: 'Tita Nene', table: 'Table 2', seatNumber: 3 },
  { id: 'g-tito-boy', name: 'Tito Boy', table: 'Table 2', seatNumber: 4 },
  { id: 'g-bunso-mika', name: 'Mika', table: 'Table 2', seatNumber: 6 },
  // Table 3 — barkada
  { id: 'g-carlo', name: 'Carlo', table: 'Table 3', seatNumber: 0 },
  { id: 'g-bea', name: 'Bea', table: 'Table 3', seatNumber: 1 },
  { id: 'g-paolo', name: 'Paolo', table: 'Table 3', seatNumber: 2 },
  { id: 'g-issa', name: 'Issa', table: 'Table 3', seatNumber: 4 },
  { id: 'g-miguel', name: 'Miguel', table: 'Table 3', seatNumber: 5 },
  { id: 'g-joy', name: 'Joy', table: 'Table 3', seatNumber: 6 },
  // Table 4 — officemates
  { id: 'g-sir-rey', name: 'Sir Rey', table: 'Table 4', seatNumber: 1 },
  { id: 'g-maam-fe', name: "Ma'am Fe", table: 'Table 4', seatNumber: 2 },
  { id: 'g-hannah', name: 'Hannah', table: 'Table 4', seatNumber: 4 },
  { id: 'g-marco', name: 'Marco', table: 'Table 4', seatNumber: 5 },
  // Table 5 — province cousins
  { id: 'g-pinang', name: 'Pinang', table: 'Table 5', seatNumber: 0 },
  { id: 'g-erning', name: 'Erning', table: 'Table 5', seatNumber: 2 },
  { id: 'g-selya', name: 'Selya', table: 'Table 5', seatNumber: 3 },
  { id: 'g-domeng', name: 'Domeng', table: 'Table 5', seatNumber: 5 },
  { id: 'g-nita', name: 'Nita', table: 'Table 5', seatNumber: 6 },
];

export function plan3dGuestById(id: string | null | undefined): DemoGuest | null {
  if (!id) return null;
  return PLAN3D_DEMO_GUESTS.find((g) => g.id === id) ?? null;
}

/** Occupancy derives from the guest list — one source of truth. */
function occupancy(): VenueScene['occupancy'] {
  const byTable = new Map<string, number[]>();
  for (const g of PLAN3D_DEMO_GUESTS) {
    byTable.set(g.table, [...(byTable.get(g.table) ?? []), g.seatNumber]);
  }
  return [...byTable.entries()].map(([table, seats]) => ({ table, seats }));
}

/** The sample room. `you` starts null (desktop view); the phone sets it. */
export function plan3dDemoScene(you: DemoGuest | null): VenueScene {
  return {
    published: true,
    floor: {
      venueWidthM: 14,
      venueLengthM: 18,
      stage: { xPct: 50, yPct: 8, wPct: 34, hPct: 12 },
      entrance: { enabled: true, xPct: 50, yPct: 96 },
      dance: { enabled: true, xPct: 50, yPct: 34, wPct: 26, hPct: 18 },
    },
    tables: [
      { id: 'Head Table', type: 'long_banquet', capacity: 8, xPct: 50, yPct: 20, rotationDeg: 0, removedSeats: [] },
      { id: 'Table 1', type: 'round_8', capacity: 8, xPct: 22, yPct: 42, rotationDeg: 0, removedSeats: [] },
      { id: 'Table 2', type: 'round_8', capacity: 8, xPct: 78, yPct: 42, rotationDeg: 0, removedSeats: [] },
      { id: 'Table 3', type: 'round_8', capacity: 8, xPct: 20, yPct: 68, rotationDeg: 0, removedSeats: [] },
      { id: 'Table 4', type: 'round_8', capacity: 8, xPct: 50, yPct: 72, rotationDeg: 0, removedSeats: [] },
      { id: 'Table 5', type: 'round_8', capacity: 8, xPct: 80, yPct: 68, rotationDeg: 0, removedSeats: [] },
    ],
    objects: [],
    occupancy: occupancy(),
    you: you
      ? {
          table: you.table,
          seatNumber: you.seatNumber,
          tablemates: PLAN3D_DEMO_GUESTS.filter((g) => g.table === you.table && g.id !== you.id).map((g) => ({
            name: g.name,
            seatNumber: g.seatNumber,
          })),
        }
      : null,
  };
}
