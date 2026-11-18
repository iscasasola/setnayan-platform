'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { UsersRound, X } from 'lucide-react';
import { dragEdgeStep } from '@/lib/drag-edge-scroll';
import { TAP_SLOP_MOUSE, TAP_SLOP_TOUCH } from '@/lib/march-drag';
import { formatCount } from '@/lib/format-number';
import { ActionButton } from '@/components/action-button';
import { SEAT_HOLD_MS } from '@/lib/seat-list-drop';
import { useThumbRoom } from '@/lib/thumb-room';

/**
 * ✋ THE SEAT PLAN IS DRAG-FIRST ON A PHONE (owner 2026-11-16, DECISION_LOG "seat plan guest drag on phone", batch 2
 * "what Guests opens" — prototypes/event_pages_guests_doors_2026-11-16/…_fable.html, "Seat plan (drag-first)"):
 * *"the seat plan would be the best drag and very clean way of applying the seat planning."* — *"Yes, phone too"*.
 * This lifts the 1 Oct "no drag on a phone" for GUESTS only; a table still moves only once it is picked.
 *
 * Under the floor (Guests › Seats › 2D on a phone), the people still to seat are a tray of 44-px faces (and their
 * groups), and the hint line gives way to it:
 *   · press and hold a face (a mouse: press and move) — it lifts; the dark line says "Seating Tess Lim · drop on a
 *     chair or a table · Cancel";
 *   · over a table, the table is ringed and the chair it will land on lights up — the chair under the finger (any chair
 *     within 22 px of it: the 44-px floor), else the table's nearest free chair;
 *   · near the floor's edges the floor pans by itself, faster the nearer — THE shared edge rule (`dragEdgeStep`);
 *   · let go: the editor's own drop (`dropSeat` → `planSeatDrop`, the ONE answer Seats › List's drag already gives),
 *     with its one Undo line. A tap (no hold) is the shipped "Move Tess to…" — tap · move stays.
 *
 * PRESENTATIONAL + the gesture: nothing here saves. The floor's tables and chairs carry `data-plan-table` /
 * `data-plan-chair` (set by the editor); this file only reads them back, and lights them straight on the DOM (no
 * re-render per frame, the List drag's way).
 */

export type TrayFace = { id: string; name: string; initials: string; photo: string | null };
export type TrayGroup = { id: string; label: string; count: number };
/** What was held: one guest, or a whole group (a group lands at a table, never one chair). */
export type TrayItem = { kind: 'guest'; id: string; name: string } | { kind: 'group'; id: string; name: string };
/** Where it was let go — the chair, or (zoomed out / a group) only the table, the editor picking the chair. */
export type FloorDrop = { tableId: string; seat: number | null };

/** A chair whose centre is within this of the finger is the chair under it — a 44-px target on a small chair. */
export const CHAIR_REACH_PX = 22;
const TABLE_OVER = 'planDropOver';
const CHAIR_OVER = 'planDropChair';

type Pending = { item: TrayItem; el: HTMLElement; x: number; y: number; touch: boolean; pid: number; timer: ReturnType<typeof setTimeout> | null };
type Drag = { item: TrayItem; ghost: HTMLElement; x: number; y: number; armed: boolean };

/** The table and chair under (x, y): the chair within reach of the finger, else the nearest free one at that table. */
function landingAt(x: number, y: number, item: TrayItem): { table: HTMLElement; chair: HTMLElement | null } | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const table = el?.closest<HTMLElement>('[data-plan-table]') ?? null;
  if (!table || !table.closest('[data-plan-floor]')) return null;
  if (item.kind === 'group') return { table, chair: null };
  const els = [...table.querySelectorAll<HTMLElement>('[data-plan-chair]')];
  const at = chairToLand(
    els.map((c) => {
      const r = c.getBoundingClientRect();
      return { dist: Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y), taken: 'planChairTaken' in c.dataset };
    }),
  );
  return { table, chair: els[at] ?? null };
}

/**
 * WHICH CHAIR A FACE LANDS ON (pure — 🔒 the-seat-plan-drags-on-a-phone.test.ts): the chair under the finger, taken or
 * free (any chair within `CHAIR_REACH_PX` — the 44-px floor on a small chair; a taken one means the two trade, asked
 * first) — else the table's nearest FREE chair. -1 = none (a full table, or no chairs drawn: zoomed out).
 */
export function chairToLand(chairs: readonly { dist: number; taken: boolean }[]): number {
  let near = -1;
  let free = -1;
  chairs.forEach((c, i) => {
    if (c.dist <= CHAIR_REACH_PX && (near < 0 || c.dist < chairs[near]!.dist)) near = i;
    if (!c.taken && (free < 0 || c.dist < chairs[free]!.dist)) free = i;
  });
  return near >= 0 ? near : free;
}

export function SeatFaceTray({
  faces,
  groups,
  canEdit,
  hasTables = true,
  onTapFace,
  onMore,
  onDrop,
  onPan,
}: {
  /** Every coming guest with no seat — the tray draws as many faces as its row holds, and "+N" for the rest. */
  faces: readonly TrayFace[];
  /** Groups with someone still to seat — "Lim family · 4". */
  groups: readonly TrayGroup[];
  /** Edit is held — without it the tray reads, and nothing on it lifts. */
  canEdit: boolean;
  /** The floor has at least one table. With none there is no chair to drag to, so the line says so (#7906 walker). */
  hasTables?: boolean;
  /** A tap on a face (no hold): the shipped "Move Tess to…". */
  onTapFace: (guestId: string) => void;
  /** "+6": the rest of the people still to seat. */
  onMore: () => void;
  onDrop: (item: TrayItem, at: FloorDrop) => void;
  /** Pan the floor by (dx, dy) screen px — positive = show more to the right / below. */
  onPan: (dx: number, dy: number) => void;
}) {
  const total = faces.length;
  const trayRef = useRef<HTMLDivElement>(null);
  /* ⬇ THE TRAY LEAVES ROOM FOR ITSELF (#7906 walker, 390x844: the tray covered Zoom in / Zoom out — elementFromPoint hit a
     face). It is drawn over the thumb row in the row's own fixed host, but only the row published `--sn-thumb-room`, so
     the zoom stack (which stands on that token) sat under the tray. The ONE mechanism (`lib/thumb-room.ts`) takes the
     largest room, so the tray's own reading — from its top to the host's foot — lifts the zoom stack above it.
     🔒 the-seat-tray-never-covers-the-zoom.test.ts */
  useThumbRoom(trayRef);
  /* ↔ How many faces fit on the row — MEASURED (a face's own width and the row's gap), never a typed count; the last
     slot goes to "+N" when some are left over. Before the first measure (and on the server) every face is drawn. */
  const rowRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(total);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const face = row.querySelector<HTMLElement>('[data-seat-tray-face]');
      if (!face) return;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const slots = Math.max(1, Math.floor((row.clientWidth + gap) / (face.offsetWidth + gap)));
      setFit(slots >= total ? total : Math.max(1, slots - 1));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [total]);
  const shown = faces.slice(0, fit);
  const more = total - shown.length;
  const pending = useRef<Pending | null>(null);
  const drag = useRef<Drag | null>(null);
  const lit = useRef<{ table: HTMLElement | null; chair: HTMLElement | null }>({ table: null, chair: null });
  const raf = useRef(0);
  const swallow = useRef(false);
  const [held, setHeld] = useState<TrayItem | null>(null);
  const cb = useRef({ onDrop, onPan });
  cb.current = { onDrop, onPan };

  const light = (table: HTMLElement | null, chair: HTMLElement | null) => {
    const l = lit.current;
    if (l.table !== table) {
      if (l.table) delete l.table.dataset[TABLE_OVER];
      if (table) table.dataset[TABLE_OVER] = '';
    }
    if (l.chair !== chair) {
      if (l.chair) delete l.chair.dataset[CHAIR_OVER];
      if (chair) chair.dataset[CHAIR_OVER] = '';
    }
    lit.current = { table, chair };
  };
  const hit = (d: Drag) => {
    const at = landingAt(d.x, d.y, d.item);
    light(at?.table ?? null, at?.chair ?? null);
  };
  const loop = () => {
    const d = drag.current;
    if (!d) return;
    const floor = document.querySelector<HTMLElement>('[data-plan-floor]');
    if (floor) {
      const r = floor.getBoundingClientRect();
      /* What of the floor shows: in Guests it runs under the pinned row at its top (`--gs-stick-h`) and under the tray
         and the thumb row at its foot. */
      const stick = parseFloat(getComputedStyle(floor).getPropertyValue('--gs-stick-h')) || 0;
      const head = Math.max(r.top, stick);
      const foot = Math.min(r.bottom, trayRef.current?.getBoundingClientRect().top ?? r.bottom, window.innerHeight);
      const inside = d.x > r.left && d.x < r.right && d.y > head && d.y < foot;
      /* The finger rises from the tray INTO the floor — the floor pans only once it has been well inside, so the climb
         past its foot is not a pan. */
      if (!d.armed && inside && dragEdgeStep(d.y, { top: head, bottom: foot }) === 0) d.armed = true;
      if (d.armed) {
        const reach = { pastTop: 0, pastBottom: 0 };
        const vx = dragEdgeStep(d.x, { top: r.left, bottom: r.right }, reach);
        const vy = dragEdgeStep(d.y, { top: head, bottom: foot }, reach);
        if (vx || vy) {
          cb.current.onPan(vx, vy);
          hit(d);
        }
      }
    }
    raf.current = requestAnimationFrame(loop);
  };
  const stop = () => {
    const p = pending.current;
    if (p?.timer) clearTimeout(p.timer);
    pending.current = null;
    cancelAnimationFrame(raf.current);
    window.removeEventListener('pointermove', moveL);
    window.removeEventListener('pointerup', upL);
    window.removeEventListener('pointercancel', cancelL);
  };
  const lift = (x: number, y: number) => {
    const p = pending.current;
    if (!p || drag.current) return;
    const ghost = document.createElement('div');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.dataset.seatTrayGhost = '';
    const face = p.el.querySelector('[data-tray-face-disc]')?.cloneNode(true) as HTMLElement | undefined;
    if (face) ghost.appendChild(face);
    const name = document.createElement('b');
    name.textContent = p.item.name;
    ghost.appendChild(name);
    ghost.className =
      'pointer-events-none inline-flex max-w-[16rem] items-center gap-2 rounded-full bg-cream py-1.5 pl-1.5 pr-3.5 text-sm text-ink shadow-[0_14px_30px_rgb(var(--color-ink)/0.28)]';
    /* Where it is drawn is the finger's (its transform), from the screen's corner — the List ghost's own way. */
    Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', zIndex: '9999', willChange: 'transform' });
    document.body.appendChild(ghost);
    drag.current = { item: p.item, ghost, x, y, armed: false };
    place(drag.current);
    setHeld(p.item);
    try {
      navigator.vibrate?.(10);
    } catch {
      /* no haptics here */
    }
    raf.current = requestAnimationFrame(loop);
  };
  /* The ghost rides just above the finger (it would hide the chair under it), tilted as drawn. */
  const place = (d: Drag) => {
    d.ghost.style.transform = `translate(${d.x - 22}px,${d.y - 64}px) rotate(-3deg) scale(1.02)`;
  };
  const end = (drop: boolean) => {
    const d = drag.current;
    stop();
    drag.current = null;
    const { table, chair } = lit.current;
    light(null, null);
    /* Let go before the hold: a tap — the face's own click (the shipped "Move … to…") answers it. */
    if (!d) return;
    d.ghost.remove();
    setHeld(null);
    swallow.current = true;
    setTimeout(() => (swallow.current = false), 0);
    if (!drop || !table?.dataset.planTable) return;
    const seat = chair?.dataset.planChair !== undefined ? Number(chair.dataset.planChair) : null;
    cb.current.onDrop(d.item, { tableId: table.dataset.planTable, seat: seat !== null && Number.isInteger(seat) ? seat : null });
  };
  const onMove = (e: PointerEvent) => {
    const p = pending.current;
    if (!p || e.pointerId !== p.pid) return;
    if (!drag.current) {
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (p.touch) {
        // Moving before the hold ends is not a pick-up — let go of it.
        if (moved > TAP_SLOP_TOUCH) stop();
        return;
      }
      if (moved > TAP_SLOP_MOUSE) lift(e.clientX, e.clientY);
      if (!drag.current) return;
    }
    e.preventDefault();
    const d = drag.current;
    d.x = e.clientX;
    d.y = e.clientY;
    place(d);
    hit(d);
  };
  const handlers = useRef({ onMove, end });
  handlers.current = { onMove, end };
  const moveL = useCallback((e: PointerEvent) => handlers.current.onMove(e), []);
  const upL = useCallback(() => handlers.current.end(true), []);
  const cancelL = useCallback(() => handlers.current.end(false), []);

  const press = (item: TrayItem) => (e: ReactPointerEvent<HTMLElement>) => {
    // Without Edit nothing lifts; a tap still opens "Move … to…", which says Edit first.
    if (!canEdit || e.button !== 0 || drag.current || pending.current) return;
    const touch = e.pointerType !== 'mouse';
    pending.current = { item, el: e.currentTarget, x: e.clientX, y: e.clientY, touch, pid: e.pointerId, timer: null };
    if (touch) pending.current.timer = setTimeout(() => lift(e.clientX, e.clientY), SEAT_HOLD_MS);
    window.addEventListener('pointermove', moveL, { passive: false });
    window.addEventListener('pointerup', upL);
    window.addEventListener('pointercancel', cancelL);
  };
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      if (pending.current?.timer) clearTimeout(pending.current.timer);
      pending.current = null;
      drag.current?.ghost.remove();
      drag.current = null;
      const l = lit.current;
      if (l.table) delete l.table.dataset[TABLE_OVER];
      if (l.chair) delete l.chair.dataset[CHAIR_OVER];
      window.removeEventListener('pointermove', moveL);
      window.removeEventListener('pointerup', upL);
      window.removeEventListener('pointercancel', cancelL);
    },
    [moveL, upL, cancelL],
  );

  if (total === 0 && groups.length === 0) return null;
  return (
    <div ref={trayRef} data-seat-tray={held ? 'held' : ''} className="flex flex-col gap-2">
      {held ? (
        <div data-seat-tray-held="" className="flex min-h-11 items-center gap-2 rounded-3xl bg-ink py-1 pl-4 pr-1 text-sm text-cream">
          {/* ✂ A guest's name wraps, never cut (owner v15). */}
          <span className="min-w-0 flex-1 py-1 leading-snug">
            <b className="block [overflow-wrap:anywhere]">Seating {held.name}</b>
            <span className="block text-[13px] text-cream/75">drop on a chair or a table</span>
          </span>
          {/* A second finger lands on Cancel while the first still holds the face — so the PRESS cancels (no click comes). */}
          <span
            className="inline-flex shrink-0"
            onPointerDownCapture={(e) => {
              e.stopPropagation();
              handlers.current.end(false);
            }}
          >
            <ActionButton tone="neutral" icon={X} label="Cancel" data-seat-tray-cancel="" />
          </span>
        </div>
      ) : null}
      <div className="sn-frame px-3.5 py-3">
        <p className="flex items-baseline gap-2">
          <b className="shrink-0 text-[13.5px] font-semibold text-ink">To seat · {formatCount(total)}</b>
          <small className="min-w-0 text-xs text-ink/70" data-seat-tray-hint="">
            {!canEdit
              ? 'Tap Edit first to seat them.'
              : hasTables
                ? 'Press and hold a face, then drag it to a chair. Or tap · move.'
                : 'No tables yet — Build my seating draft, or Add your first table.'}
          </small>
        </p>
        <div ref={rowRef} className="mt-2 flex flex-wrap items-center gap-2" style={NO_CALLOUT}>
          {shown.map((f) => {
            const item: TrayItem = { kind: 'guest', id: f.id, name: f.name };
            const lifted = held?.kind === 'guest' && held.id === f.id;
            return (
              <button
                key={f.id}
                type="button"
                data-seat-tray-face={f.id}
                aria-label={`${f.name} — press and hold to drag to a seat, or tap to move`}
                onPointerDown={press(item)}
                onClick={() => {
                  /* A tap (or Enter): "Move … to…" — never the click a drag ends with. */
                  if (!swallow.current) onTapFace(f.id);
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`sn-press touch-none select-none rounded-full ${lifted ? 'opacity-30 outline-dashed outline-2 outline-ink/50' : ''}`}
              >
                <span
                  data-tray-face-disc=""
                  className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-ink text-[13px] font-bold text-cream"
                >
                  {f.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google), as the seat rows' own
                    <img src={f.photo} alt="" width={44} height={44} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    f.initials
                  )}
                </span>
              </button>
            );
          })}
          {more > 0 ? (
            <ActionButton
              tone="neutral"
              icon={UsersRound}
              label={`+${formatCount(more)}`}
              name={`${formatCount(more)} more to seat — open the list`}
              onClick={onMore}
              data-seat-tray-more=""
            />
          ) : null}
          {groups.map((g) => {
            const lifted = held?.kind === 'group' && held.id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                data-seat-tray-group={g.id}
                aria-label={`${g.label}, ${formatCount(g.count)} to seat — press and hold to drag the group to a table`}
                onPointerDown={press({ kind: 'group', id: g.id, name: g.label })}
                onContextMenu={(e) => e.preventDefault()}
                className={`sn-press inline-flex min-h-11 touch-none select-none items-center gap-1.5 rounded-full bg-terracotta/10 px-3 text-[13px] font-bold text-terracotta-800 ${lifted ? 'opacity-30' : ''}`}
              >
                <span data-tray-face-disc="" className="inline-flex">
                  <UsersRound aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                </span>
                {g.label} · {formatCount(g.count)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** No text selection or iOS callout while a finger holds a face. */
const NO_CALLOUT = { WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as CSSProperties;
