'use client';

/**
 * swipe-to-delete.tsx — THE ONE SWIPE. Swipe a list row left and a Delete shows behind it.
 *
 * ⚖ Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"):
 * *"for most rows, there is a (X) present. can we do the swipe to the left to show delete instead? to all rows that has
 * delete?"* → *"ok"*. A small ✕ stays only on photo/video tiles, tags/chips and fields inside an editor.
 *
 * Moved, not re-invented: this is the guest list's swipe (owner 2026-06-03, `SwipeToDelete` in the retired
 * `guest-list-multiselect.tsx`, removed with it on 2026-10-09 — commit 21b9499381), lifted out with its gesture intact
 * and its guest-only parts handed back to the caller. What the row's Delete DOES is the caller's: open its in-page
 * warning (guests: `DeleteGuestSheet`), or delete at once with Undo (`deleteWithUndo`, ./undo/delete-with-undo.ts).
 *
 *   · PHONE — a left swipe reveals Delete; past halfway it snaps open, else closed. A vertical move first lets the list
 *     scroll (the axis locks on the first 8 px), and a finger held still first is the row's own hold. The tap a drag ends in is swallowed; a tap on an OPEN row closes it
 *     instead of opening it. Opening one row closes any other.
 *   · COMPUTER — Delete shows at the row's end on hover (and whenever the keyboard is inside the row), in its own column,
 *     so it never covers the row's own buttons. No swipe with a mouse.
 *   · KEYBOARD / SCREEN READER — the hover Delete is a real button in the Tab order; on a phone the revealed Delete is a
 *     real, named button too ("Delete Ana Cruz"). Rows that have a ⋯ menu ALSO list Delete there (the caller's menu).
 *
 * Held by lib/no-delete-x-on-list-rows.test.ts (no list row ships a visible ✕) and
 * app/_components/swipe-to-delete.test.ts (the gesture's rules).
 */

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { Trash2, type LucideIcon } from 'lucide-react';

/** px width of the revealed action. */
export const SWIPE_REVEAL_PX = 84;
/** The first real movement that decides the axis. */
export const SWIPE_AXIS_PX = 8;
/** A finger held still this long is a HOLD (a row's own press-and-hold drag — guests' role drag lifts at 350 ms), never a swipe. */
export const SWIPE_HOLD_MS = 300;

/* ── The gesture, as plain functions (tested without a DOM) ─────────────────────────────────────────────────────── */

export type SwipeDrag = { x: number; y: number; tx: number; t0: number; horiz: boolean; moved: boolean; active: boolean };

export function swipeBegin(x: number, y: number, tx: number, t0 = 0): SwipeDrag {
  return { x, y, tx, t0, horiz: false, moved: false, active: true };
}

/** One move. Returns the new drag and the row's offset (`null` = leave it where it is). */
export function swipeMove(d: SwipeDrag, x: number, y: number, now = d.t0, reveal = SWIPE_REVEAL_PX): { drag: SwipeDrag; tx: number | null } {
  if (!d.active) return { drag: d, tx: null };
  const dx = x - d.x;
  const dy = y - d.y;
  let horiz = d.horiz;
  if (!horiz) {
    // Held still first → the row's own press-and-hold (a drag to another section) — the swipe lets go.
    if (now - d.t0 > SWIPE_HOLD_MS) return { drag: { ...d, active: false }, tx: null };
    // Vertical intent first → the gesture is the list's scroll, not ours.
    if (Math.abs(dy) > SWIPE_AXIS_PX && Math.abs(dy) >= Math.abs(dx)) return { drag: { ...d, active: false }, tx: null };
    if (Math.abs(dx) > SWIPE_AXIS_PX) horiz = true;
    else return { drag: d, tx: null };
  }
  return { drag: { ...d, horiz, moved: true }, tx: Math.max(-reveal, Math.min(0, d.tx + dx)) };
}

/** Where the row settles when the finger lifts: open past halfway, else closed. */
export function swipeSettle(tx: number, reveal = SWIPE_REVEAL_PX): number {
  return tx < -reveal / 2 ? -reveal : 0;
}

/* ── One open row at a time ─────────────────────────────────────────────────────────────────────────────────────── */

const openListeners = new Set<(id: string) => void>();
function announceOpen(id: string) {
  for (const l of openListeners) l(id);
}

export function SwipeToDelete({
  children,
  label,
  onDelete,
  word = 'Delete',
  icon: Icon = Trash2,
  disabled = false,
  busy = false,
  hover = true,
  radiusClass = 'rounded-xl',
  surfaceClass = 'bg-cream',
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode;
  /** The button's name, for whom — "Delete Ana Cruz", "Remove Lights", never forty identical "Delete"s. */
  label: string;
  /** Pressed Delete. Open the warning, or delete with Undo. `close` springs the row shut (e.g. when the warning is cancelled). */
  onDelete: (close: () => void) => void;
  /** The revealed word — "Delete" · "Remove" · "Release seat". */
  word?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  /** The delete is running — the revealed word reads "…". */
  busy?: boolean;
  /** Show the Delete on hover on a computer (default). Off only where the row already lists it in its own ⋯ menu. */
  hover?: boolean;
  /** Matches the row's corners so the clip never shaves them. */
  radiusClass?: string;
  /** The front's own ground, opaque, so the closed row covers the Delete behind it (dark-paired token). */
  surfaceClass?: string;
  /** `li` when the row is a list item. */
  as?: 'div' | 'li';
  className?: string;
}) {
  const id = useId();
  const [tx, setTx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Gesture state in a ref so the touch handlers never read a stale closure.
  const drag = useRef<SwipeDrag>({ ...swipeBegin(0, 0, 0), active: false });

  useEffect(() => {
    const onOther = (other: string) => {
      if (other !== id) setTx(0);
    };
    openListeners.add(onOther);
    return () => {
      openListeners.delete(onOther);
    };
  }, [id]);

  const close = () => setTx(0);
  const press = () => {
    if (disabled || busy) return;
    onDelete(close);
  };

  const end = () => {
    const d = drag.current;
    drag.current = { ...d, active: false };
    setDragging(false);
    if (d.horiz) {
      setTx((t) => {
        const settled = swipeSettle(t);
        if (settled !== 0) announceOpen(id);
        return settled;
      });
    }
  };

  return (
    <Tag className={`group/swipe relative flex items-stretch ${className}`} data-swipe-row="">
      <div className={`relative min-w-0 flex-1 overflow-hidden ${radiusClass}`}>
        {/* The Delete behind the row — revealed by a left swipe. Phones only: a mouse cannot swipe. Not drawn at
            all while the row is closed and still: a rounded row's anti-aliased corners would otherwise show a red
            hairline over it. It hides only once the 0.2 s slide back has ended, so a closing row never shows the page behind. */}
        <div
          className={`absolute inset-y-0 right-0 flex [@media(hover:hover)_and_(pointer:fine)]:hidden ${tx === 0 && !dragging ? 'invisible [transition:visibility_0s_0.2s]' : ''}`}
          style={{ width: SWIPE_REVEAL_PX }}
        >
          <button
            type="button"
            onClick={press}
            disabled={disabled || busy}
            aria-label={label}
            tabIndex={tx === 0 ? -1 : 0}
            data-swipe-delete=""
            className="flex w-full flex-col items-center justify-center gap-0.5 bg-danger-600 text-white disabled:opacity-70 dark:bg-danger-400"
          >
            <Icon aria-hidden className="h-5 w-5" strokeWidth={2} />
            <span className="text-[11px] font-semibold leading-tight">{busy ? '…' : word}</span>
          </button>
        </div>

        {/* The row itself — slides on a swipe; opaque so it covers the Delete when closed. */}
        <div
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (!t || disabled) return;
            drag.current = swipeBegin(t.clientX, t.clientY, tx, e.timeStamp);
            // 👆 NOTHING visible changes on touch-down (owner 2026-11-04 "i see it needs a double tap?"): iPhone Safari
            // swallows the click of a tap whose touch-down shows or hides anything — here, the red Delete behind the
            // row — so every row needed two taps to open. The row only counts as dragging once the swipe is decided.
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (!t) return;
            const { drag: next, tx: nextTx } = swipeMove(drag.current, t.clientX, t.clientY, e.timeStamp);
            drag.current = next;
            if (!next.active) setDragging(false);
            if (nextTx !== null) {
              setDragging(true);
              setTx(nextTx);
            }
          }}
          onTouchEnd={end}
          onTouchCancel={end}
          onClickCapture={(e) => {
            if (drag.current.moved) {
              // The click a drag ends in — not a tap. Keep the snapped position.
              e.preventDefault();
              e.stopPropagation();
              drag.current = { ...drag.current, moved: false };
              return;
            }
            if (tx !== 0) {
              // A tap on an OPEN row closes it instead of opening it.
              e.preventDefault();
              e.stopPropagation();
              setTx(0);
            }
          }}
          className={`relative z-10 ${surfaceClass} ${radiusClass}`}
          data-swipe-front=""
          style={{
            // No transform at rest: a transform (even translateX(0)) makes this box the frame for every
            // `position: fixed` inside the row, and the row's own sheets would be cut to the row.
            transform: tx === 0 && !dragging ? undefined : `translateX(${tx}px)`,
            transition: dragging ? 'none' : 'transform var(--sn-dur-snap) var(--sn-ease-emph)', // 🎞 snap 220 ms (motion system 2026-11-13)
            touchAction: 'pan-y',
          }}
        >
          {children}
        </div>
      </div>

      {/* 🖱 A computer: Delete at the row's end, on hover or when the keyboard is in the row — its own column, so it
          never covers the row's own buttons. Hidden on touch screens (the swipe is theirs). */}
      {hover ? (
        <button
          type="button"
          onClick={press}
          disabled={disabled || busy}
          aria-label={label}
          title={word}
          data-swipe-hover-delete=""
          className="hidden shrink-0 items-center justify-center self-center rounded-lg px-2 text-danger-700 opacity-0 transition-opacity hover:bg-danger-50 focus-visible:opacity-100 group-hover/swipe:opacity-100 group-focus-within/swipe:opacity-100 disabled:opacity-40 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </Tag>
  );
}

/* ── The gesture alone, for a row that places itself ───────────────────────────────────────────────────────────────
 * 📖 Event chapters slice 1 (owner 2026-11-03, approved prototype "Event chapters — 4 Nov 2026", frame 3): the
 * Schedule's hour rail draws each chapter as an absolutely placed block, so it cannot be wrapped in `SwipeToDelete`.
 * `useSwipeReveal` is THE SAME gesture (`swipeBegin` · `swipeMove` · `swipeSettle` above — axis lock, hold, snap, the
 * click guard, no transform at rest, nothing visible on touch-down) handed to the caller; `SwipeDeleteButton` is the
 * Delete it reveals. The Delete only ASKS — the caller shows its own warning. */

export function useSwipeReveal({ enabled = true, reveal = SWIPE_REVEAL_PX }: { enabled?: boolean; reveal?: number } = {}) {
  const id = useId();
  const [tx, setTx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<SwipeDrag>({ ...swipeBegin(0, 0, 0), active: false });

  useEffect(() => {
    const onOther = (other: string) => {
      if (other !== id) setTx(0);
    };
    openListeners.add(onOther);
    return () => {
      openListeners.delete(onOther);
    };
  }, [id]);

  const end = () => {
    const d = drag.current;
    drag.current = { ...d, active: false };
    setDragging(false);
    if (d.horiz) {
      setTx((t) => {
        const settled = swipeSettle(t, reveal);
        if (settled !== 0) announceOpen(id);
        return settled;
      });
    }
  };

  /** The handlers for the row that moves. */
  const rowProps = {
    onTouchStart: (e: ReactTouchEvent) => {
      const t = e.touches[0];
      if (!t || !enabled) return;
      drag.current = swipeBegin(t.clientX, t.clientY, tx, e.timeStamp);
    },
    onTouchMove: (e: ReactTouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const { drag: next, tx: nextTx } = swipeMove(drag.current, t.clientX, t.clientY, e.timeStamp, reveal);
      drag.current = next;
      if (!next.active) setDragging(false);
      if (nextTx !== null) {
        setDragging(true);
        setTx(nextTx);
      }
    },
    onTouchEnd: end,
    onTouchCancel: end,
    onClickCapture: (e: ReactMouseEvent) => {
      if (drag.current.moved) {
        // The click a drag ends in — not a tap. Keep the snapped position.
        e.preventDefault();
        e.stopPropagation();
        drag.current = { ...drag.current, moved: false };
        return;
      }
      if (tx !== 0) {
        // A tap on an OPEN row closes it instead of opening it.
        e.preventDefault();
        e.stopPropagation();
        setTx(0);
      }
    },
  };
  /** The row's own movement — none at rest (a transform would frame every `position: fixed` inside the row). */
  const rowStyle: CSSProperties = {
    transform: tx === 0 && !dragging ? undefined : `translateX(${tx}px)`,
    transition: dragging ? 'none' : 'transform var(--sn-dur-snap) var(--sn-ease-emph)', // 🎞 snap 220 ms (motion system 2026-11-13)
    touchAction: 'pan-y',
  };
  return { tx, open: tx !== 0, close: () => setTx(0), rowProps, rowStyle, reveal };
}

/** The Delete `useSwipeReveal` reveals — behind the row, at its right. */
export function SwipeDeleteButton({
  label,
  open,
  onDelete,
  reveal = SWIPE_REVEAL_PX,
  className = '',
  style,
}: {
  /** "Delete After Party" — what a screen reader hears. */
  label: string;
  open: boolean;
  onDelete: () => void;
  reveal?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      data-swipe-delete=""
      onClick={onDelete}
      aria-label={label}
      tabIndex={open ? 0 : -1}
      aria-hidden={open ? undefined : true}
      className={`flex flex-col items-center justify-center gap-0.5 bg-danger-600 text-white dark:bg-danger-400 ${className}`}
      style={{ width: reveal, ...style }}
    >
      <Trash2 aria-hidden className="h-5 w-5" strokeWidth={2} />
      <span className="text-[11px] font-semibold leading-tight">Delete</span>
    </button>
  );
}
