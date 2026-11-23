'use client';

/**
 * 🏛 A HALL'S FLOOR PLAN IS THE ONE SEAT-PLAN EDITOR (DECISION_LOG d1fafcd5, option B). The couple's editor
 * (`SeatingEditor`) opens full screen in its venue mode: the hall's own tables (round · long · long with ends ·
 * half-moon, one chair count each), its room size and its doors — no guests, no lock, no publish, no print, no 3D.
 *
 * Every write goes through the Spaces dispatcher the sheet already uses (`run` → `spacesWrite`): no new server action.
 * The editor calls the store by the names it already has; the event-only calls are never reached in venue mode and say
 * so if they ever are. The fresh read `run` brings back re-renders this hall, and the editor takes its rows from it.
 */
import { useMemo, useRef, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { SeatingEditor } from '@/app/dashboard/[eventId]/seating/_components/seating-lazy';
import { SeatingStoreContext, type SeatingStore } from '@/app/dashboard/[eventId]/seating/_components/seating-store';
import { PlanPoster } from '@/app/_components/plan-poster';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { ActionButton } from '@/components/action-button';
import {
  isPlanTableShape,
  planFromShopPlan,
  venueDoorChange,
  venueEditorRows,
  type ShopAreaPlan,
} from '@/lib/seat-plan-engine';
import { LOCKS } from '@/lib/locks';
import { shopPlanOf, type SpaceTables } from '@/lib/space-tables';
import type { Run } from './base-layout';

/** An event-only call reached from a venue's hall — refused, never sent to an event's server action. */
const NOT_IN_A_HALL = (async () => {
  throw new Error('That is for an event’s seat plan, not a hall.');
}) as never;

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
const num = (fd: FormData, k: string): number | null => {
  const v = fd.get(k);
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The hall's store: the editor's calls, said in the Spaces dispatcher's ops. `latest` is the hall as last read. */
export function venueSeatingStore(spaceId: string, run: Run, latest: () => ShopAreaPlan | null): SeatingStore {
  const ok = async (p: Promise<boolean>) => {
    if (!(await p)) throw new Error('Not saved');
  };
  const table = (id: string) => latest()?.tables.find((t) => t.id === id) ?? null;
  const moveDoor = async (kind: 'main' | 'service', now: { enabled: boolean; x: number; y: number }) => {
    const was = latest()?.doors.find((d) => d.kind === kind) ?? null;
    const change = venueDoorChange(was, now);
    if (change.remove) await ok(run({ op: 'deleteDoor', id: change.remove }));
    if (change.add) await ok(run({ op: 'addDoor', input: { spaceId, kind, wall: change.add.wall, along: change.add.along } }));
  };
  return {
    createTable: async (fd: FormData) => {
      const shape = str(fd, 'plan_shape');
      await ok(
        run(
          {
            op: 'addTables',
            input: {
              spaceId,
              names: str(fd, 'table_label').trim(),
              shape: isPlanTableShape(shape) ? shape : 'round',
              chairs: num(fd, 'capacity') ?? 8,
              ends: str(fd, 'chairs_at_ends') === 'true',
            },
          },
          'Table added',
        ),
      );
      return { tableId: null };
    },
    deleteTable: async (fd: FormData) => {
      await ok(run({ op: 'deleteTable', id: str(fd, 'table_id') }, 'Table deleted'));
    },
    updateTablePosition: async (fd: FormData) => {
      const id = str(fd, 'table_id');
      const x = num(fd, 'x_pos');
      const y = num(fd, 'y_pos');
      if (x === null || y === null) return;
      await ok(run({ op: 'placeTable', id, x, y, rotationDeg: table(id)?.rotationDeg ?? 0 }));
    },
    updateTableRotation: async (fd: FormData) => {
      const id = str(fd, 'table_id');
      const t = table(id);
      await ok(run({ op: 'placeTable', id, x: t?.x ?? 50, y: t?.y ?? 50, rotationDeg: num(fd, 'rotation_deg') ?? 0 }));
    },
    updateTableLabel: async (fd: FormData) => {
      const id = str(fd, 'table_id');
      const t = table(id);
      if (!t || !fd.has('table_label')) return;
      await ok(run({ op: 'updateTable', input: { id, name: str(fd, 'table_label').trim(), shape: t.shape, chairs: t.chairs, ends: t.chairsAtEnds } }, 'Saved'));
    },
    saveFloorPlan: async (fd: FormData) => {
      const door = (on: string, x: string, y: string) => ({ enabled: str(fd, on) === 'true', x: num(fd, x) ?? 50, y: num(fd, y) ?? 100 });
      await moveDoor('main', door('entrance_enabled', 'entrance_x', 'entrance_y'));
      await moveDoor('service', door('service_entrance_enabled', 'service_entrance_x', 'service_entrance_y'));
    },
    venueTable: async (row) => {
      const done = await run({ op: 'updateTable', input: row }, 'Saved');
      return done ? { ok: true } : { ok: false, error: 'Couldn’t save that table. Try again.' };
    },
    addSeatingConstraint: NOT_IN_A_HALL,
    assignGroup: NOT_IN_A_HALL,
    assignGuest: NOT_IN_A_HALL,
    swapSeats: NOT_IN_A_HALL,
    autoArrange: NOT_IN_A_HALL,
    buildSeatingDraft: NOT_IN_A_HALL,
    lockAndFill: NOT_IN_A_HALL,
    removeSeatingConstraint: NOT_IN_A_HALL,
    toggleSeatLock: NOT_IN_A_HALL,
    publishSeating: NOT_IN_A_HALL,
    unpublishSeating: NOT_IN_A_HALL,
    stampTableSigns: NOT_IN_A_HALL,
    saveBooths: NOT_IN_A_HALL,
    savePriorityOrder: NOT_IN_A_HALL,
    commitWeld: NOT_IN_A_HALL,
    saveSigns: NOT_IN_A_HALL,
    saveVenuePhotoVisibility: NOT_IN_A_HALL,
    seatRoleAtTable: NOT_IN_A_HALL,
    setGuestSeatingPriority: NOT_IN_A_HALL,
    setTableSeat: NOT_IN_A_HALL,
    unassignGuest: NOT_IN_A_HALL,
    linkTables: NOT_IN_A_HALL,
    unlinkTable: NOT_IN_A_HALL,
    updateTableType: NOT_IN_A_HALL,
    swapTableOccupants: NOT_IN_A_HALL,
    setGhostBoothsEnabled: NOT_IN_A_HALL,
    guestSeatView: NOT_IN_A_HALL,
    saveEntrance: NOT_IN_A_HALL,
  };
}

/**
 * The hall's floor plan in its Spaces sheet: its picture, and one button that opens the editor full screen. On the
 * free plan the picture stays and the editor does not open (the floor plan comes with every paid plan).
 */
export function VenueSeatPlan({ tables, spaceId, run, floorPlanOpen }: { tables: SpaceTables; spaceId: string; run: Run; floorPlanOpen: boolean }) {
  const sp = useMemo(() => shopPlanOf(tables, spaceId), [tables, spaceId]);
  const latest = useRef<ShopAreaPlan | null>(sp);
  latest.current = sp;
  const store = useMemo(() => venueSeatingStore(spaceId, run, () => latest.current), [spaceId, run]);
  const [open, setOpen] = useState(false);
  if (!sp) return null;
  const rows = venueEditorRows(sp);
  const seats = rows.tables.reduce((s, t) => s + t.capacity, 0);
  return (
    <div className="space-y-2" data-space-plan={spaceId}>
      {sp.tables.length > 0 ? <PlanPoster plan={planFromShopPlan(sp)} roomName={sp.name} className="w-full text-ink/70" /> : null}
      {floorPlanOpen ? (
        <ActionButton tone="neutral" icon={MapIcon} label="Open the floor plan" className="!h-11" onClick={() => setOpen(true)} />
      ) : (
        <p className="text-sn-13 text-ink/70" data-space-plan-locked="">
          {LOCKS.space_floor_plan.solution}
        </p>
      )}
      {open ? (
        <RiseScreen
          title={sp.name}
          line={`${rows.tables.length} ${rows.tables.length === 1 ? 'table' : 'tables'} · ${seats} ${seats === 1 ? 'seat' : 'seats'}`}
          kind="zoom"
          fill
          data="venue-seat-plan"
          onClose={() => setOpen(false)}
        >
          <SeatingStoreContext.Provider value={store}>
            <SeatingEditor
              eventId={spaceId}
              roleSetKey="wedding"
              tables={rows.tables}
              guests={[]}
              groups={[]}
              floorPlan={rows.floorPlan}
              booths={[]}
              signs={[]}
              bookedVendors={[]}
              constraints={[]}
              me={{ id: '', name: '' }}
              eventDate={null}
              genderSeparationNote={null}
              seatShortfall={0}
              nonDeclinedCount={0}
              totalSeats={seats}
              autoplaceEnabled={false}
              adjacencyEnabled={false}
              reservedCount={0}
              toSeatReserved={0}
              setSeatingAutoplace={NOT_IN_A_HALL}
              setSeatingGroupAdjacency={NOT_IN_A_HALL}
              source={{ kind: 'venue', spaceId, floorPlanOpen }}
            />
          </SeatingStoreContext.Provider>
        </RiseScreen>
      ) : null}
    </div>
  );
}
