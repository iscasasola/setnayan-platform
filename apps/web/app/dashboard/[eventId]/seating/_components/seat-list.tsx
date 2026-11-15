'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowLeftRight, Armchair, ChevronDown, UserMinus, UserRound } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { useRowState } from '@/app/dashboard/[eventId]/guests/_components/use-row-state';
import { dragBandOf, dragEdgeStep, dragScrollBy, dragScrollerOf } from '@/lib/drag-edge-scroll';
import { TAP_SLOP_MOUSE, TAP_SLOP_TOUCH } from '@/lib/march-drag';
import { readSeatDrop, seatDropAttrs, seatTallyWords, type SeatDropTarget } from '@/lib/seat-list-drop';
import { formatCount } from '@/lib/format-number';
import { VipMark } from './vip-mark';

/**
 * 🪑 GUESTS › SEATS › LIST IS THE GUESTS LIST, GROUPED BY TABLE (Seats S1c, owner 2026-11-01, DECISION_LOG "SEATS STAYS
 * ITS OWN DOOR, BUT LOOKS AND WORKS LIKE THE GUESTS LIST" · "SEATS 2D IS THE ROOM, LIST IS THE PEOPLE" · "SEATS: WHAT EACH
 * VIEW DOES"). Replaces the 2026-10-29 row of faces.
 *
 * THE SAME ROWS AND HEADERS AS GUESTS › LIST — drawn with the Guest list's OWN stylesheet (`guests-screen.module.css`,
 * imported, never copied, the People page's precedent) and the shared `ActionButton`:
 *   · a header per table: the house foldable header (`.sn-acc-head` + `.sn-acc-chip`) · "TABLE 5 · 8 of 10 seats" · ⌄.
 *     Open = PICKED (Guests' own rule, 2026-11-01 "Edit icon only shows when the group is picked and highlighted"): only
 *     the open table wears the ✎ (`headTools`), and under it its Type ▾ and seats − N + (`tableTools`).
 *   · a row per seat: face · name (side dot) · "Seat 4 · placed by you" · Swap · Remove. An empty seat is a row too —
 *     "Seat 7 · empty" with its Add ▾ (who comes and has no seat yet). "To seat" leads, with the coming guests.
 *
 * MOVING SOMEONE — two ways, one answer (`lib/seat-list-drop.ts › planSeatDrop`):
 *   · press and hold a guest (a mouse: press and move), drag, let go on a seat — the list scrolls by itself near its
 *     top or bottom edge (THE shared edge scroll, `lib/drag-edge-scroll.ts`);
 *   · "tap · move": Swap (or Seat) picks them up; the next seat tapped is theirs.
 * Presentational: every write is the seat plan's own (the editor hands in its handlers), so nothing new saves.
 */

export type SeatListGuest = {
  id: string;
  name: string;
  initials: string;
  photo: string | null;
  side: 'bride' | 'groom' | 'both';
  /** Who placed the seat, spoken with it ("placed by you", lib/seat-why.ts); absent = not recorded. */
  placed?: string | null;
};
export type SeatListSeat = { tableId: string; seat: number; guest: SeatListGuest | null };
export type SeatListUnit = { key: string; label: string; seated: number; capacity: number; seats: SeatListSeat[]; vip?: boolean };

const HOLD_MS = 300;
/** Where a held guest would land — lit while the finger is over it (set straight on the DOM, no re-render). */
const OVER =
  'data-[seat-drop-over]:rounded-xl data-[seat-drop-over]:bg-terracotta/10 data-[seat-drop-over]:outline data-[seat-drop-over]:outline-2 data-[seat-drop-over]:outline-terracotta';
const UNSEATED = 'unseated';

type Pending = { id: string; el: HTMLElement; x: number; y: number; touch: boolean; pid: number; timer: ReturnType<typeof setTimeout> | null };
type Drag = { id: string; ghost: HTMLElement; ox: number; oy: number; x: number; y: number; scroller: HTMLElement };

function sideClass(side: SeatListGuest['side']): string {
  return side === 'bride' ? gs.sideBride ?? '' : side === 'groom' ? gs.sideGroom ?? '' : gs.sideBoth ?? '';
}

function Head({
  sectionKey,
  open,
  label,
  tally,
  icon,
  onToggle,
  trailing,
  vip = false,
}: {
  sectionKey: string;
  open: boolean;
  label: string;
  /** 🪑 A VIP table carries the small VIP mark (owner 2026-11-02). */
  vip?: boolean;
  tally: string;
  icon: 'table' | 'people';
  onToggle: () => void;
  /** ✎ — drawn by the caller only on the picked (open) table. */
  trailing?: ReactNode;
}) {
  return (
    <div className={`${gs.barWrap} sn-acc-head`} data-open={open ? '' : undefined} data-seat-head={sectionKey}>
      <button type="button" className={gs.bar} aria-expanded={open} onClick={onToggle} data-section-head="">
        <span className={`${gs.ico} sn-acc-chip`} aria-hidden>
          {icon === 'table' ? <Armchair strokeWidth={1.9} /> : <UserRound strokeWidth={1.9} />}
        </span>
        {/* ✂ A table's name WRAPS, never cut (owner v15 — names are never ellipsized; up to three lines). */}
        <span className={`${gs.lab} line-clamp-3 !whitespace-normal [overflow-wrap:anywhere]`}>{label}</span>
        {vip ? <VipMark /> : null}
        <span className={gs.n} data-seat-tally="">
          · {tally}
        </span>
        <ChevronDown className={gs.chev} style={{ flex: '0 0 auto' }} aria-hidden strokeWidth={1.9} width={18} height={18} />
      </button>
      {trailing}
    </div>
  );
}

export function SeatList({
  units,
  unseated,
  pickedId,
  canEdit,
  open,
  onToggle,
  onOpenGuest,
  onPick,
  onRemove,
  onSeatHere,
  addMenu,
  headTools,
  renaming,
  tableTools,
  onDrop,
  dim = () => false,
}: {
  units: SeatListUnit[];
  /** The coming guests with no seat. */
  unseated: SeatListGuest[];
  /** The guest being moved by "tap · move" — the next seat tapped is theirs. */
  pickedId: string | null;
  /** Edit is held (the seat plan's lock) — without it the list reads, and nothing on it moves anyone. */
  canEdit: boolean;
  /** The open (picked) headers — held by the editor, so the thumb row's ⇕ opens or folds them all. */
  open: ReadonlySet<string>;
  onToggle: (key: string) => void;
  /** Tap a guest: their guest card (edit there) — or, while someone else is picked, the two trade (the editor's `tapFace`). */
  onOpenGuest: (guestId: string) => void;
  /** Swap / Seat: pick them up ("tap · move"). */
  onPick: (guestId: string) => void;
  /** Remove: their seat goes, they go back to "To seat". */
  onRemove: (guestId: string) => void;
  /** An empty seat tapped while someone is picked: they sit here. */
  onSeatHere: (tableId: string, seat: number) => void;
  /** An empty seat's Add ▾ (who comes and has no seat) — the shared dropdown, drawn by the editor. */
  addMenu: (tableId: string, seat: number) => ReactNode;
  /** ✎ on the picked table's header (null = none for this table). */
  headTools: (key: string) => ReactNode;
  /** The table's name box while it is being renamed (null = not renaming) — drawn under its header, which stays. */
  renaming: (key: string) => ReactNode;
  /** Type ▾ · seats − N + — under the picked table's header. */
  tableTools: (key: string) => ReactNode;
  /** A guest let go on a seat (or on "To seat"). */
  onDrop: (guestId: string, target: SeatDropTarget) => void;
  /** ⇅ A guest the shared Show or the search leaves out — drawn faint, their seat still taken. */
  dim?: (guestId: string) => boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  /* ⇔ ONE state for every row's buttons (Swap · Remove), the Guests list's own fit (BUTTON_RULE 3a). */
  useRowState(listRef, [units, unseated, open, canEdit, pickedId]);

  /* ── the drag (press · hold · drag · let go) ─────────────────────────────────────────────────────────────────── */
  const pending = useRef<Pending | null>(null);
  const drag = useRef<Drag | null>(null);
  const over = useRef<HTMLElement | null>(null);
  const raf = useRef(0);
  const swallow = useRef(false);
  const [lifted, setLifted] = useState<string | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const mark = (el: HTMLElement | null) => {
    if (over.current === el) return;
    over.current?.removeAttribute('data-seat-drop-over');
    over.current = el;
    el?.setAttribute('data-seat-drop-over', '');
  };
  const hit = (d: Drag) => {
    const el = document.elementFromPoint(d.x, d.y) as HTMLElement | null;
    const zone = el?.closest<HTMLElement>('[data-seat-drop]') ?? null;
    mark(zone && listRef.current?.contains(zone) ? zone : null);
  };
  const loop = () => {
    const d = drag.current;
    if (!d) return;
    /* ✋ Near the list's edge it scrolls by itself, faster the nearer — THE shared edge scroll (owner 2026-11-01). */
    const v = dragEdgeStep(d.y, dragBandOf(d.scroller));
    if (v) {
      dragScrollBy(d.scroller, v);
      hit(d);
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
    const r = p.el.getBoundingClientRect();
    const ghost = p.el.cloneNode(true) as HTMLElement;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.removeAttribute('data-seat-drop');
    ghost.dataset.seatGhost = '';
    Object.assign(ghost.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${r.width}px`,
      margin: '0',
      zIndex: '9999',
      pointerEvents: 'none',
      background: 'var(--gs-paper, rgb(var(--color-cream)))',
      borderRadius: 'var(--m-r-md)',
      boxShadow: '0 18px 34px -14px rgb(var(--color-ink) / .55)',
      transform: `translate(${r.left}px,${r.top}px) scale(1.02)`,
      willChange: 'transform',
    });
    (listRef.current?.closest('[data-guests-screen]') ?? document.body).appendChild(ghost);
    drag.current = { id: p.id, ghost, ox: x - r.left, oy: y - r.top, x, y, scroller: dragScrollerOf(p.el) };
    ghost.style.transform = `translate(${x - drag.current.ox}px,${y - drag.current.oy}px) scale(1.02)`;
    setLifted(p.id);
    try {
      navigator.vibrate?.(10);
    } catch {
      /* no haptics here */
    }
    raf.current = requestAnimationFrame(loop);
  };
  const end = (drop: boolean) => {
    const d = drag.current;
    stop();
    drag.current = null;
    const zone = over.current;
    mark(null);
    if (!d) return;
    d.ghost.remove();
    setLifted(null);
    // The click a lift ends with is not a tap on the row under it.
    swallow.current = true;
    setTimeout(() => (swallow.current = false), 0);
    const target = drop && zone ? readSeatDrop(zone.dataset) : null;
    if (target) onDropRef.current(d.id, target);
  };
  const onMove = (e: PointerEvent) => {
    const p = pending.current;
    if (!p || e.pointerId !== p.pid) return;
    if (!drag.current) {
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (p.touch) {
        // Moving before the hold ends is a scroll — let it be one.
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
    d.ghost.style.transform = `translate(${d.x - d.ox}px,${d.y - d.oy}px) scale(1.02)`;
    hit(d);
  };
  /* The window listeners are stable functions that call the latest handlers. */
  const handlers = useRef({ onMove, end });
  handlers.current = { onMove, end };
  const moveL = useCallback((e: PointerEvent) => handlers.current.onMove(e), []);
  const upL = useCallback(() => handlers.current.end(true), []);
  const cancelL = useCallback(() => handlers.current.end(false), []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canEdit || e.button !== 0 || drag.current || pending.current) return;
    const t = e.target as HTMLElement;
    // A row's own buttons (Swap · Remove · Add ▾) are pressed, never dragged.
    if (t.closest('[data-row-acts]')) return;
    const el = t.closest<HTMLElement>('[data-seat-drag]');
    if (!el) return;
    const id = el.dataset.seatDrag!;
    const touch = e.pointerType !== 'mouse';
    pending.current = { id, el, x: e.clientX, y: e.clientY, touch, pid: e.pointerId, timer: null };
    if (touch) pending.current.timer = setTimeout(() => lift(e.clientX, e.clientY), HOLD_MS);
    window.addEventListener('pointermove', moveL, { passive: false });
    window.addEventListener('pointerup', upL);
    window.addEventListener('pointercancel', cancelL);
  };
  /* 📱 While a guest is lifted the list must not scroll under the finger (its edges scroll it instead). On the list
     from the start — a browser decides at touchstart whether anything may block its scroll. */
  useEffect(() => {
    const box = listRef.current;
    const block = (e: TouchEvent) => {
      if (drag.current) e.preventDefault();
    };
    box?.addEventListener('touchmove', block, { passive: false });
    return () => {
      box?.removeEventListener('touchmove', block);
      cancelAnimationFrame(raf.current);
      if (pending.current?.timer) clearTimeout(pending.current.timer);
      pending.current = null;
      drag.current?.ghost.remove();
      drag.current = null;
      window.removeEventListener('pointermove', moveL);
      window.removeEventListener('pointerup', upL);
      window.removeEventListener('pointercancel', cancelL);
    };
  }, [moveL, upL, cancelL]);

  const tap = (fn: () => void) => () => {
    if (swallow.current) return;
    fn();
  };

  /* ── a row ─────────────────────────────────────────────────────────────────────────────────────────────────── */
  const guestRow = (g: SeatListGuest, where: { tableId: string; seat: number; table: string } | null) => {
    const picked = pickedId === g.id;
    const meta = where ? `Seat ${formatCount(where.seat + 1)}${g.placed ? ` · ${g.placed}` : ''}` : 'No seat yet';
    const drop = where ? seatDropAttrs({ kind: 'seat', tableId: where.tableId, seat: where.seat, occupantId: g.id }) : {};
    const open = tap(() => onOpenGuest(g.id));
    const key = where ? `${where.tableId}:${where.seat}` : `u:${g.id}`;
    const row = (
      <div
        key={key}
        className={`${gs.g} ${picked ? gs.picked : ''} ${OVER}`}
        data-seat-row=""
        data-seat-guest={g.id}
        data-seat-drag={canEdit ? g.id : undefined}
        data-seat-dim={dim(g.id) ? '' : undefined}
        data-seat-lifted={lifted === g.id ? '' : undefined}
        style={ROW_STYLE(dim(g.id) || lifted === g.id)}
        {...drop}
      >
        <button
          type="button"
          className={gs.ava}
          onClick={open}
          aria-label={`${g.name}, ${where ? `${where.table}, seat ${where.seat + 1}` : 'no seat yet'}${g.placed ? `, ${g.placed}` : ''}`}
          aria-pressed={picked}
        >
          {g.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google), as the Guests row's own
            <img src={g.photo} alt="" width={40} height={40} loading="lazy" />
          ) : (
            g.initials
          )}
        </button>
        <button type="button" className={gs.who} onClick={open} data-row-name="">
          <div className={gs.nm}>
            <span aria-hidden className={`${gs.dot} ${sideClass(g.side)}`} />
            <span className={gs.nmt}>{g.name}</span>
          </div>
          <div className={gs.meta}>{picked ? 'Moving — tap a seat' : meta}</div>
        </button>
        {canEdit ? (
          <span className={gs.acts} data-fit-row="" data-row-acts="">
            <ActionButton
              tone="neutral"
              icon={where ? ArrowLeftRight : Armchair}
              label={where ? 'Swap' : 'Seat'}
              name={`${where ? 'Swap' : 'Seat'} ${g.name}`}
              onClick={() => onPick(g.id)}
              data-testid="seat-row-pick"
            />
          </span>
        ) : null}
      </div>
    );
    /* 👈 OFF THE SEAT IS THE ROW'S SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
       VISIBLE ✕ ON ROWS"): the row's red Remove left; a left swipe (a computer: the hover button at the row's end) is
       the same `onRemove` → the editor's `unseat`, whose toast carries the Undo that puts them back on the same chair.
       A press-and-hold still lifts the row to drag (the swipe lets go of a finger held still, SWIPE_HOLD_MS). */
    if (!canEdit || !where) return row;
    return (
      <SwipeToDelete
        key={key}
        label={`Remove ${g.name} from the seat`}
        word="Remove"
        icon={UserMinus}
        radiusClass=""
        surfaceClass="bg-[var(--gs-paper,rgb(var(--color-cream)))]"
        onDelete={(close) => {
          close();
          onRemove(g.id);
        }}
      >
        {row}
      </SwipeToDelete>
    );
  };
  const emptyRow = (s: SeatListSeat, table: string) => (
    <div
      key={`${s.tableId}:${s.seat}`}
      className={`${gs.g} ${OVER}`}
      data-seat-row=""
      data-seat-empty=""
      {...seatDropAttrs({ kind: 'seat', tableId: s.tableId, seat: s.seat, occupantId: null })}
    >
      <button
        type="button"
        className={gs.ava}
        aria-label={pickedId ? `Seat here — ${table}, seat ${s.seat + 1}` : `${table}, empty seat ${s.seat + 1}`}
        onClick={tap(() => (pickedId ? onSeatHere(s.tableId, s.seat) : undefined))}
        style={{ ['--disc' as string]: 'transparent', outline: '1.5px dashed var(--gs-line)', outlineOffset: '-4px', borderRadius: '50%' } as CSSProperties}
      >
        <Armchair strokeWidth={1.6} />
      </button>
      <button type="button" className={gs.who} onClick={tap(() => (pickedId ? onSeatHere(s.tableId, s.seat) : undefined))} tabIndex={-1}>
        <div className={gs.nm}>
          <span className={gs.nmt}>Seat {formatCount(s.seat + 1)}</span>
        </div>
        <div className={gs.meta}>{pickedId ? 'Tap to seat them here' : 'Empty'}</div>
      </button>
      {canEdit && !pickedId ? (
        <span className={gs.acts} data-fit-row="" data-row-acts="">
          {addMenu(s.tableId, s.seat)}
        </span>
      ) : null}
    </div>
  );

  return (
    <div
      ref={listRef}
      data-seat-list=""
      onPointerDown={onPointerDown}
      className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-28"
      /* 📌 An open table's header sticks at the top of THIS list's own box (it scrolls inside one, under the pinned row),
         so the Guest list's sticky offset is 0 here. */
      style={{ ['--gs-top' as string]: '0px', ['--gs-stick-h' as string]: '0px' } as CSSProperties}
    >
      {unseated.length > 0 ? (
        <section
          className={`${gs.sec} ${gs.accSec} ${open.has(UNSEATED) ? gs.open : ''} ${OVER}`}
          data-seat-section={UNSEATED}
          data-open={open.has(UNSEATED) ? 'true' : 'false'}
          {...seatDropAttrs({ kind: 'unseated' })}
        >
          <Head sectionKey={UNSEATED} open={open.has(UNSEATED)} label="To seat" tally={formatCount(unseated.length)} icon="people" onToggle={() => onToggle(UNSEATED)} />
          <div className={gs.fold}>
            <div>{open.has(UNSEATED) ? unseated.map((g) => guestRow(g, null)) : null}</div>
          </div>
        </section>
      ) : null}
      {units.length === 0 ? (
        <p className={gs.empty} data-seat-list-empty="">
          No tables yet — add one with ＋ Add › New table.
        </p>
      ) : null}
      {units.map((u) => {
        const isOpen = open.has(u.key);
        const box = renaming(u.key);
        return (
          <section key={u.key} className={`${gs.sec} ${gs.accSec} ${isOpen ? gs.open : ''}`} data-seat-section={u.key} data-open={isOpen ? 'true' : 'false'}>
            <Head
              sectionKey={u.key}
              open={isOpen}
              label={u.label}
              vip={u.vip === true}
              tally={seatTallyWords(u.seated, u.capacity, formatCount)}
              icon="table"
              onToggle={() => onToggle(u.key)}
              trailing={isOpen ? headTools(u.key) : null}
            />
            <div className={gs.fold}>
              <div>
                {isOpen ? (
                  <>
                    {box}
                    <div className="flex min-w-0 flex-wrap items-center gap-2 py-2" data-seat-table-tools={u.key}>
                      {tableTools(u.key)}
                    </div>
                    {u.seats.map((s) => (s.guest ? guestRow(s.guest, { tableId: s.tableId, seat: s.seat, table: u.label }) : emptyRow(s, u.label)))}
                  </>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** A row the search / Show leaves out, or the one being dragged: faint, still in its place. No text selection or iOS
 *  callout while a finger holds it. */
function ROW_STYLE(faint: boolean): CSSProperties {
  return { opacity: faint ? 0.3 : undefined, WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as CSSProperties;
}

export { UNSEATED as SEAT_LIST_UNSEATED };
