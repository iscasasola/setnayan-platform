import { SeatingLabLoader } from '@/app/dashboard/[eventId]/seating/lab/_components/seating-lab-loader';
import { defaultPriorityOrder } from '@/lib/seating';
import type { Lab3DGuest, Lab3DTable } from '@/lib/seating-3d';

/**
 * 🧊 THE LAB'S 3D ROOM — the SHIPPED room (`SeatingLabLoader` → `seating-lab-3d.tsx`), drawn where Guests › Seats › 3D
 * draws it, on SYNTHETIC data with no database. `&big=1` is the 25-table / 230-guest plan the phone budget is measured
 * on (the size of the event that crashed the iPhone app, 2026-10-29) — never a real event's names or plan. Without it,
 * the four lab tables.
 *
 * Saves go nowhere real: the room's lock and writes are server actions, and the fixture event id fails their host fence.
 */

const FIRST = ['Ana', 'Ben', 'Carla', 'Dino', 'Ela', 'Fe', 'Gino', 'Hana', 'Ivo', 'Jo', 'Kat', 'Lito', 'Mia', 'Nico', 'Ona'];
const LAST = ['Reyes', 'Santos', 'Cruz', 'Bautista', 'Garcia', 'Lim', 'Tan', 'Ramos', 'Dizon', 'Flores', 'Aquino'];

function labRoom(big: boolean): { tables: Lab3DTable[]; guests: Lab3DGuest[] } {
  const cols = big ? 5 : 2;
  const rows = big ? 5 : 2;
  const tables: Lab3DTable[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      tables.push({
        id: `lab-3d-t${i}`,
        label: `Table ${i + 1}`,
        type: 'round_10',
        shape: 'round',
        capacity: 10,
        removedSeats: [],
        xPct: 14 + (72 * c) / Math.max(1, cols - 1),
        yPct: 24 + (60 * r) / Math.max(1, rows - 1),
        rotationDeg: 0,
        linkGroupId: null,
      });
    }
  }
  const count = big ? 230 : 30;
  const guests: Lab3DGuest[] = Array.from({ length: count }, (_, i) => {
    const t = tables[i % tables.length]!;
    const seatNumber = Math.floor(i / tables.length) + 1;
    const seated = seatNumber <= t.capacity;
    const side = (['bride', 'groom', 'both'] as const)[i % 3]!;
    return {
      id: `lab-3d-g${i}`,
      name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
      seatedTableId: seated ? t.id : null,
      seatNumber: seated ? seatNumber : null,
      tier: (((i % 4) + 1) as 1 | 2 | 3 | 4),
      seatingPriority: null,
      groupId: null,
      rsvp: i % 7 === 0 ? 'pending' : 'attending',
      side,
      plusOneAllowed: false,
      plusOneOfGuestId: null,
      photoUrl: null,
      attire: i % 2 ? 'suit' : 'gown',
      outfit: null,
      attireColor: null,
      mealChosen: i % 2 === 0,
    };
  });
  return { tables, guests };
}

export function LabRoom3D({ big }: { big: boolean }) {
  const { tables, guests } = labRoom(big);
  return (
    <section className="relative h-full">
      <SeatingLabLoader
        eventId="S89E-LABGUESTS1"
        inMaker
        ghostBooths={[]}
        ghostBoothsEnabled={false}
        tables={tables}
        floor={{
          venueWidthM: big ? 30 : 24,
          venueLengthM: big ? 26 : 18,
          stage: { xPct: 50, yPct: 6, wPct: 24, hPct: 7 },
          entrance: { enabled: true, xPct: 50, yPct: 96, kind: 'door', depthM: 3 },
          dance: { enabled: false, xPct: 50, yPct: 55, wPct: 22, hPct: 18 },
          published: false,
        }}
        guests={guests}
        rolePalette={{}}
        receptionDesign={{}}
        styleFamily={null}
        venueSetting="banquet_hall"
        monogram={null}
        animatedMonogram={false}
        me={{ id: 'lab-user', name: 'Maria' }}
        keepApart={[]}
        priorityOrder={defaultPriorityOrder()}
        roleSetKey="wedding"
        groups={[]}
        floorExtras={{
          serviceEntranceEnabled: false,
          serviceEntranceX: 97,
          serviceEntranceY: 50,
          cocktailEnabled: false,
          cocktailX: 50,
          cocktailY: 40,
          cocktailW: 30,
          cocktailH: 22,
          cocktailLabel: null,
          cocktailVendorEdit: true,
          cocktailLinked: true,
        }}
        sceneObjects={[]}
        booths={[]}
        signs={[]}
      />
    </section>
  );
}
