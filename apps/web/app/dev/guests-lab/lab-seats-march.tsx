import { sortTables, spreadForDisplay } from '@/lib/table-order';
import { DEFAULT_FLOOR_PLAN, groupColorFor, type EventTableRow, type FloorBoothRow } from '@/lib/seating';
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

/* 🏪 One booth a (fake) booked supplier runs — a 2D tap on it opens the supplier card (owner 2026-11-01). Lab data only. */
const LAB_BOOTHS: FloorBoothRow[] = [
  {
    booth_id: 'lab-booth-0',
    event_id: 'lab',
    booth_type: 'live_cooking',
    label: 'Lechon station',
    x_pos: 6,
    y_pos: 62,
    sort_order: 0,
    zone: 'reception',
    event_vendor_id: 'lab-vendor-0',
    offerings: 'Lechon de leche, carved at the station',
    vendor: { vendor_name: 'Lab Lechon House', category: 'catering', logo_url: null, tier: 'pro', slug: null, bookable: false, boothAddonActive: false },
  },
];

const LAB_TABLES_SMALL: EventTableRow[] = [
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

/**
 * 🪑 `&cale=before|after` — a room shaped like the owner's own event (measured read-only 2026-11-01): Table 1…25, Tables
 * 1–3 tied at sort_order 0 and the rest out of label order, Tables 17 and 18 stored on one spot (100, 100), 13 and 14 on
 * the bottom edge. `before` = the rows as the database orders them (sort_order, then made); `after` = as the page now
 * hands them to the plan (`sortTables` + `spreadForDisplay`). Lab data only.
 */
function caleShapedTables(after: boolean): EventTableRow[] {
  const order = [0, 0, 0, ...Array.from({ length: 22 }, (_, i) => ((i * 7) % 22) + 1)];
  const rows: EventTableRow[] = Array.from({ length: 25 }, (_, i) => ({
    table_id: `lab-c-${String(i + 1).padStart(2, '0')}`,
    public_id: `S89T-LABC0000${i}`,
    event_id: 'lab',
    table_label: `Table ${i + 1}`,
    table_type: 'round_10' as EventTableRow['table_type'],
    capacity: 10,
    sort_order: order[i]!,
    x_pos: i === 16 || i === 17 ? 100 : i === 12 || i === 13 ? 30 + (i - 12) * 40 : 12 + (i % 5) * 19,
    y_pos: i === 16 || i === 17 ? 100 : i === 12 || i === 13 ? 100 : 18 + Math.floor(i / 5) * 17,
    rotation_deg: 0,
    removed_seats: [],
  }));
  // The database's order: sort_order, then when made (here: Tables 3, 2, 1 were made last-first).
  const db = [...rows].sort((a, b) => a.sort_order - b.sort_order || b.table_label.localeCompare(a.table_label));
  return after ? spreadForDisplay(sortTables(db)) : db;
}

export function LabSeats({ guests, seat, big = false, cale = null }: { guests: readonly { guest_id: string; first_name: string | null; last_name: string | null; role: string; side: string; rsvp_status: string | null }[]; seat: string | undefined; /** `&big=1` — the 3D room on the 25-table / 230-guest synthetic plan. */ big?: boolean; cale?: 'before' | 'after' | null }) {
  const LAB_TABLES = cale ? caleShapedTables(cale === 'after') : LAB_TABLES_SMALL;
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
        booths={LAB_BOOTHS}
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
