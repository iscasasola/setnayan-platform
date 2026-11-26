'use client';

/**
 * 🪑 BASE LAYOUT — one hall's (or room's) tables and doors, inside its Spaces sheet (drawing screen 4, "Base layout:
 * stage, doors, pillars, usual tables"). This is what #7968 (Rooms & seating, 18 Nov) keeps once it is reworked into
 * Spaces (owner 19 Nov: "#7968 keeps only tables, table types, doors and the shared plan core, hung on a space").
 *
 * The rows add, edit and delete; the drawn plan is THE ONE SEAT-PLAN EDITOR, the couple's own, in its venue mode
 * (`venue-seat-plan.tsx`, DECISION_LOG d1fafcd5). Floor plan on every paid plan. Nothing here is
 * a new control: FormRows · TypedRow · ChosenRow · SwitchRow · Counter · Fold · SwipeToDelete · ActionButton.
 *
 * Named `base-layout-fold`, not `base-layout`: a file ending in `layout.tsx` is read as a Next layout (drawn around every
 * page under it) by `lib/a-socket-only-where-something-is-live.test.ts`, and this fold reaches the seat-plan editor.
 */
import { useState } from 'react';
import { Check, DoorOpen, Plus } from 'lucide-react';
import { VenueSeatPlan } from './venue-seat-plan';
import { ActionButton } from '@/components/action-button';
import { Fold } from '@/app/_components/fold';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { Counter } from '@/app/_components/counter';
import {
  ALONGS,
  DOOR_KINDS,
  MAX_CHAIRS,
  TABLE_SHAPES,
  WALLS,
  chairPoints,
  doorWords,
  shapeDrawn,
  shopPlanOf,
  tableWords,
  unitsOf,
  type Along,
  type DoorKind,
  type SpaceTables,
  type TableShape,
  type Unit,
  type Wall,
} from '@/lib/space-tables';
import type { SpacesOp } from '../actions';

export type Run = (op: SpacesOp, done?: string) => Promise<boolean>;

export function BaseLayout({ spaceId, tables, run, floorPlanOpen }: { spaceId: string; tables: SpaceTables; run: Run; floorPlanOpen: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const units = unitsOf(tables.units, spaceId);
  const seats = units.reduce((s, u) => s + (u.chairs ?? 0), 0);
  return (
    <div className="space-y-4" data-base-layout={spaceId}>
      <p className="text-sn-md text-ink/70" data-base-layout-counts="">
        {units.length === 0 ? 'No tables yet' : `${units.length} ${units.length === 1 ? 'table' : 'tables'} · ${seats} ${seats === 1 ? 'seat' : 'seats'}`}
      </p>
      <DoorList doors={tables.doors.filter((d) => d.groupId === spaceId)} spaceId={spaceId} run={run} />
      <VenueSeatPlan tables={tables} spaceId={spaceId} run={run} floorPlanOpen={floorPlanOpen} />
      <ul className="divide-y divide-ink/10" data-unit-rows="">
        {units.map((u) => (
          <SwipeToDelete key={u.id} as="li" label={`Delete ${u.name}`} onDelete={() => void run({ op: 'deleteTable', id: u.id }, `${u.name} deleted`)}>
            <div data-unit={u.id}>
              <Fold
                title={u.name}
                line={u.shape ? tableWords(u.shape, u.chairs ?? 0, u.chairsAtEnds) : undefined}
                lead={u.shape ? <TableGlyph shape={u.shape} chairs={u.chairs ?? 0} ends={u.chairsAtEnds} /> : undefined}
                open={open === u.id}
                onOpenChange={(o) => setOpen(o ? u.id : null)}
              >
                <TableEdit unit={u} run={run} onDone={() => setOpen(null)} />
              </Fold>
            </div>
          </SwipeToDelete>
        ))}
      </ul>
      <AddTables spaceId={spaceId} run={run} />
    </div>
  );
}

function TableEdit({ unit, run, onDone }: { unit: Unit; run: Run; onDone: () => void }) {
  const [name, setName] = useState(unit.name);
  const [shape, setShape] = useState<TableShape>(unit.shape ?? 'round');
  const [chairs, setChairs] = useState(unit.chairs ?? 8);
  const [ends, setEnds] = useState(unit.chairsAtEnds);
  return (
    <div className="space-y-3 pb-3" data-unit-edit={unit.id}>
      <FormRows width="wide">
        <TypedRow name="Name or number" value={name} maxLength={30} required onKeep={(t) => setName(t.trim())} />
        <TableRows shape={shape} setShape={setShape} chairs={chairs} setChairs={setChairs} ends={ends} setEnds={setEnds} />
      </FormRows>
      <ActionButton
        tone="ok"
        main
        icon={Check}
        label="Save"
        className="!h-11"
        onClick={async () => {
          if (await run({ op: 'updateTable', input: { id: unit.id, name, shape, chairs, ends } }, 'Saved')) onDone();
        }}
      />
    </div>
  );
}

/** Type of table (one dropdown) · Chairs (one number) · Chairs at the ends (Long only). */
function TableRows(p: { shape: TableShape; setShape: (s: TableShape) => void; chairs: number; setChairs: (n: number) => void; ends: boolean; setEnds: (b: boolean) => void }) {
  return (
    <>
      <ChosenRow
        name="Type of table"
        value={p.shape}
        options={TABLE_SHAPES.map((s) => ({ key: s.key, label: s.label, hint: s.hint }))}
        onPick={(k) => p.setShape(k as TableShape)}
        dataAttr="data-table-shape"
      />
      <div className="flex min-h-11 items-center justify-between gap-3 py-1">
        <span className="text-[15px] text-ink">{p.shape === 'half_moon' ? 'Seats' : 'Chairs'}</span>
        <Counter
          value={p.chairs}
          label="Chairs at this table"
          onLess={() => p.setChairs(Math.max(1, p.chairs - 1))}
          onMore={() => p.setChairs(Math.min(MAX_CHAIRS, p.chairs + 1))}
          lessDisabled={p.chairs <= 1}
          moreDisabled={p.chairs >= MAX_CHAIRS}
          data="table-chairs"
        />
      </div>
      {p.shape === 'long' ? <SwitchRow name="Chairs at the ends" line="Counted in the chairs above" on={p.ends} onChange={p.setEnds} data="table-ends" /> : null}
    </>
  );
}

/** Add tables to THIS hall: "T1-T8" makes eight, all of one type. Names are the hall's own (T1 in each hall). */
function AddTables({ spaceId, run }: { spaceId: string; run: Run }) {
  const [names, setNames] = useState('');
  const [shape, setShape] = useState<TableShape>('round');
  const [chairs, setChairs] = useState(8);
  const [ends, setEnds] = useState(false);
  const [ask, setAsk] = useState(0);
  return (
    <div className="space-y-3 border-t border-ink/10 pt-4" data-add-tables={spaceId}>
      <h3 className="text-[15px] font-semibold text-ink">Add tables</h3>
      <FormRows width="wide">
        <TypedRow
          name="Table names or numbers"
          value={names}
          placeholder="T1-T8, VIP"
          maxLength={400}
          openAsk={ask}
          onKeep={(t) => setNames(t)}
          note="Commas between them; T1-T8 makes eight"
        />
        <TableRows shape={shape} setShape={setShape} chairs={chairs} setChairs={setChairs} ends={ends} setEnds={setEnds} />
      </FormRows>
      <ActionButton
        tone="brand"
        icon={Plus}
        label="Add tables"
        className="!h-11 w-full"
        disabled={!names.trim()}
        onClick={async () => {
          if (await run({ op: 'addTables', input: { spaceId, names, shape, chairs, ends } }, 'Tables added')) {
            setNames('');
            setAsk((n) => n + 1);
          }
        }}
      />
      <p className="text-sn-sm text-ink/70">Couples never see which table. You assign it.</p>
    </div>
  );
}

/* ── Doors: Main or Service · which wall · where along it ────────────────────────────────────────────────────── */

function DoorList({ doors, spaceId, run }: { doors: SpaceTables['doors']; spaceId: string; run: Run }) {
  const [kind, setKind] = useState<DoorKind>('main');
  const [wall, setWall] = useState<Wall>('front');
  const [along, setAlong] = useState<Along>('middle');
  return (
    <div className="space-y-2" data-doors={spaceId}>
      <h3 className="text-[14px] font-semibold text-ink">Doors</h3>
      {doors.length === 0 ? <p className="text-sn-md text-ink/70">No doors yet.</p> : null}
      <ul className="divide-y divide-ink/10">
        {doors.map((d) => (
          <SwipeToDelete key={d.id} as="li" word="Remove" label={`Remove ${doorWords(d)}`} onDelete={() => void run({ op: 'deleteDoor', id: d.id }, 'Door removed')}>
            <div className="flex min-h-11 items-center gap-2" data-door={d.id}>
              <DoorOpen aria-hidden className="h-4 w-4 text-ink/70" strokeWidth={1.9} />
              <span className="flex-1 text-[14px] text-ink">{doorWords(d)}</span>
            </div>
          </SwipeToDelete>
        ))}
      </ul>
      <FormRows width="wide">
        <ChosenRow name="Door" value={kind} options={DOOR_KINDS.map((x) => ({ key: x.key, label: x.label }))} onPick={(k) => setKind(k as DoorKind)} dataAttr="data-door-kind" />
        <ChosenRow name="On the wall" value={wall} options={WALLS.map((x) => ({ key: x.key, label: x.label }))} onPick={(k) => setWall(k as Wall)} dataAttr="data-door-wall" />
        <ChosenRow name="Where along it" value={along} options={ALONGS.map((x) => ({ key: x.key, label: x.label }))} onPick={(k) => setAlong(k as Along)} dataAttr="data-door-along" />
      </FormRows>
      <ActionButton tone="neutral" icon={Plus} label="Add a door" className="!h-11" onClick={() => void run({ op: 'addDoor', input: { spaceId, kind, wall, along } }, 'Door added')} />
    </div>
  );
}

/* ── A table's little picture: its type and its one chair count ──────────────────────────────────────────────── */

function TableGlyph({ shape, chairs, ends }: { shape: TableShape; chairs: number; ends: boolean }) {
  const drawn = shapeDrawn(shape, chairs, ends);
  return (
    <svg viewBox="0 0 100 100" className="h-9 w-9 shrink-0" aria-hidden data-table-glyph={drawn}>
      {drawn === 'round' ? <circle cx="50" cy="50" r="24" className="fill-ink/10 stroke-ink/50" strokeWidth="3" /> : null}
      {drawn === 'square' ? <rect x="28" y="28" width="44" height="44" rx="4" className="fill-ink/10 stroke-ink/50" strokeWidth="3" /> : null}
      {drawn === 'long' ? <rect x="16" y="38" width="68" height="24" rx="4" className="fill-ink/10 stroke-ink/50" strokeWidth="3" /> : null}
      {drawn === 'half_moon' ? <path d="M18 62 A32 32 0 0 1 82 62 Z" className="fill-ink/10 stroke-ink/50" strokeWidth="3" /> : null}
      {chairPoints(shape, chairs, ends).map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="6" className="fill-ink/50" />
      ))}
    </svg>
  );
}
