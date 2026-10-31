import { DEFAULT_FLOOR_PLAN, groupColorFor, type EventTableRow } from '@/lib/seating';
import type { SeatingGuest } from '@/app/dashboard/[eventId]/seating/_components/seating-editor';
import { SeatingEditor } from '@/app/dashboard/[eventId]/seating/_components/seating-lazy';
import { SeatPlanInGuests } from '@/app/dashboard/[eventId]/seating/_components/seat-plan-in-guests';
import { MarchMaker } from '@/app/dashboard/[eventId]/launch/_components/details-lazy';
import { labMarchSections } from '@/app/dev/details-lab/march-fixture';
import { parseSeatView } from '@/lib/guests-views';
import { LabRoom3D } from './lab-room-3d';

/**
 * 🗂 R4 · THE LAB'S GUESTS › SEATS AND GUESTS › MARCH — the SHIPPED makers, drawn the way `guests/page.tsx` draws them
 * (the seat plan's Guests shell, `SeatPlanInGuests` + `host: 'guests'`; the march maker over its tray slot), on fixture
 * data with no sign-in and no database. Saves go nowhere real: the seat plan's lock and writes are refused for the
 * fixture event (it says so), and the march is the maker's own `lab` mode (drawn, never sent).
 */

const LAB_TABLES: EventTableRow[] = [
  ['Sponsors', 'round_10', 30, 30],
  ['Family', 'round_10', 70, 30],
  ['Barkada', 'round_8', 30, 62],
  ['Choir', 'round_8', 70, 62],
].map(([label, type, x, y], i) => ({
  table_id: `lab-t-${i}`,
  public_id: `S89T-LAB000000${i}`,
  event_id: 'lab',
  table_label: label as string,
  table_type: type as EventTableRow['table_type'],
  capacity: type === 'round_10' ? 10 : 8,
  sort_order: i,
  x_pos: x as number,
  y_pos: y as number,
  rotation_deg: 0,
  removed_seats: [],
}));

export function LabSeats({ guests, seat, big = false }: { guests: readonly { guest_id: string; first_name: string | null; last_name: string | null; role: string; side: string; rsvp_status: string | null }[]; seat: string | undefined; /** `&big=1` — the 3D room on the 25-table / 230-guest synthetic plan. */ big?: boolean }) {
  async function labPolicy(formData: FormData) {
    'use server';
    void formData;
  }
  const seatingGuests: SeatingGuest[] = guests.map((g, i) => {
    const name = [g.first_name, g.last_name].filter(Boolean).join(' ') || 'Guest';
    const seated = i % 3 !== 2 ? LAB_TABLES[i % LAB_TABLES.length]! : null;
    return {
      guest_id: g.guest_id,
      name,
      initials: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      photo_url: null,
      side: (g.side === 'bride' || g.side === 'groom' ? g.side : 'both') as SeatingGuest['side'],
      group_id: null,
      rsvp_status: g.rsvp_status ?? 'pending',
      seated_table_id: seated?.table_id ?? null,
      seat_number: null,
      seat_locked: false,
      // 🪑 Who placed each seat (lib/seat-why.ts) — the lab's seats alternate "you" and Auto arrange, a few days apart.
      seat_placed_by: seated ? (i % 2 === 0 ? 'couple' : 'auto') : null,
      seat_placed_at: seated ? new Date(Date.UTC(2026, 9, 29 - (i % 4), 9)).toISOString() : null,
      role: g.role,
      group_category: 'friend',
      meal_preference: null,
      dietary_restrictions: null,
      seating_priority: null,
    };
  });
  const totalSeats = LAB_TABLES.reduce((n, t) => n + t.capacity, 0);
  const nonDeclined = seatingGuests.filter((g) => g.rsvp_status !== 'declined').length;
  const reserved = seatingGuests.filter((g) => g.rsvp_status === 'attending');
  const view = parseSeatView(seat);
  return (
    <SeatPlanInGuests seat={view}>
      <SeatingEditor
        eventId="S89E-LABGUESTS1"
        roleSetKey="wedding"
        tables={LAB_TABLES}
        guests={seatingGuests}
        groups={[{ group_id: 'grp-b', label: 'Barkada', color: groupColorFor(0), member_count: 4 }]}
        floorPlan={{ ...DEFAULT_FLOOR_PLAN, venue_width_m: 24, venue_length_m: 18 }}
        booths={[]}
        signs={[]}
        bookedVendors={[]}
        constraints={[]}
        eventDate="2026-12-12"
        seatDayHasCome={false}
        genderSeparationNote={null}
        seatShortfall={Math.max(0, nonDeclined - totalSeats)}
        nonDeclinedCount={nonDeclined}
        totalSeats={totalSeats}
        autoplaceEnabled
        adjacencyEnabled
        reservedCount={reserved.length}
        toSeatReserved={reserved.filter((g) => !g.seated_table_id).length}
        setSeatingAutoplace={labPolicy}
        setSeatingGroupAdjacency={labPolicy}
        initialView={view === 'list' ? 'list' : 'plan'}
        details={{
          /* 🧊 The SHIPPED 3D room on synthetic data (`lab-room-3d.tsx`), opened in place like Guests › Seats — it replaces
             #7055's stand-in box, so the lab walks Seats › 3D's full screen, the auto-pin and the glide on the real room. */
          lab: <LabRoom3D big={big} />,
          open3d: view === '3d',
          sides: [
            { side: 'groom', label: "Jose's side" },
            { side: 'bride', label: "Maria's side" },
            { side: 'both', label: 'Both sides' },
          ],
          part: view === 'map' ? 'map' : null,
          host: 'guests',
        }}
        me={{ id: 'lab-user', name: 'Maria' }}
      />
    </SeatPlanInGuests>
  );
}

export function LabMarch({ shape, nicks = false }: { shape?: string | null; nicks?: boolean }) {
  const m = labMarchSections(shape, { nicks });
  /* The same frame as `guests/_components/guests-march.tsx` (a server component that reads the event, so the lab
     draws its body here on the fixture): the maker with its summary row, the tray’s slot. */
  return (
    <div data-guests-march="" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <MarchMaker eventId="S89E-LABGUESTS1" sections={m.sections} printed={m.printed} out={m.out} lab guests />
      <div data-march-tray-slot="" className="flex min-h-0 flex-col lg:sticky lg:top-4" />
    </div>
  );
}
