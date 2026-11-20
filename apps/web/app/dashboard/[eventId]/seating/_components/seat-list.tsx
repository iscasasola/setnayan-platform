'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowLeftRight, Armchair, Check, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { useRowState } from '@/app/dashboard/[eventId]/guests/_components/use-row-state';
import { dragBandOf, dragEdgeStep, dragScrollBy, dragScrollerOf } from '@/lib/drag-edge-scroll';
import { TAP_SLOP_MOUSE, TAP_SLOP_TOUCH } from '@/lib/march-drag';
import { SEAT_HOLD_MS, readSeatDrop, seatDropAttrs, type SeatDropTarget } from '@/lib/seat-list-drop';
import { formatCount } from '@/lib/format-number';
import { VipMark } from './vip-mark';
import { dropGhost, ghostAt, liftGhost } from '@/lib/lift';

/**
 * 🪑 GUESTS › SEATS › LIST — EVERY TABLE IS A CARD (Guests redesign § 4, owner 20 Nov 2026: round-one pick 5 *"Seats ›
 * List = every table as a card"*, then *"Yes, build it"*; drawing `prototypes/guests_redesign_2026-11-20`). Replaces the
 * 2026-11-01 list of foldable table headers with one row per seat.
 *
 *   · the counts are WORDS: a big "34 seated ⓘ", then "0 to seat · 9 tables · 43 empty chairs" — counted here from the
 *     units the plan hands in, never typed; no sofa / person / target icons;
 *   · "To seat" is the first block, only while anyone coming has no seat: their faces, each one held and dropped on a
 *     table (the shipped press · hold · drag, `lib/seat-list-drop.ts › planSeatDrop`) — it takes the next free seat;
 *   · a table is a CARD: its name (VIP mark) · "7 of 10" (a green tick when full) · the faces · dotted empty chairs,
 *     capped, then "+5 empty";
 *   · a card tapped RISES FULL SCREEN (the house `Sheet`, `full`): its people first — face · name · "Seat 4 · placed by
 *     you" · a Move button WITH its word (the shipped "tap · move" pick-up; a left swipe is still Remove) — then ONE
 *     row for all its empty seats ("6 empty seats · Seats 5 to 10 · Add a guest"), never a row each. "Add a guest"
 *     lists who is still to seat and STAYS OPEN, so names are tapped one after another (round-two pick 5); each takes
 *     the next free seat. While someone is being moved the empty seats are numbered buttons, so Move picks an exact one;
 *   · "This table" sits at the bottom of the opened table, in the thumb zone: the plan's own Shape ▾ · Seats − N + ·
 *     VIP ▾ (`tableTools`, re-seated, never rebuilt) and Rename (the plan's own ✎, `headTools` → `renaming`) · Done.
 *
 * Presentational: every write is the seat plan's own (the editor hands in its handlers), so nothing new saves.
 * 🔒 seats-list-is-table-cards.test.ts
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

const HOLD_MS = SEAT_HOLD_MS;
/** Where a held guest would land — lit while the finger is over it (set straight on the DOM, no re-render). */
const OVER =
  'data-[seat-drop-over]:rounded-xl data-[seat-drop-over]:bg-terracotta/10 data-[seat-drop-over]:outline data-[seat-drop-over]:outline-2 data-[seat-drop-over]:outline-terracotta';
const UNSEATED = 'unseated';

type Pending = { id: string; el: HTMLElement; x: number; y: number; touch: boolean; pid: number; timer: ReturnType<typeof setTimeout> | null };
type Drag = { id: string; ghost: HTMLElement; ox: number; oy: number; x: number; y: number; scroller: HTMLElement };

function sideClass(side: SeatListGuest['side']): string {
  return side === 'bride' ? gs.sideBride ?? '' : side === 'groom' ? gs.sideGroom ?? '' : gs.sideBoth ?? '';
}

/** How many circles (faces + dotted chairs) a card draws before it says the rest in words. */
export const SEAT_CARD_CIRCLES = 10;

/** What a table's card draws from its counts: faces, dotted chairs, and the words for what did not fit. Pure. */
export function seatCardCircles(seated: number, capacity: number): { faces: number; dots: number; more: string | null } {
  const empty = Math.max(0, capacity - seated);
  if (seated + empty <= SEAT_CARD_CIRCLES) return { faces: seated, dots: empty, more: null };
  const room = SEAT_CARD_CIRCLES - 1;
  const faces = Math.min(seated, room);
  const dots = Math.min(empty, room - faces);
  const words = [seated - faces > 0 ? `+${seated - faces} more` : null, empty - dots > 0 ? `+${empty - dots} empty` : null].filter(Boolean);
  return { faces, dots, more: words.length ? words.join(' · ') : null };
}

/** "Seats 5 to 10" · "Seat 7" · "Seats 2, 5 and 9" — the empty seats' own numbers (0-based in, spoken 1-based). Pure. */
export function emptySeatWords(seats: readonly number[]): string {
  const n = seats.map((x) => x + 1);
  if (n.length === 0) return '';
  if (n.length === 1) return `Seat ${n[0]}`;
  const run = n.every((x, i) => i === 0 || x === n[i - 1]! + 1);
  if (run) return `Seats ${n[0]} to ${n[n.length - 1]}`;
  return `Seats ${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

const FACE = 'flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/[0.07] text-[10.5px] font-semibold text-ink/80';
const CHAIR = 'h-7 w-7 shrink-0 rounded-full border-[1.5px] border-dashed border-ink/20';

function Face({ g, faint }: { g: SeatListGuest; faint: boolean }) {
  return (
    <span className={FACE} data-seat-guest={g.id} data-seat-dim={faint ? '' : undefined} style={faint ? { opacity: 0.3 } : undefined} title={g.name}>
      {g.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google), as the Guests row's own
        <img src={g.photo} alt="" width={28} height={28} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        g.initials
      )}
    </span>
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
  initialOpenKey = null,
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
  /** The table whose card starts opened (a guard's render; the plan opens none). */
  initialOpenKey?: string | null;
}) {
  /* 🪑 The table whose card has risen full screen (null = the cards), and whether its "Add a guest" list is open. */
  const [openKey, setOpenKey] = useState<string | null>(initialOpenKey);
  const [adding, setAdding] = useState(false);
  const sheetTitleId = useId();
  const renameHolder = useRef<HTMLSpanElement>(null);
  const openUnit = openKey ? units.find((u) => u.key === openKey) ?? null : null;
  const openTable = (key: string) => {
    setAdding(false);
    setOpenKey(key);
  };
  const listRef = useRef<HTMLDivElement>(null);
  /* ⇔ ONE state for every row's buttons (Swap · Remove), the Guests list's own fit (BUTTON_RULE 3a). */
  useRowState(listRef, [units, unseated, open, canEdit, pickedId, openKey]);

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
      // THE ONE LIFT (MOTION_STANDARD § 4 #15): the translate only — the size and the shadow are `.sn-m-lift`'s.
      transform: ghostAt(r.left, r.top),
      willChange: 'transform',
    });
    liftGhost(ghost);
    (listRef.current?.closest('[data-guests-screen]') ?? document.body).appendChild(ghost);
    drag.current = { id: p.id, ghost, ox: x - r.left, oy: y - r.top, x, y, scroller: dragScrollerOf(p.el) };
    ghost.style.transform = ghostAt(x - drag.current.ox, y - drag.current.oy);
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
    void dropGhost(d.ghost);
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
    d.ghost.style.transform = ghostAt(d.x - d.ox, d.y - d.oy);
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
    // A row's own buttons are pressed, never dragged.
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

  const everyone = [...unseated, ...units.flatMap((u) => u.seats.flatMap((x) => (x.guest ? [x.guest] : [])))];
  const moving = pickedId ? everyone.find((g) => g.id === pickedId) ?? null : null;

  /* ── a person at the opened table ──────────────────────────────────────────────────────────────────────────── */
  const guestRow = (g: SeatListGuest, where: { tableId: string; seat: number; table: string }) => {
    const picked = pickedId === g.id;
    const meta = `Seat ${formatCount(where.seat + 1)}${g.placed ? ` · ${g.placed}` : ''}`;
    const openCard = tap(() => onOpenGuest(g.id));
    const key = `${where.tableId}:${where.seat}`;
    const row = (
      <div
        key={key}
        className={`${gs.g} ${picked ? gs.picked : ''}`}
        data-seat-row=""
        data-seat-guest={g.id}
        data-seat-dim={dim(g.id) ? '' : undefined}
        style={ROW_STYLE(dim(g.id))}
      >
        <button
          type="button"
          className={gs.ava}
          onClick={openCard}
          aria-label={`${g.name}, ${where.table}, seat ${where.seat + 1}${g.placed ? `, ${g.placed}` : ''}`}
          aria-pressed={picked}
        >
          {g.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google), as the Guests row's own
            <img src={g.photo} alt="" width={40} height={40} loading="lazy" />
          ) : (
            g.initials
          )}
        </button>
        <button type="button" className={gs.who} onClick={openCard} data-row-name="">
          <div className={gs.nm}>
            <span aria-hidden className={`${gs.dot} ${sideClass(g.side)}`} />
            <span className={gs.nmt}>{g.name}</span>
          </div>
          <div className={gs.meta}>{picked ? 'Moving — tap a seat' : meta}</div>
        </button>
        {canEdit ? (
          <span className={gs.acts} data-row-acts="">
            {/* ⇄ MOVE, WITH ITS WORD (§ 4): the shipped "tap · move" pick-up — the next seat tapped is theirs. */}
            <ActionButton tone="neutral" icon={ArrowLeftRight} label="Move" name={`Move ${g.name}`} onClick={() => onPick(g.id)} data-testid="seat-row-pick" />
          </span>
        ) : null}
      </div>
    );
    /* 👈 OFF THE SEAT IS THE ROW'S SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
       VISIBLE ✕ ON ROWS"): a left swipe (a computer: the hover button at the row's end) is `onRemove` → the editor's
       `unseat`, whose toast carries the Undo that puts them back on the same chair. */
    if (!canEdit) return row;
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

  /* ── ONE row for a table's empty seats (§ 4: "6 empty seats · Add a guest" — not six rows) ───────────────────── */
  const emptySeatsRow = (u: SeatListUnit) => {
    const free = u.seats.filter((x) => !x.guest);
    if (free.length === 0) return null;
    const next = free[0]!;
    return (
      <div data-seat-empty-row="" data-seat-empty-count={free.length}>
        <div className={gs.g}>
          <span
            aria-hidden
            className={gs.ava}
            style={{ ['--disc' as string]: 'transparent', outline: '1.5px dashed var(--gs-line)', outlineOffset: '-4px', borderRadius: '50%' } as CSSProperties}
          />
          <div className={gs.who}>
            <div className={gs.nm}>
              <span className={gs.nmt}>
                {formatCount(free.length)} empty {free.length === 1 ? 'seat' : 'seats'}
              </span>
            </div>
            <div className={gs.meta}>{pickedId ? 'Tap a seat to seat them here' : emptySeatWords(free.map((x) => x.seat))}</div>
          </div>
          {canEdit && !pickedId ? (
            <span className={gs.acts} data-row-acts="">
              <ActionButton
                tone="neutral"
                icon={UserPlus}
                label="Add a guest"
                name={`Add a guest to ${u.label}`}
                caret
                aria-expanded={adding}
                onClick={() => setAdding((v) => !v)}
                data-testid="seat-table-add"
              />
            </span>
          ) : null}
        </div>
        {pickedId ? (
          /* ⇄ Someone is being moved: every empty seat is its own numbered button, so Move picks an EXACT seat. */
          <div className="flex min-w-0 flex-wrap gap-2 pb-2 pl-[52px]" data-seat-empty-picks="">
            {free.map((x) => (
              <ActionButton
                key={`${x.tableId}:${x.seat}`}
                tone="neutral"
                icon={Armchair}
                label={`Seat ${formatCount(x.seat + 1)}`}
                name={`Seat here — ${u.label}, seat ${x.seat + 1}`}
                onClick={() => onSeatHere(x.tableId, x.seat)}
                data-seat-here={String(x.seat)}
              />
            ))}
          </div>
        ) : null}
        {adding && canEdit && !pickedId ? (
          /* 👥 WHO IS STILL TO SEAT — the list STAYS OPEN (round-two pick 5): tap name after name; each takes the next
             free seat through the plan's own drop (`onDrop` → `planSeatDrop` → place, its ask and its Undo). */
          <div data-seat-add-list="" className="pb-2">
            <p className="px-1 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/60">To seat · {formatCount(unseated.length)}</p>
            {unseated.length === 0 ? (
              <p className={gs.empty} data-seat-add-none="">
                Everyone coming has a seat.
              </p>
            ) : (
              unseated.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="sn-press flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-1 py-1.5 text-left"
                  data-seat-add-guest={g.id}
                  aria-label={`Seat ${g.name} at ${u.label}, seat ${next.seat + 1}`}
                  onClick={() => onDrop(g.id, { kind: 'seat', tableId: next.tableId, seat: next.seat, occupantId: null })}
                >
                  <Face g={g} faint={false} />
                  <span className="min-w-0 flex-1 text-[15px] text-ink [overflow-wrap:anywhere]">{g.name}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    );
  };

  /* ── the counts, in words ──────────────────────────────────────────────────────────────────────────────────── */
  const seatedAll = units.reduce((n, u) => n + u.seated, 0);
  const emptyAll = units.reduce((n, u) => n + Math.max(0, u.capacity - u.seated), 0);

  /* ✎ Rename is the plan's own pencil (`headTools`), pressed for them by the worded button — its state stays the plan's. */
  const pencil = openUnit ? headTools(openUnit.key) : null;

  return (
    <div
      ref={listRef}
      data-seat-list=""
      data-seat-list-look="cards"
      onPointerDown={onPointerDown}
      className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-28"
      style={{ ['--gs-top' as string]: '0px', ['--gs-stick-h' as string]: '0px' } as CSSProperties}
    >
      <div className="px-1 pb-3 pt-2" data-seat-summary="">
        <InfoTip
          label="seated"
          labelNode={
            <>
              <b className="text-[28px] font-semibold leading-none text-ink" data-seat-summary-seated="">
                {formatCount(seatedAll)}
              </b>{' '}
              <span className="text-[15px] text-ink/70">seated</span>
            </>
          }
          align="start"
        >
          Guests who have a seat at a table. Tap a table to seat people or change it.
        </InfoTip>
        <p className="mt-1.5 text-[13.5px] text-ink/70" data-seat-summary-words="">
          <b className="font-semibold text-ink">{formatCount(unseated.length)}</b> to seat <span aria-hidden>·</span>{' '}
          <b className="font-semibold text-ink">{formatCount(units.length)}</b> {units.length === 1 ? 'table' : 'tables'} <span aria-hidden>·</span>{' '}
          <b className="font-semibold text-ink">{formatCount(emptyAll)}</b> empty {emptyAll === 1 ? 'chair' : 'chairs'}
        </p>
      </div>
      {unseated.length > 0 ? (
        /* 👥 "To seat" leads, only while anyone coming has no seat: hold a face and drop it on a table. Dropping a
           seated guest here takes their seat away (the shipped `unseated` drop). */
        <section className={`mb-3 rounded-2xl px-1 py-1 ${OVER}`} data-seat-section={UNSEATED} {...seatDropAttrs({ kind: 'unseated' })}>
          <p className="pb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/60" data-seat-head={UNSEATED}>
            To seat · {formatCount(unseated.length)}
          </p>
          <div className="flex min-w-0 flex-wrap gap-2">
            {unseated.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`sn-press flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-full bg-ink/[0.05] py-1 pl-1.5 pr-3 text-left ${pickedId === g.id ? 'ring-2 ring-terracotta' : ''}`}
                data-seat-row=""
                data-seat-unseated=""
                data-seat-drag={canEdit ? g.id : undefined}
                data-seat-lifted={lifted === g.id ? '' : undefined}
                style={ROW_STYLE(dim(g.id) || lifted === g.id)}
                aria-label={`${g.name}, no seat yet`}
                onClick={tap(() => onOpenGuest(g.id))}
              >
                <Face g={g} faint={false} />
                <span className="min-w-0 text-[14px] text-ink [overflow-wrap:anywhere]">{g.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {units.length === 0 ? (
        <p className={gs.empty} data-seat-list-empty="">
          No tables yet — add one with ＋ Add › New table.
        </p>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2.5" data-seat-cards="">
        {units.map((u) => {
          const people = u.seats.flatMap((x) => (x.guest ? [x.guest] : []));
          const free = u.seats.find((x) => !x.guest) ?? null;
          const full = u.capacity > 0 && u.seated >= u.capacity;
          const fit = seatCardCircles(people.length, u.seats.length);
          return (
            <button
              key={u.key}
              type="button"
              /* 🪑 A TABLE IS A CARD — pressable, so framed; a face let go on it takes its next free seat. */
              className={`sn-press flex w-full min-w-0 flex-col gap-2 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(26,26,26,0.06)] ring-1 ring-ink/[0.06] dark:bg-raised ${OVER}`}
              data-seat-card={u.key}
              data-seat-section={u.key}
              data-seat-card-full={full ? '' : undefined}
              aria-label={`${u.label}, ${u.seated} of ${u.capacity} seated — open`}
              onClick={tap(() => openTable(u.key))}
              {...(free ? seatDropAttrs({ kind: 'seat', tableId: free.tableId, seat: free.seat, occupantId: null }) : {})}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                {/* ✂ A table's name WRAPS, never cut (owner v15 — names are never ellipsized; up to three lines). */}
                <span className="line-clamp-3 min-w-0 text-[16px] font-semibold text-ink [overflow-wrap:anywhere]">{u.label}</span>
                {u.vip ? <VipMark /> : null}
                <span className={`ml-auto inline-flex shrink-0 items-center gap-1 text-[13.5px] font-medium ${full ? 'text-success-700' : 'text-ink/70'}`} data-seat-tally="">
                  {full ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} /> : null}
                  {formatCount(u.seated)} of {formatCount(u.capacity)}
                </span>
              </span>
              {fit.faces + fit.dots > 0 ? (
                <span className="flex min-w-0 flex-wrap items-center gap-1.5" data-seat-card-faces="">
                  {people.slice(0, fit.faces).map((g) => (
                    <Face key={g.id} g={g} faint={dim(g.id)} />
                  ))}
                  {Array.from({ length: fit.dots }, (_, i) => (
                    <span key={`e${i}`} aria-hidden className={CHAIR} data-seat-card-chair="" />
                  ))}
                </span>
              ) : null}
              {fit.more ? (
                <span className="text-[12.5px] text-ink/60" data-seat-card-more="">
                  {fit.more}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {openUnit ? (
        /* ⬆ THE TABLE, RISEN FULL SCREEN (§ 4): its people first, ONE row for its empty seats, and "This table" at the
           bottom — in the thumb zone. */
        <Sheet
          open
          full
          rise
          onClose={() => setOpenKey(null)}
          labelledById={sheetTitleId}
          foot={
            <div className="min-w-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2" data-seat-this-table={openUnit.key}>
              <p className="pb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/60">This table</p>
              {renaming(openUnit.key)}
              <div className="flex min-w-0 flex-wrap items-center gap-2 py-1.5" data-seat-table-tools={openUnit.key}>
                {tableTools(openUnit.key)}
              </div>
              <div className="flex min-w-0 items-center gap-2 pt-1.5">
                {pencil ? (
                  <>
                    <span ref={renameHolder} hidden aria-hidden data-seat-rename-holder="">
                      {pencil}
                    </span>
                    <ActionButton
                      tone="neutral"
                      icon={Pencil}
                      label="Rename"
                      name={`Rename ${openUnit.label}`}
                      className="flex-1"
                      onClick={() => renameHolder.current?.querySelector<HTMLElement>('button')?.click()}
                      data-testid="seat-table-rename-word"
                    />
                  </>
                ) : null}
                <ActionButton tone="brand" main icon={Check} label="Done" className="flex-1" onClick={() => setOpenKey(null)} data-testid="seat-table-done" />
              </div>
            </div>
          }
        >
          <div className="min-w-0 px-4 pb-4 pt-4" data-seat-table-open={openUnit.key} style={{ ['--gs-top' as string]: '0px', ['--gs-stick-h' as string]: '0px' } as CSSProperties}>
            <h2 id={sheetTitleId} className="flex min-w-0 items-baseline gap-2 pr-12 text-[20px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
              {openUnit.label}
              {openUnit.vip ? <VipMark /> : null}
            </h2>
            <p className="pb-2 text-[13.5px] text-ink/70" data-seat-table-tally="">
              {formatCount(openUnit.seated)} of {formatCount(openUnit.capacity)} seated
            </p>
            {moving ? (
              <p role="status" className="pb-1 text-[13.5px] text-terracotta-800" data-seat-moving="">
                Moving <b className="font-semibold">{moving.name}</b> — tap a seat
              </p>
            ) : null}
            {openUnit.seats.map((x) => (x.guest ? guestRow(x.guest, { tableId: x.tableId, seat: x.seat, table: openUnit.label }) : null))}
            {emptySeatsRow(openUnit)}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

/** A row the search / Show leaves out, or the one being dragged: faint, still in its place. No text selection or iOS
 *  callout while a finger holds it. */
function ROW_STYLE(faint: boolean): CSSProperties {
  return { opacity: faint ? 0.3 : undefined, WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as CSSProperties;
}

export { UNSEATED as SEAT_LIST_UNSEATED };
