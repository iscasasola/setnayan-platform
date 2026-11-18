'use client';

/**
 * 🪑 PLAN MAKER — the seat plan's drawing and editing, for ANY plan: a couple's room or a supplier's dining area.
 *
 * Owner, 18 Nov 2026: *"we can fix that seat plan to adapt for this one and improve the functions … they are already
 * coded. we just need to improve and adapt them properly"* (DECISION_LOG 2026-11-18). The math is `lib/plan-maker.ts`,
 * which draws every couple table through the couple's own `tableGeometry` and lines tables up through the couple's
 * own `computeAutoLayout`. This component is the screen around it, and it takes a PLAN, not an event:
 *
 *   · `plan` + `onChange` — the room (Wide × Deep), its doors and its tables. `onChange` absent = read-only.
 *   · Grid view (every plan) and Floor plan view. Which ones a page may show is the PAGE's call (`views`; the supplier
 *     page passes Floor plan only on Pro, Max and Ultra — ruling 35). `floorPlanNote` lists it greyed with its reason.
 *   · Read-only for a client page, with ONE table marked (`markedTableId`, `markedLabel`).
 *   · The guest/name layer (`namesByTable`) can be switched off (`showNames: false`) — a supplier's room has no guests.
 *
 * Phone first (390 px): every target is at least 44 px; any set of choices is a `PickMenu` dropdown; a tap only
 * SELECTS a table or door, its settings open under the plan. A drag never waits for a save — the plan moves under the
 * finger and `onChange` runs once, on release.
 *
 * 🔒 Couples never see which room or table a supplier assigns (owner 18 Nov): this component shows exactly the
 * `markedTableId` it is handed and nothing else, and no couple page hands it one.
 * 🔒 app/_components/plan-maker/plan-maker.test.ts
 */

import { useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { Armchair, DoorOpen, RotateCw, Rows3, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Counter } from '@/app/_components/counter';
import { FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { CHAIR_PX, type TableGeometry } from '@/lib/seating';
import {
  PLAN_MAX_CHAIRS,
  PLAN_TABLE_SHAPES,
  addDoor,
  clampChairs,
  clampToRoom,
  doorPoint,
  doorWords,
  isCoupleTableType,
  isPlanTableShape,
  lineUpPlan,
  nextPlanTableLabel,
  parsePlanSide,
  planAspect,
  planFootprintM,
  planRoomM,
  planRoomSized,
  planSeatCount,
  planSeatTotal,
  planTableGeometry,
  planTablePositions,
  planTableWords,
  planTablesInOrder,
  snapDoor,
  type Plan,
  type PlanDoor,
  type PlanTable,
  type PlanTableShape,
  type PlanView,
} from '@/lib/plan-maker';

export type PlanMakerOptions = {
  /** The views this page may show, in dropdown order. Default both. */
  views?: readonly PlanView[];
  /** The view it opens on. Default the first of `views`. */
  view?: PlanView;
  /** Floor plan listed but not pickable, with this reason ("On Pro, Max and Ultra"). Absent = not listed at all when not in `views`. */
  floorPlanNote?: string;
  /** Force read-only even with `onChange` (a client page). */
  readOnly?: boolean;
  /** The ONE table marked on a read-only plan. */
  markedTableId?: string | null;
  /** The mark's words. Default "This table". */
  markedLabel?: string;
  /** The guest/name layer: names per table id, drawn on the chairs and listed in Grid. */
  namesByTable?: Readonly<Record<string, readonly string[]>>;
  /** Switch the name layer off (a supplier's room). Default on when names are given. */
  showNames?: boolean;
  /** A new id for a table or door. Default a random one. */
  newId?: () => string;
};

const VIEW_LABEL: Record<PlanView, string> = { grid: 'Grid', floor: 'Floor plan' };
const W = 1000;

function randomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`;
}

/** One table, drawn at its own size, centred on 0,0 in geometry px. */
function TableShapeSvg({
  g,
  label,
  seated,
  names,
  marked,
  selected,
  fontPx,
}: {
  g: TableGeometry;
  label: string;
  seated: number;
  names: readonly string[] | null;
  marked: boolean;
  selected: boolean;
  fontPx: number;
}) {
  const line = selected ? 'stroke-terracotta-700' : 'stroke-ink';
  const chairR = CHAIR_PX * 0.36;
  return (
    <g>
      {g.outline ? (
        <path
          d={`${g.outline.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('')}Z`}
          className={`fill-ink/10 ${line}`}
          strokeWidth={selected ? 4 : 2}
        />
      ) : null}
      {g.hub.shape === 'round' ? (
        <circle r={g.hub.radius} className={`fill-cream ${line}`} strokeWidth={selected ? 4 : 2} />
      ) : g.hub.shape !== 'ribbon' ? (
        <rect
          x={-g.hub.w / 2}
          y={-g.hub.h / 2}
          width={g.hub.w}
          height={g.hub.h}
          rx={g.hub.shape === 'pill' ? g.hub.h / 2 : Math.min(12, g.hub.radius)}
          className={`fill-cream ${line}`}
          strokeWidth={selected ? 4 : 2}
        />
      ) : null}
      {g.seats.map((s, k) => {
        const who = names?.[k] ?? null;
        const filled = names ? Boolean(who) : k < seated;
        return (
          <g key={k} transform={`translate(${s.x} ${s.y})`} data-plan-seat={k}>
            <circle r={chairR} className={filled ? 'fill-ink stroke-ink' : 'fill-white stroke-ink'} strokeWidth={2} />
            {who ? (
              <text textAnchor="middle" dominantBaseline="central" fontSize={chairR} className="fill-white" fontWeight={700}>
                {who.trim().charAt(0).toUpperCase()}
              </text>
            ) : null}
          </g>
        );
      })}
      <text textAnchor="middle" dominantBaseline="central" fontSize={fontPx} className="fill-ink" fontWeight={600}>
        {label.length > 10 ? `${label.slice(0, 9)}…` : label}
      </text>
      {marked ? <circle r={Math.max(g.box.w, g.box.h) / 2 + 6} fill="none" className="stroke-terracotta-700" strokeWidth={8} data-plan-marked="" /> : null}
    </g>
  );
}

export function PlanMaker({
  plan,
  onChange,
  options = {},
}: {
  plan: Plan;
  onChange?: (next: Plan) => void;
  options?: PlanMakerOptions;
}) {
  const views = options.views && options.views.length ? options.views : (['grid', 'floor'] as const);
  const [view, setView] = useState<PlanView>(options.view && views.includes(options.view) ? options.view : views[0]!);
  const editable = Boolean(onChange) && !options.readOnly;
  const showNames = options.showNames ?? Boolean(options.namesByTable);
  const names = showNames ? options.namesByTable ?? null : null;
  const marked = options.markedTableId ?? null;
  const markedLabel = options.markedLabel ?? 'This table';
  const newId = options.newId ?? randomId;

  /* The plan under the finger while a drag runs; null = the caller's plan. */
  const [live, setLive] = useState<Plan | null>(null);
  const shown = live ?? plan;
  const [sel, setSel] = useState<{ kind: 'table' | 'door'; id: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: 'table' | 'door'; id: string; x0: number; y0: number; moved: boolean } | null>(null);

  const commit = (next: Plan) => {
    if (editable) onChange!(next);
  };

  const room = planRoomM(shown.room);
  const aspect = planAspect(shown.room);
  const H = W / aspect;
  const pxPerM = W / room.widthM;
  const positions = useMemo(() => planTablePositions(shown.tables), [shown.tables]);
  const seats = planSeatTotal(shown);

  const viewOptions = [
    ...views.map((v) => ({ key: v, label: VIEW_LABEL[v] })),
    ...(!views.includes('floor') && options.floorPlanNote
      ? [{ key: 'floor', label: VIEW_LABEL.floor, disabledNote: options.floorPlanNote }]
      : []),
  ];

  const pct = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  const onDown = (kind: 'table' | 'door', id: string) => (e: RPE<SVGGElement>) => {
    if (!editable) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind, id, x0: e.clientX, y0: e.clientY, moved: false };
  };
  const onMove = (e: RPE<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
    d.moved = true;
    const p = pct(e);
    const base = live ?? plan;
    if (d.kind === 'table') {
      const at = clampToRoom(p.x, p.y);
      setLive({ ...base, tables: base.tables.map((t) => (t.id === d.id ? { ...t, x: at.x, y: at.y } : t)) });
    } else {
      const at = snapDoor(p.x, p.y);
      setLive({ ...base, doors: base.doors.map((x) => (x.id === d.id ? { ...x, ...at } : x)) });
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved && live) commit(live);
    else setSel((s) => (s && s.kind === d.kind && s.id === d.id ? null : { kind: d.kind, id: d.id }));
    setLive(null);
  };

  const selTable = sel?.kind === 'table' ? shown.tables.find((t) => t.id === sel.id) ?? null : null;
  const selDoor = sel?.kind === 'door' ? shown.doors.find((d) => d.id === sel.id) ?? null : null;
  const setTable = (id: string, patch: Partial<PlanTable>) =>
    commit({ ...plan, tables: plan.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  const addTable = () => {
    const id = newId();
    const t: PlanTable = { id, label: nextPlanTableLabel(plan.tables), kind: 'round', chairs: 8, x: null, y: null };
    commit({ ...plan, tables: [...plan.tables, t] });
    setSel({ kind: 'table', id });
  };

  const sideRow = (which: 'widthM' | 'depthM', name: string) => (
    <TypedRow
      name={name}
      value={shown.room[which] == null ? '' : String(shown.room[which])}
      empty="Add"
      inputMode="text"
      check={(s) => (parsePlanSide(s) === 'bad' ? 'A size in metres, up to 500.' : null)}
      onKeep={(s) => {
        const v = parsePlanSide(s);
        if (v === 'bad') return { ok: false, error: 'A size in metres, up to 500.' };
        commit({ ...plan, room: { ...plan.room, [which]: v } });
      }}
      attrs={{ 'data-plan-room-side': which }}
    />
  );

  return (
    <section className="flex flex-col gap-3" data-plan-maker="" data-plan-view={view} data-plan-readonly={editable ? undefined : ''}>
      <div className="flex flex-wrap items-center gap-2">
        {viewOptions.length > 1 ? (
          <PickMenu
            label="View"
            value={view}
            options={viewOptions}
            onPick={(k) => {
              if (views.includes(k as PlanView)) setView(k as PlanView);
            }}
            dataAttr="data-plan-view-pick"
          />
        ) : null}
        <p className="text-sm text-ink/70" data-plan-counts="">
          {shown.tables.length} {shown.tables.length === 1 ? 'table' : 'tables'} · {seats} {seats === 1 ? 'seat' : 'seats'}
        </p>
      </div>

      {editable ? (
        <div className="grid grid-cols-3 gap-2" data-plan-tools="">
          <ActionButton tone="brand" icon={Armchair} label="＋ Table" onClick={addTable} data-plan-add-table="" />
          <ActionButton
            tone="neutral"
            icon={DoorOpen}
            label="＋ Door"
            onClick={() => {
              const id = newId();
              commit(addDoor(plan, id));
              setSel({ kind: 'door', id });
            }}
            data-plan-add-door=""
          />
          <ActionButton tone="neutral" icon={Rows3} label="Line up" onClick={() => commit(lineUpPlan(plan))} data-plan-line-up="" />
        </div>
      ) : null}

      {editable ? (
        <FormRows data="plan-room-size">
          {sideRow('widthM', 'Wide (m)')}
          {sideRow('depthM', 'Deep (m)')}
        </FormRows>
      ) : null}
      {!planRoomSized(shown.room) ? (
        <p className="text-xs text-ink/60" data-plan-unsized="">
          No room size yet — drawn {room.widthM} × {room.depthM} m.
        </p>
      ) : null}

      {view === 'floor' ? (
        <div className="sn-frame w-full overflow-hidden" style={{ aspectRatio: `${aspect}` }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="block h-full w-full touch-none select-none"
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => {
              drag.current = null;
              setLive(null);
            }}
            role="img"
            aria-label={`Floor plan, ${room.widthM} by ${room.depthM} metres, ${shown.tables.length} tables`}
            data-plan-floor=""
          >
            <rect x={4} y={4} width={W - 8} height={H - 8} fill="none" className="stroke-ink" strokeWidth={8} />
            {shown.doors.map((d) => {
              const p = doorPoint(d);
              const along = d.wall === 'top' || d.wall === 'bottom';
              const len = Math.max(60, 1.4 * pxPerM);
              const cx = (p.x / 100) * W;
              const cy = (p.y / 100) * H;
              const isSel = sel?.kind === 'door' && sel.id === d.id;
              return (
                <g
                  key={d.id}
                  onPointerDown={onDown('door', d.id)}
                  style={{ cursor: editable ? 'grab' : undefined }}
                  data-plan-door={d.kind}
                  data-plan-door-wall={d.wall}
                >
                  {/* a 44 px+ hit box round the door */}
                  <rect x={cx - 50} y={cy - 50} width={100} height={100} fill="transparent" />
                  <line
                    x1={along ? cx - len / 2 : cx}
                    x2={along ? cx + len / 2 : cx}
                    y1={along ? cy : cy - len / 2}
                    y2={along ? cy : cy + len / 2}
                    className={isSel || d.kind === 'main' ? 'stroke-terracotta-700' : 'stroke-ink/50'}
                    strokeWidth={22}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
            {shown.tables.map((t, i) => {
              const g = planTableGeometry(t);
              const p = positions[i]!;
              const s = (planFootprintM(t) * pxPerM) / g.box.w;
              const isSel = sel?.kind === 'table' && sel.id === t.id;
              return (
                <g
                  key={t.id}
                  transform={`translate(${(p.x / 100) * W} ${(p.y / 100) * H}) scale(${s}) rotate(${t.rotationDeg ?? 0})`}
                  onPointerDown={onDown('table', t.id)}
                  style={{ cursor: editable ? 'grab' : undefined }}
                  data-plan-table={t.id}
                  data-plan-kind={t.kind}
                >
                  <TableShapeSvg
                    g={g}
                    label={t.label}
                    seated={0}
                    names={names ? names[t.id] ?? [] : null}
                    marked={marked === t.id}
                    selected={isSel}
                    fontPx={Math.max(18, 24 / s)}
                  />
                </g>
              );
            })}
            {marked
              ? (() => {
                  const i = shown.tables.findIndex((t) => t.id === marked);
                  if (i < 0) return null;
                  const p = positions[i]!;
                  const t = shown.tables[i]!;
                  const r = (planFootprintM(t) * pxPerM) / 2;
                  const x = (p.x / 100) * W;
                  const y = Math.max(30, (p.y / 100) * H - r - 30);
                  return (
                    <g data-plan-mark-pill="" pointerEvents="none">
                      <rect x={x - 90} y={y - 24} width={180} height={48} rx={24} className="fill-terracotta-700" />
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={26} fontWeight={700} className="fill-white">
                        {markedLabel}
                      </text>
                    </g>
                  );
                })()
              : null}
          </svg>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2" data-plan-grid="">
          {planTablesInOrder(shown.tables).map((t) => {
            const g = planTableGeometry(t);
            const isMarked = marked === t.id;
            const isSel = sel?.kind === 'table' && sel.id === t.id;
            const list = names ? names[t.id] ?? [] : null;
            const pad = 8;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setSel(isSel ? null : { kind: 'table', id: t.id })}
                  className={`flex min-h-[44px] w-full flex-col items-center gap-1 rounded-xl border bg-white p-2 text-left disabled:cursor-default ${
                    isMarked || isSel ? 'border-terracotta ring-2 ring-terracotta/30' : 'border-ink/15'
                  }`}
                  data-plan-tile={t.id}
                  data-plan-tile-marked={isMarked ? '' : undefined}
                  aria-label={`${t.label}, ${planTableWords(t)}${isMarked ? `, ${markedLabel}` : ''}`}
                >
                  <svg
                    viewBox={`${-g.box.w / 2 - pad} ${-g.box.h / 2 - pad} ${g.box.w + 2 * pad} ${g.box.h + 2 * pad}`}
                    className="h-20 w-full"
                    aria-hidden="true"
                  >
                    <g transform={`rotate(${t.rotationDeg ?? 0})`}>
                      <TableShapeSvg g={g} label="" seated={0} names={list} marked={false} selected={false} fontPx={20} />
                    </g>
                  </svg>
                  <span className="w-full truncate text-sm font-semibold text-ink">{t.label}</span>
                  <span className="w-full text-xs text-ink/70">{planTableWords(t)}</span>
                  {isMarked ? (
                    <span className="rounded-full bg-terracotta-700 px-2 py-0.5 text-[11px] font-bold text-white">{markedLabel}</span>
                  ) : null}
                  {list && list.length ? (
                    <span className="w-full text-xs text-ink/70" data-plan-tile-names="">
                      {list.filter(Boolean).join(', ')}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {shown.tables.length === 0 ? <li className="col-span-2 text-sm text-ink/60">No tables yet.</li> : null}
        </ul>
      )}

      {editable && selTable ? (
        <div className="sn-frame flex flex-col gap-2 p-3" data-plan-table-sheet={selTable.id}>
          <FormRows data="plan-table">
            <TypedRow
              name="Name"
              value={selTable.label}
              maxLength={30}
              onKeep={(s) => {
                if (!s.trim()) return { ok: false, error: 'Give the table a name or number.' };
                setTable(selTable.id, { label: s.trim() });
              }}
              attrs={{ 'data-plan-table-name': '' }}
            />
            {isPlanTableShape(selTable.kind) ? (
              <SwitchRow
                name="Chairs at the ends"
                line="One at each end, counted in the chairs"
                on={selTable.kind === 'long' && Boolean(selTable.chairsAtEnds)}
                disabled={selTable.kind !== 'long'}
                onChange={(on) => setTable(selTable.id, { chairsAtEnds: on })}
                attrs={{ 'data-plan-ends': '' }}
              />
            ) : null}
          </FormRows>
          <div className="flex flex-wrap items-center gap-2">
            {isPlanTableShape(selTable.kind) ? (
              <PickMenu
                label="Table shape"
                value={selTable.kind}
                options={PLAN_TABLE_SHAPES.map((s) => ({ key: s.key, label: s.label, hint: s.hint }))}
                onPick={(k) => setTable(selTable.id, { kind: k as PlanTableShape, chairsAtEnds: k === 'long' ? selTable.chairsAtEnds : false })}
                dataAttr="data-plan-shape-pick"
              />
            ) : (
              <span className="text-sm text-ink/70">{planTableWords(selTable)}</span>
            )}
            {!isCoupleTableType(selTable.kind) ? (
              <Counter
                label="Chairs at this table"
                value={planSeatCount(selTable)}
                onLess={() => setTable(selTable.id, { chairs: clampChairs(selTable.chairs - 1) })}
                onMore={() => setTable(selTable.id, { chairs: clampChairs(selTable.chairs + 1) })}
                lessDisabled={selTable.chairs <= 1}
                moreDisabled={selTable.chairs >= PLAN_MAX_CHAIRS}
                lessLabel={selTable.chairs <= 1 ? 'A table keeps at least one chair' : 'One chair less'}
                moreLabel={selTable.chairs >= PLAN_MAX_CHAIRS ? `${PLAN_MAX_CHAIRS} chairs is the most` : 'One chair more'}
                data="plan-chairs"
              />
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              tone="neutral"
              icon={RotateCw}
              label="Turn"
              onClick={() => setTable(selTable.id, { rotationDeg: ((selTable.rotationDeg ?? 0) + 45) % 360 })}
              data-plan-turn=""
            />
            <ActionButton
              tone="danger"
              icon={Trash2}
              label="Remove"
              onClick={() => {
                commit({ ...plan, tables: plan.tables.filter((t) => t.id !== selTable.id) });
                setSel(null);
              }}
              data-plan-remove-table=""
            />
          </div>
        </div>
      ) : null}

      {editable && selDoor ? (
        <DoorSheet
          door={selDoor}
          onKind={(kind) => commit({ ...plan, doors: plan.doors.map((d) => (d.id === selDoor.id ? { ...d, kind } : d)) })}
          onRemove={() => {
            commit({ ...plan, doors: plan.doors.filter((d) => d.id !== selDoor.id) });
            setSel(null);
          }}
        />
      ) : null}
    </section>
  );
}

function DoorSheet({ door, onKind, onRemove }: { door: PlanDoor; onKind: (k: PlanDoor['kind']) => void; onRemove: () => void }) {
  return (
    <div className="sn-frame flex flex-col gap-2 p-3" data-plan-door-sheet={door.id}>
      <p className="text-sm text-ink/70">{doorWords(door)} — drag it along any wall; it snaps to the nearest one.</p>
      <div className="grid grid-cols-2 gap-2">
        <PickMenu
          label="Door"
          value={door.kind}
          options={[
            { key: 'main', label: 'Main door' },
            { key: 'service', label: 'Door' },
          ]}
          onPick={(k) => onKind(k === 'main' ? 'main' : 'service')}
          dataAttr="data-plan-door-kind"
        />
        <ActionButton tone="danger" icon={Trash2} label="Remove" onClick={onRemove} data-plan-remove-door="" />
      </div>
    </div>
  );
}
