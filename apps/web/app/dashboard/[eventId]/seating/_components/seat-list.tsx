'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowLeftRight, Armchair, Check, ChevronDown, ChevronUp, Plus, UserMinus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { useRowState } from '@/app/dashboard/[eventId]/guests/_components/use-row-state';
import { dragBandOf, dragEdgeStep, dragScrollBy, dragScrollerOf } from '@/lib/drag-edge-scroll';
import { TAP_SLOP_MOUSE, TAP_SLOP_TOUCH } from '@/lib/march-drag';
import { SEAT_HOLD_MS, readSeatDrop, seatDropAttrs, seatTallyWords, type SeatDropTarget } from '@/lib/seat-list-drop';
import { formatCount } from '@/lib/format-number';
import { VipMark } from './vip-mark';
import { RiseScreen, WithRiseClose } from '@/app/_components/rise/rise-screen';
import { dropGhost, ghostAt, liftGhost } from '@/lib/lift';

/**
 * 🪑 GUESTS › SEATS › LIST — EVERY TABLE AS A CARD (owner 20 Nov 2026, Guests redesign pick 5, drawing
 * `prototypes/guests_redesign_2026-11-20/` §4; it replaces the 1 Nov "Guests list grouped by table" headers).
 *
 *   · the counts in words — "34 seated · 0 to seat · 9 tables · 43 empty chairs";
 *   · a card per table: name · VIP · "7 of 10" · its faces · dotted empty chairs ("+N empty" past ten). "To seat" is the
 *     first card while anyone coming has no seat;
 *   · a tap RISES the table full screen: its people (rows drawn with the Guest list's own stylesheet,
 *     `guests-screen.module.css`, imported, never copied) · one "N empty seats · Add a guest" row whose list stays open
 *     so names are tapped one after another (round two, pick 5) · "This table" (the editor's Shape ▾ · Seats − N + ·
 *     VIP) with Rename and Done at the bottom.
 *
 * MOVING SOMEONE — two ways, one answer (`lib/seat-list-drop.ts › planSeatDrop`):
 *   · press and hold a guest (a mouse: press and move), drag, let go on a seat or a card — the list scrolls by itself
 *     near its top or bottom edge (THE shared edge scroll, `lib/drag-edge-scroll.ts`);
 *   · "tap · move": Move (or Seat) picks them up and the table closes; the card tapped next is where they go (its next
 *     free seat).
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

export function SeatList({
  units,
  unseated,
  pickedId,
  canEdit,
  open,
  onOpenGuest,
  onPick,
  onRemove,
  onSeatHere,
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
              label={where ? 'Move' : 'Seat'}
              name={`${where ? 'Move' : 'Seat'} ${g.name}`}
              onClick={() => {
                // 🪑 Move picks them up; the cards are then where they go (a card = its next free seat).
                onPick(g.id);
                close();
              }}
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
  /* ═══ 🪑 EVERY TABLE AS A CARD (owner 20 Nov 2026, Guests redesign pick 5 — "Seats › List shows every table as a card
     (name · "7 of 10" · faces · dotted empty chairs); tap a table → it rises full screen with its people, one "N empty
     seats · Add a guest" row, and Shape · Seats · VIP at the bottom"; round two pick 5 — "the list stays open so names are
     tapped one after another"). Drawing `prototypes/guests_redesign_2026-11-20/` §4. The rows, the drag, Move (the
     shipped "tap · move"), the swipe off a seat and every write are the ones above — only where they are drawn changed. */
  const seatedAll = units.reduce((n, u) => n + u.seated, 0);
  const emptyAll = units.reduce((n, u) => n + Math.max(0, u.capacity - u.seated), 0);
  /** The table (or "To seat") risen full screen — null = the cards. */
  const [sheet, setSheet] = useState<string | null>(null);
  /** "Add a guest" open on the risen table — the names stay listed so they are tapped one after another (pick 5). */
  const [adding, setAdding] = useState(false);
  /* A search, a count door or a drop that opens a table in the editor's `open` (goToFound · openUnseated) raises it here. */
  const seenOpen = useRef<ReadonlySet<string>>(open);
  useEffect(() => {
    const before = seenOpen.current;
    seenOpen.current = open;
    const added = [...open].find((k) => !before.has(k));
    if (added) setSheet(added);
  }, [open]);
  const close = () => {
    setSheet(null);
    setAdding(false);
  };
  const unit = sheet && sheet !== UNSEATED ? (units.find((u) => u.key === sheet) ?? null) : null;
  // A table deleted (or renamed into another unit) while risen: back to the cards.
  useEffect(() => {
    if (sheet && sheet !== UNSEATED && !unit) close();
    if (sheet === UNSEATED && unseated.length === 0 && !adding) close();
  }, [sheet, unit, unseated.length, adding]);
  /** A table's free seats, in order. */
  const freeOf = (u: SeatListUnit) => u.seats.filter((x) => !x.guest);
  /** "Seats 5 to 10" · "Seat 7" · "Seats 2, 5 and 9". */
  const seatWords = (free: SeatListSeat[]): string => {
    const n = free.map((x) => x.seat + 1);
    if (n.length === 1) return `Seat ${formatCount(n[0]!)}`;
    const run = n.every((v, i) => i === 0 || v === n[i - 1]! + 1);
    if (run) return `Seats ${formatCount(n[0]!)} to ${formatCount(n[n.length - 1]!)}`;
    return `Seats ${n.slice(0, -1).map(formatCount).join(', ')} and ${formatCount(n[n.length - 1]!)}`;
  };
  /** A face on a card — the photo, or the initials on the side's tint. */
  const chip = (g: SeatListGuest, key: string) => (
    <span
      key={key}
      className="relative inline-grid h-[26px] w-[26px] shrink-0 place-items-center overflow-hidden rounded-full bg-ink/[0.06] text-[9.5px] font-bold text-ink/70"
      data-seat-card-face=""
      data-seat-face={g.id}
      // ⇅ A guest the shared Show or the search leaves out is faint on the card too — their chair is still taken.
      data-seat-dim={dim(g.id) ? '' : undefined}
      style={dim(g.id) ? { opacity: 0.3 } : undefined}
    >
      {g.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google), as the rows' own
        <img src={g.photo} alt="" width={26} height={26} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        g.initials
      )}
    </span>
  );
  const dotted = (key: string) => (
    <span key={key} aria-hidden className="inline-block h-[26px] w-[26px] shrink-0 rounded-full border-[1.5px] border-dashed border-ink/20" data-seat-card-empty="" />
  );
  /** The most chairs a card draws; more says "+N empty" under them (the drawing's Table 3). */
  const CARD_CHAIRS = 10;
  const card = (key: string, title: ReactNode, tally: ReactNode, faces: ReactNode[], foot: ReactNode, label: string, onPress: () => void, drop: Record<string, string> = {}) => (
    <button
      key={key}
      type="button"
      className={`sn-frame sn-press flex w-full min-w-0 flex-col gap-2.5 text-left ${OVER}`}
      onClick={tap(onPress)}
      aria-label={label}
      data-seat-card={key}
      {...drop}
    >
      <span className="flex w-full min-w-0 items-baseline gap-2">
        <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink">{title}</span>
        <span className="shrink-0 text-[13.5px] text-ink/70" data-seat-tally="">
          {tally}
        </span>
      </span>
      {faces.length ? <span className="flex min-w-0 flex-wrap gap-1.5">{faces}</span> : null}
      {foot}
    </button>
  );
  const tableCard = (u: SeatListUnit) => {
    const people = u.seats.filter((x) => x.guest);
    const chairs = Math.min(CARD_CHAIRS, u.capacity);
    const shownPeople = people.slice(0, chairs);
    const emptyShown = Math.max(0, chairs - shownPeople.length);
    const moreEmpty = Math.max(0, u.capacity - u.seated - emptyShown);
    const full = u.seated >= u.capacity && u.capacity > 0;
    const free = freeOf(u)[0];
    return card(
      u.key,
      <>
        <span className="line-clamp-3 [overflow-wrap:anywhere]">{u.label}</span>
        {u.vip ? (
          <span className="ml-2 inline-flex align-[2px]">
            <VipMark />
          </span>
        ) : null}
      </>,
      <span className={full ? 'inline-flex items-center gap-1 text-[rgb(var(--color-ok,43_116_74))]' : undefined}>
        {full ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} /> : null}
        {formatCount(u.seated)} of {formatCount(u.capacity)}
      </span>,
      [...shownPeople.map((x) => chip(x.guest!, `${x.tableId}:${x.seat}`)), ...Array.from({ length: emptyShown }, (_, i) => dotted(`e${i}`))],
      moreEmpty > 0 ? <span className="text-[12.5px] text-ink/60">+{formatCount(moreEmpty)} empty</span> : null,
      // While someone is picked ("Move"), the card is where they go: the table's next free seat.
      pickedId ? (free ? `Move here — ${u.label}, seat ${free.seat + 1}` : `${u.label} is full`) : `${u.label}, ${seatTallyWords(u.seated, u.capacity, formatCount)} — open`,
      () => {
        if (pickedId) {
          if (free) onSeatHere(free.tableId, free.seat);
          return;
        }
        setAdding(false);
        setSheet(u.key);
      },
      free ? seatDropAttrs({ kind: 'seat', tableId: free.tableId, seat: free.seat, occupantId: null }) : {},
    );
  };

  /* ── the risen table ── */
  const risen = sheet ? (
    /* 🎞 It RISES full screen — the shared full-screen part (`RiseScreen`, kind 'stack': something you edit), its head the
       table's name over "4 of 10 seated", its ✕, Esc and Back closing it. */
    <RiseScreen
      kind="stack"
      data="seat-table"
      title={unit ? unit.label : 'To seat'}
      line={
        unit
          ? `${unit.vip ? 'VIP table · ' : ''}${formatCount(unit.seated)} of ${formatCount(unit.capacity)} seated`
          : `${formatCount(unseated.length)} coming with no seat yet`
      }
      onClose={close}
    >
      <div className="min-w-0 pb-4" data-seat-table-sheet={sheet}>
        {unit ? renaming(unit.key) : null}
        {unit ? (
          <>
            {unit.seats.filter((x) => x.guest).map((x) => guestRow(x.guest!, { tableId: x.tableId, seat: x.seat, table: unit.label }))}
            {(() => {
              const free = freeOf(unit);
              if (free.length === 0) return null;
              const first = free[0]!;
              return (
                <div
                  className={`${gs.g} ${OVER}`}
                  data-seat-row=""
                  data-seat-empty=""
                  {...seatDropAttrs({ kind: 'seat', tableId: first.tableId, seat: first.seat, occupantId: null })}
                >
                  <span aria-hidden className="inline-block h-10 w-10 rounded-full border-[1.5px] border-dashed border-ink/20" />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-ink">
                      {formatCount(free.length)} empty {free.length === 1 ? 'seat' : 'seats'}
                    </span>
                    <span className="block text-[12.5px] text-ink/60">{seatWords(free)}</span>
                  </span>
                  {canEdit && unseated.length > 0 ? (
                    <span className={gs.acts} data-row-acts="">
                      <ActionButton
                        tone="neutral"
                        icon={adding ? ChevronUp : ChevronDown}
                        label="Add a guest"
                        aria-expanded={adding}
                        onClick={() => setAdding((v) => !v)}
                        data-testid="seat-sheet-add"
                      />
                    </span>
                  ) : null}
                </div>
              );
            })()}
            {/* ➕ The names still to seat — each tap seats one at the next free chair, and the list stays (pick 5). */}
            {adding && canEdit ? (
              <div className="pb-2" data-seat-sheet-to-seat="">
                <p className="pt-3 text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink/60">
                  To seat · {formatCount(unseated.length)}
                </p>
                {unseated.length === 0 ? (
                  <p className="py-2 text-[13.5px] text-ink/70">Everyone coming has a seat.</p>
                ) : (
                  unseated.map((g) => {
                    const free = freeOf(unit)[0];
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={!free}
                        className="sn-press flex min-h-[52px] w-full min-w-0 items-center gap-3 border-t border-ink/10 py-1.5 text-left disabled:opacity-40"
                        onClick={() => {
                          if (free) onDrop(g.id, { kind: 'seat', tableId: free.tableId, seat: free.seat, occupantId: null });
                        }}
                        data-seat-sheet-pick={g.id}
                      >
                        {chip(g, g.id)}
                        <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{g.name}</span>
                        <Plus aria-hidden className="h-4 w-4 shrink-0 text-ink/50" strokeWidth={2} />
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
            {/* 🛠 THIS TABLE — Shape ▾ · Seats − N + · VIP ▾ (the editor's own tools), then Rename and Done (thumb zone). */}
            <p className="mt-6 text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink/60">This table</p>
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-ink/10 py-3" data-seat-table-tools={unit.key}>
              {tableTools(unit.key)}
            </div>
            <div className="flex min-w-0 items-center gap-2 pt-2">
              {canEdit ? <span className="inline-flex shrink-0">{headTools(unit.key)}</span> : null}
              <WithRiseClose fallback={close}>{(shut) => <ActionButton tone="brand" main icon={Check} label="Done" onClick={shut} className="ml-auto" data-testid="seat-sheet-done" />}</WithRiseClose>
            </div>
          </>
        ) : (
          <>
            {unseated.map((g) => guestRow(g, null))}
            <div className="flex justify-end pt-4">
              <WithRiseClose fallback={close}>{(shut) => <ActionButton tone="brand" main icon={Check} label="Done" onClick={shut} data-testid="seat-sheet-done" />}</WithRiseClose>
            </div>
          </>
        )}
      </div>
    </RiseScreen>
  ) : null;

  return (
    <div
      ref={listRef}
      data-seat-list=""
      onPointerDown={onPointerDown}
      className="absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-28"
      style={{ ['--gs-top' as string]: '0px', ['--gs-stick-h' as string]: '0px' } as CSSProperties}
    >
      {/* 📊 The counts, in words (drawing: "34 seated ⓘ · 0 to seat · 9 tables · 43 empty chairs" — no sofa, person or
          target icons; the top row's icon counts step aside on this view). */}
      <div className="flex flex-col gap-1 pb-3 pt-1" data-seat-list-summary="">
        <span className="inline-flex items-center gap-1.5 text-[15px] font-medium text-ink/70">
          <b className="text-[30px] font-bold leading-none tracking-[-0.01em] text-ink" data-seat-count-words="seated">
            {formatCount(seatedAll)}
          </b>{' '}
          seated
        </span>
        <span className="text-[13.5px] text-ink/70">
          <b className="font-semibold text-ink" data-seat-count-words="unseated">{formatCount(unseated.length)}</b> to seat ·{' '}
          <b className="font-semibold text-ink" data-seat-count-words="tables">{formatCount(units.length)}</b> {units.length === 1 ? 'table' : 'tables'} ·{' '}
          <b className="font-semibold text-ink" data-seat-count-words="empty">{formatCount(emptyAll)}</b> empty {emptyAll === 1 ? 'chair' : 'chairs'}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5" data-seat-cards="">
        {/* "To seat" is the first card while anyone coming has no seat (drawing: "a first card above the tables"). */}
        {unseated.length > 0
          ? card(
              UNSEATED,
              'To seat',
              formatCount(unseated.length),
              unseated.slice(0, CARD_CHAIRS).map((g) => chip(g, g.id)),
              unseated.length > CARD_CHAIRS ? <span className="text-[12.5px] text-ink/60">+{formatCount(unseated.length - CARD_CHAIRS)} more</span> : null,
              `To seat, ${formatCount(unseated.length)} — open`,
              () => {
                setAdding(false);
                setSheet(UNSEATED);
              },
              seatDropAttrs({ kind: 'unseated' }),
            )
          : null}
        {units.length === 0 ? (
          <p className={gs.empty} data-seat-list-empty="">
            No tables yet — add one with ＋ Add › New table.
          </p>
        ) : null}
        {units.map(tableCard)}
      </div>
      {risen}
    </div>
  );
}

/** A row the search / Show leaves out, or the one being dragged: faint, still in its place. No text selection or iOS
 *  callout while a finger holds it. */
function ROW_STYLE(faint: boolean): CSSProperties {
  return { opacity: faint ? 0.3 : undefined, WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as CSSProperties;
}

export { UNSEATED as SEAT_LIST_UNSEATED };
