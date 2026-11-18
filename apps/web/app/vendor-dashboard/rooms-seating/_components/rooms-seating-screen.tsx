'use client';

/**
 * 🛏 ROOMS & SEATING — the screen (piece A, owner 2026-11-18). One `Show ▾` dropdown picks the section; each section
 * is the shop's own rows in the shared form rows (`FormRows` · `TypedRow` · `ChosenRow` · `SwitchRow` · `Counter`), so
 * nothing here is a new control. Every save runs in the background and the screen takes the server's fresh read back.
 *
 * Supplier-only. The drawn plan (Grid · Move · Line up · tables on a sized room) is the SHARED seat-plan core (owner
 * 18 Nov: "they are already coded … improve and adapt them"), built by its own session — not redrawn here.
 */
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DoorOpen, Plus, RotateCw, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { Counter } from '@/app/_components/counter';
import { ShopNotice } from '../../_components/kit';
import {
  ALONGS,
  DOOR_KINDS,
  MAX_CHAIRS,
  SECTIONS,
  TABLE_SHAPES,
  WALLS,
  chairPoints,
  countsLine,
  doorWords,
  shapeDrawn,
  tableWords,
  unitsOf,
  type Along,
  type Door,
  type DoorKind,
  type RoomsSeating,
  type Section,
  type TableShape,
  type Unit,
  type UnitGroup,
  type Wall,
} from '@/lib/rooms-seating';
import { roomsSeatingWrite as w, type RoomsSeatingResult } from '../actions';

type HallSize = { widthM: number; lengthM: number } | null;
const NEW = '__new__';

export function RoomsSeatingScreen({ initial, hallSize: hallInitial, show: showInitial }: { initial: RoomsSeating | null; hallSize: HallSize; show: Section }) {
  const router = useRouter();
  const [data, setData] = useState<RoomsSeating | null>(initial);
  const [hall, setHall] = useState<HallSize>(hallInitial);
  const [show, setShow] = useState<Section>(showInitial);
  const [msg, setMsg] = useState<{ tone: 'success' | 'warn'; text: string } | null>(null);
  const [pending, start] = useTransition();

  /** Run one save; take the fresh read back, or say why it did not land. */
  const run = (job: () => Promise<RoomsSeatingResult>, done?: string) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const r = await job();
        if (r.ok) {
          setData(r.data);
          setHall(r.hallSize);
          setMsg(done ? { tone: 'success', text: done } : null);
        } else setMsg({ tone: 'warn', text: r.error });
        resolve(r.ok);
      }),
    );

  if (data === null) {
    return (
      <div className="mt-4 space-y-3" role="alert" data-rooms-seating-refused="">
        <ShopNotice tone="warn">Couldn&rsquo;t load your rooms and tables just now. Nothing was changed.</ShopNotice>
        <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={() => router.refresh()} className="!h-11" />
      </div>
    );
  }

  const pick = (k: string) => {
    setShow(k as Section);
    setMsg(null);
    const u = new URL(window.location.href);
    u.searchParams.set('show', k);
    window.history.replaceState(null, '', u);
  };

  return (
    <div className="mt-3 space-y-4" aria-busy={pending}>
      <p className="text-[13px] text-ink/70" data-rooms-seating-counts="">
        {countsLine(data, hall !== null)}
      </p>
      <div className="flex min-h-11 items-center gap-2">
        <span className="text-[14px] text-ink/70">Show</span>
        <PickMenu
          label="Show"
          value={show}
          compact
          dataAttr="data-rooms-seating-show"
          options={SECTIONS.map((s) => ({ key: s.key, label: s.label, hint: s.line }))}
          onPick={pick}
        />
      </div>
      {msg ? (
        <ShopNotice tone={msg.tone} role={msg.tone === 'warn' ? 'alert' : 'status'}>
          {msg.text}
        </ShopNotice>
      ) : null}
      {show === 'rooms' ? <RoomsSection data={data} run={run} /> : null}
      {show === 'halls' ? <HallSection data={data} hall={hall} run={run} /> : null}
      {show === 'tables' ? <TablesSection data={data} run={run} /> : null}
    </div>
  );
}

type Run = (job: () => Promise<RoomsSeatingResult>, done?: string) => Promise<boolean>;

/* ── Hotel rooms ─────────────────────────────────────────────────────────────────────────────────────────────── */

function RoomsSection({ data, run }: { data: RoomsSeating; run: Run }) {
  const floors = data.groups.filter((g) => g.kind === 'floor');
  return (
    <section className="space-y-5" data-rooms-section="rooms">
      {floors.length === 0 ? <p className="text-[14px] text-ink/70">You have no rooms yet. Add your first floor and its rooms below.</p> : null}
      {floors.map((f) => (
        <GroupBlock key={f.id} group={f} units={unitsOf(data.units, f.id)} groups={floors} run={run} />
      ))}
      <AddUnits kind="room" groups={floors} run={run} />
    </section>
  );
}

/* ── Halls: the shop's ONE room size (vendor_profiles) + its doors ───────────────────────────────────────────── */

function HallSection({ data, hall, run }: { data: RoomsSeating; hall: HallSize; run: Run }) {
  return (
    <section className="space-y-4" data-rooms-section="halls">
      <p className="text-[13.5px] text-ink/70">The size of your hall and where its doors are. Stylists and setup crews plan with it.</p>
      <SizeRows
        what="hall"
        widthM={hall?.widthM ?? null}
        lengthM={hall?.lengthM ?? null}
        onSave={(wd, dp) => run(() => w({ op: 'setHallSize', width: wd, depth: dp }), 'Hall size saved')}
      />
      <DoorList doors={data.doors.filter((d) => d.groupId === null)} groupId={null} run={run} />
      <p className="text-[12.5px] text-ink/70">Shared: the size and the doors. Nothing else. Wiring, outlets and back rooms are never asked here.</p>
    </section>
  );
}

/* ── Dining areas and tables ─────────────────────────────────────────────────────────────────────────────────── */

function TablesSection({ data, run }: { data: RoomsSeating; run: Run }) {
  const areas = data.groups.filter((g) => g.kind === 'dining_area');
  return (
    <section className="space-y-5" data-rooms-section="tables">
      {areas.length === 0 ? <p className="text-[14px] text-ink/70">You have no tables yet. Add your first dining area and its tables below.</p> : null}
      {areas.map((a) => (
        <GroupBlock key={a.id} group={a} units={unitsOf(data.units, a.id)} groups={areas} run={run}>
          <SizeRows what="area" widthM={a.widthM} lengthM={a.lengthM} onSave={(wd, dp) => run(() => w({ op: 'setAreaSize', id: a.id, width: wd, depth: dp }), 'Room size saved')} />
          <DoorList doors={data.doors.filter((d) => d.groupId === a.id)} groupId={a.id} run={run} />
        </GroupBlock>
      ))}
      <AddUnits kind="table" groups={areas} run={run} />
    </section>
  );
}

/* ── One floor or area: its name, its rows, delete ───────────────────────────────────────────────────────────── */

function GroupBlock({ group, units, groups, run, children }: { group: UnitGroup; units: Unit[]; groups: UnitGroup[]; run: Run; children?: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const noun = group.kind === 'floor' ? 'room' : 'table';
  return (
    <div className="sn-tile space-y-2 p-3" data-unit-group={group.id}>
      <FormRows width="wide">
        <TypedRow
          name={group.kind === 'floor' ? 'Floor' : 'Area'}
          value={group.name}
          maxLength={60}
          onKeep={async (t) => ({ ok: await run(() => w({ op: 'renameGroup', id: group.id, name: t })) })}
        />
      </FormRows>
      {children}
      <ul className="divide-y divide-ink/10" data-unit-rows="">
        {units.map((u) => (
          <li key={u.id} data-unit={u.id}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-3 text-left"
              aria-expanded={open === u.id}
              onClick={() => setOpen(open === u.id ? null : u.id)}
            >
              {u.kind === 'table' && u.shape ? <TableGlyph shape={u.shape} chairs={u.chairs ?? 0} ends={u.chairsAtEnds} /> : null}
              <span className="text-[15px] font-medium text-ink">{u.kind === 'room' ? `Room ${u.name}` : u.name}</span>
              {u.kind === 'table' && u.shape ? <span className="text-[13px] text-ink/70">{tableWords(u.shape, u.chairs ?? 0, u.chairsAtEnds)}</span> : null}
            </button>
            {open === u.id ? <UnitEdit unit={u} groups={groups} run={run} onDone={() => setOpen(null)} /> : null}
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <ActionButton
          tone="danger"
          quiet
          icon={Trash2}
          label={`Delete ${group.kind === 'floor' ? 'floor' : 'area'}`}
          name={`Delete ${group.name} and its ${units.length} ${noun}${units.length === 1 ? '' : 's'}`}
          className="!h-11"
          onClick={() => {
            const sure = units.length === 0 || window.confirm(`Delete ${group.name} and its ${units.length} ${noun}${units.length === 1 ? '' : 's'}?`);
            if (sure) void run(() => w({ op: 'deleteGroup', id: group.id }), `${group.name} deleted`);
          }}
        />
      </div>
    </div>
  );
}

/* ── Edit one room or table ──────────────────────────────────────────────────────────────────────────────────── */

function UnitEdit({ unit, groups, run, onDone }: { unit: Unit; groups: UnitGroup[]; run: Run; onDone: () => void }) {
  const [name, setName] = useState(unit.name);
  const [groupId, setGroupId] = useState(unit.groupId);
  const [shape, setShape] = useState<TableShape>(unit.shape ?? 'round');
  const [chairs, setChairs] = useState(unit.chairs ?? 8);
  const [ends, setEnds] = useState(unit.chairsAtEnds);
  const table = unit.kind === 'table';
  return (
    <div className="space-y-3 pb-3" data-unit-edit={unit.id}>
      <FormRows width="wide">
        <TypedRow name="Name or number" value={name} maxLength={30} required onKeep={(t) => setName(t.trim())} />
        <ChosenRow
          name={table ? 'Area' : 'Floor'}
          value={groupId}
          options={groups.map((g) => ({ key: g.id, label: g.name }))}
          onPick={setGroupId}
          dataAttr="data-unit-where"
        />
        {table ? <TableRows shape={shape} setShape={setShape} chairs={chairs} setChairs={setChairs} ends={ends} setEnds={setEnds} /> : null}
      </FormRows>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          tone="ok"
          main
          icon={Plus}
          label="Save"
          className="!h-11"
          onClick={async () => {
            const ok = await run(
              () => w({ op: 'updateUnit', input: { id: unit.id, name, groupId, ...(table ? { shape, chairs, ends } : {}) } }),
              'Saved',
            );
            if (ok) onDone();
          }}
        />
        <ActionButton tone="danger" quiet icon={Trash2} label="Delete" className="!h-11" onClick={() => void run(() => w({ op: 'deleteUnit', id: unit.id }), `${unit.name} deleted`)} />
      </div>
    </div>
  );
}

/** Type of table (one dropdown) · Chairs (one number) · Chairs at the ends (Long only). */
function TableRows(p: {
  shape: TableShape;
  setShape: (s: TableShape) => void;
  chairs: number;
  setChairs: (n: number) => void;
  ends: boolean;
  setEnds: (b: boolean) => void;
}) {
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

/* ── Add rooms / Add tables ──────────────────────────────────────────────────────────────────────────────────── */

function AddUnits({ kind, groups, run }: { kind: 'room' | 'table'; groups: UnitGroup[]; run: Run }) {
  const [names, setNames] = useState('');
  const [where, setWhere] = useState<string>(groups[0]?.id ?? NEW);
  const [newName, setNewName] = useState('');
  const [shape, setShape] = useState<TableShape>('round');
  const [chairs, setChairs] = useState(8);
  const [ends, setEnds] = useState(false);
  const [ask, setAsk] = useState(0);
  const groupWord = kind === 'room' ? 'floor' : 'area';
  const whereOptions = useMemo(
    () => [...groups.map((g) => ({ key: g.id, label: g.name })), { key: NEW, label: kind === 'room' ? 'New floor or wing…' : 'New area…' }],
    [groups, kind],
  );
  const whereNow = whereOptions.some((o) => o.key === where) ? where : NEW;
  return (
    <div className="sn-tile space-y-3 p-3" data-add-units={kind}>
      <h2 className="text-[15px] font-semibold text-ink">{kind === 'room' ? 'Add rooms' : 'Add tables'}</h2>
      <FormRows width="wide">
        <TypedRow
          name={kind === 'room' ? 'Room names or numbers' : 'Table names or numbers'}
          value={names}
          placeholder={kind === 'room' ? '301-310, Penthouse' : 'T1-T8, VIP'}
          maxLength={400}
          openAsk={ask}
          onKeep={(t) => setNames(t)}
          note="Commas between them; 301-310 makes ten"
        />
        {kind === 'table' ? <TableRows shape={shape} setShape={setShape} chairs={chairs} setChairs={setChairs} ends={ends} setEnds={setEnds} /> : null}
        <ChosenRow name="Where" value={whereNow} options={whereOptions} onPick={setWhere} dataAttr={`data-add-${kind}-where`} />
        {whereNow === NEW ? (
          <TypedRow name={kind === 'room' ? 'Name the floor' : 'Name the area'} value={newName} maxLength={60} placeholder={kind === 'room' ? '3rd floor' : 'Garden'} onKeep={(t) => setNewName(t)} />
        ) : null}
      </FormRows>
      <ActionButton
        tone="brand"
        main
        icon={Plus}
        label={kind === 'room' ? 'Add rooms' : 'Add tables'}
        className="!h-11 w-full"
        disabled={!names.trim()}
        onClick={async () => {
          const ok = await run(
            () =>
              w({ op: 'addUnits', input: {
                kind,
                names,
                groupId: whereNow === NEW ? null : whereNow,
                newGroupName: whereNow === NEW ? newName : null,
                ...(kind === 'table' ? { shape, chairs, ends } : {}),
              } }),
            kind === 'room' ? 'Rooms added' : 'Tables added',
          );
          if (ok) {
            setNames('');
            setNewName('');
            setAsk((n) => n + 1);
          }
        }}
      />
      <p className="text-[12.5px] text-ink/70">Couples never see which {kind} — only that one is available. You assign it.</p>
      {groups.length === 0 ? <p className="sr-only">Name your first {groupWord} above.</p> : null}
    </div>
  );
}

/* ── Room size (Wide × Deep, metres) ─────────────────────────────────────────────────────────────────────────── */

function SizeRows({ what, widthM, lengthM, onSave }: { what: 'hall' | 'area'; widthM: number | null; lengthM: number | null; onSave: (w: string, l: string) => Promise<boolean> }) {
  const [w, setW] = useState(widthM == null ? '' : String(widthM));
  const [l, setL] = useState(lengthM == null ? '' : String(lengthM));
  const keep = async (nw: string, nl: string) => {
    setW(nw);
    setL(nl);
    if ((nw === '') !== (nl === '')) return { ok: true as const }; // wait for the other side
    return { ok: await onSave(nw, nl) };
  };
  return (
    <FormRows width="wide" data={`room-size-${what}`}>
      <TypedRow name="Wide (m)" value={w} empty="Add" inputMode="numeric" maxLength={6} onKeep={(t) => keep(t.trim(), l)} />
      <TypedRow name="Deep (m)" value={l} empty="Add" inputMode="numeric" maxLength={6} onKeep={(t) => keep(w, t.trim())} />
    </FormRows>
  );
}

/* ── Doors: Main or Service · which wall · where along it ────────────────────────────────────────────────────── */

function DoorList({ doors, groupId, run }: { doors: Door[]; groupId: string | null; run: Run }) {
  const [kind, setKind] = useState<DoorKind>('main');
  const [wall, setWall] = useState<Wall>('front');
  const [along, setAlong] = useState<Along>('middle');
  return (
    <div className="space-y-2" data-doors={groupId ?? 'hall'}>
      <h3 className="text-[14px] font-semibold text-ink">Doors</h3>
      {doors.length === 0 ? <p className="text-[13.5px] text-ink/70">No doors yet.</p> : null}
      <ul className="divide-y divide-ink/10">
        {doors.map((d) => (
          <li key={d.id} className="flex min-h-11 items-center gap-2" data-door={d.id}>
            <DoorOpen aria-hidden className="h-4 w-4 text-ink/70" strokeWidth={1.9} />
            <span className="flex-1 text-[14px] text-ink">{doorWords(d)}</span>
            <ActionButton tone="danger" quiet iconOnly icon={Trash2} label="Remove" name={`Remove ${doorWords(d)}`} className="!h-11" onClick={() => void run(() => w({ op: 'deleteDoor', id: d.id }), 'Door removed')} />
          </li>
        ))}
      </ul>
      <FormRows width="wide">
        <ChosenRow name="Door" value={kind} options={DOOR_KINDS.map((x) => ({ key: x.key, label: x.label }))} onPick={(k) => setKind(k as DoorKind)} dataAttr="data-door-kind" />
        <ChosenRow name="On the wall" value={wall} options={WALLS.map((x) => ({ key: x.key, label: x.label }))} onPick={(k) => setWall(k as Wall)} dataAttr="data-door-wall" />
        <ChosenRow name="Where along it" value={along} options={ALONGS.map((x) => ({ key: x.key, label: x.label }))} onPick={(k) => setAlong(k as Along)} dataAttr="data-door-along" />
      </FormRows>
      <ActionButton tone="neutral" icon={Plus} label="Add a door" className="!h-11" onClick={() => void run(() => w({ op: 'addDoor', input: { groupId, kind, wall, along } }), 'Door added')} />
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
