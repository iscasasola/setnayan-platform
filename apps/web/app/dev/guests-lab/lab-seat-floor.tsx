'use client';

import { useMemo, useState, type ComponentProps } from 'react';
import { SeatingEditor } from '@/app/dashboard/[eventId]/seating/_components/seating-lazy';
import { SeatFloorWritesContext, type SeatFloorWrites } from '@/app/dashboard/[eventId]/seating/_components/seat-floor-writes';
import type { SeatingGuest } from '@/app/dashboard/[eventId]/seating/_components/seating-editor';
import { recommendTableSet, shapeHintFor, type EventTableRow, type TableType } from '@/lib/seating';
import { seatingFloorOf, seatingGridLayout } from '@/lib/plan-maker';

/**
 * 🧪 `&floor=empty` — THE SEAT PLAN'S FLOOR, STARTED FROM NOTHING, ON FIXTURE DATA (owner 2026-11-20 build, "the
 * simplest way to add a table and seat someone"). The shipped editor, with the floor's four writes stood in locally
 * (`SeatFloorWritesContext` — the app never provides it): a table made here lives in this component's state, "Seat
 * everyone for me" lays the room out through the SAME shared core the server action calls (`seatingGridLayout`), and
 * both can be undone. No sign-in, no database.
 */
type EditorProps = ComponentProps<typeof SeatingEditor>;

export function LabSeatFloor({ editorProps }: { editorProps: EditorProps }) {
  const [tables, setTables] = useState<EventTableRow[]>(editorProps.tables);
  const [guests, setGuests] = useState<SeatingGuest[]>(editorProps.guests);
  const writes = useMemo<SeatFloorWrites>(() => {
    let n = 0;
    const num = (fd: FormData, k: string) => {
      const v = fd.get(k);
      return typeof v === 'string' && v.length > 0 && Number.isFinite(Number(v)) ? Number(v) : null;
    };
    return {
      createTable: async (fd) => {
        const id = `lab-new-${Date.now()}-${n++}`;
        setTables((ts) => [
          ...ts,
          {
            table_id: id,
            public_id: `S89T-LABNEW${ts.length}`,
            event_id: 'lab',
            table_label: String(fd.get('table_label') ?? 'Table'),
            table_type: String(fd.get('table_type')) as TableType,
            capacity: num(fd, 'capacity') ?? 10,
            sort_order: ts.length,
            x_pos: num(fd, 'x_pos'),
            y_pos: num(fd, 'y_pos'),
            rotation_deg: 0,
            removed_seats: [],
          },
        ]);
        return { tableId: id };
      },
      updateTablePosition: async (fd) => {
        const id = fd.get('table_id');
        setTables((ts) => ts.map((t) => (t.table_id === id ? { ...t, x_pos: num(fd, 'x_pos'), y_pos: num(fd, 'y_pos') } : t)));
      },
      deleteTable: async (fd) => {
        const id = fd.get('table_id');
        setTables((ts) => ts.filter((t) => t.table_id !== id));
        setGuests((gs) => gs.map((g) => (g.seated_table_id === id ? { ...g, seated_table_id: null, seat_number: null } : g)));
      },
      buildSeatingDraft: async (fd) => {
        const undo = fd.get('undo_table_ids');
        if (typeof undo === 'string' && undo.length > 0) {
          const ids = new Set<string>(JSON.parse(undo) as string[]);
          setTables((ts) => ts.filter((t) => !ids.has(t.table_id)));
          setGuests((gs) => gs.map((g) => (g.seated_table_id && ids.has(g.seated_table_id) ? { ...g, seated_table_id: null, seat_number: null } : g)));
          return { tables: 0, seated: 0 };
        }
        const made: EventTableRow[] = recommendTableSet(guests.map((g) => ({ role: g.role, rsvp_status: g.rsvp_status }))).map((t, i) => ({
          table_id: `lab-draft-${i}`,
          public_id: `S89T-LABDRAFT${i}`,
          event_id: 'lab',
          table_label: t.label,
          table_type: t.type,
          capacity: t.capacity,
          sort_order: i,
          x_pos: null,
          y_pos: null,
          rotation_deg: 0,
          removed_seats: [],
        }));
        const at = seatingGridLayout(
          seatingFloorOf(editorProps.floorPlan),
          made.map((t) => ({ id: t.table_id, table_type: t.table_type, capacity: t.capacity })),
        );
        const placed = made.map((t) => ({ ...t, x_pos: at[t.table_id]?.x ?? null, y_pos: at[t.table_id]?.y ?? null }));
        // The lab's stand-in seating: everyone coming, in order, at the guest tables (the server runs `computeAutoSeat`).
        const rounds = placed.filter((t) => shapeHintFor(t.table_type) !== 'sweetheart');
        let k = 0;
        const seatedGuests = guests.map((g) => {
          if (g.rsvp_status === 'declined' || rounds.length === 0) return g;
          const t = rounds[Math.floor(k / 10) % rounds.length]!;
          const seat = k % 10;
          k += 1;
          return { ...g, seated_table_id: t.table_id, seat_number: seat };
        });
        setTables(placed);
        setGuests(seatedGuests);
        return { tables: placed.length, seated: k };
      },
    };
  }, [guests, editorProps.floorPlan]);
  return (
    <SeatFloorWritesContext.Provider value={writes}>
      <SeatingEditor {...editorProps} tables={tables} guests={guests} />
    </SeatFloorWritesContext.Provider>
  );
}
