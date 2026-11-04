'use client';

/**
 * 📖 SWIPE LEFT TO DELETE — ONE SHARED PART (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW";
 * approved prototype "Event chapters — 4 Nov 2026", frame 3: *"the shipped SwipeToDelete from guest rows — one shared
 * part, no visible ✕"*).
 *
 * 🔑 MOVED, NOT RE-INVENTED. The gesture is the guest rows' `SwipeToDelete` (owner directive 2026-06-03), retired with
 * `GuestListMultiselect` on 2026-10-09 (commit 21b949938) — the same axis lock (8 px, vertical intent releases the
 * finger so the list scrolls), the same snap past half the reveal, the same click guard after a drag, and the same
 * "no transform at rest" (a transform makes the row the frame for every `position: fixed` inside it). It lives here
 * now so every list row reaches for ONE gesture.
 *
 *   · The revealed Delete only ASKS: it calls `onDelete`, and the caller shows its own in-page warning (never a browser
 *     `confirm()`). Nothing is removed by the swipe itself.
 *   · Touch only. Desktop and screen readers keep the row's own Delete (its sheet or ⋯ menu); the revealed button is
 *     out of the tab order while the row is closed.
 *
 * `useSwipeReveal` is the gesture alone, for a row that positions itself (the Schedule's hour rail draws each chapter
 * as an absolutely placed block); `SwipeToDelete` wraps an ordinary list row.
 */

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

/** Width of the revealed Delete, in px (the retired guest row's figure). */
export const SWIPE_REVEAL_PX = 84;

export function useSwipeReveal({ enabled = true, reveal = SWIPE_REVEAL_PX }: { enabled?: boolean; reveal?: number } = {}) {
  const [tx, setTx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Gesture state in a ref so the touch handlers never read a stale closure.
  const drag = useRef({ x: 0, y: 0, tx: 0, horiz: false, moved: false, active: false });

  const begin = (x: number, y: number) => {
    if (!enabled) return;
    drag.current = { x, y, tx, horiz: false, moved: false, active: true };
    setDragging(true);
  };
  const move = (x: number, y: number) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = x - d.x;
    const dy = y - d.y;
    if (!d.horiz) {
      // Lock the axis on the first real movement: vertical intent releases the gesture so the list scrolls.
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
        d.active = false;
        setDragging(false);
        return;
      }
      if (Math.abs(dx) > 8) d.horiz = true;
      else return;
    }
    d.moved = true;
    setTx(Math.max(-reveal, Math.min(0, d.tx + dx)));
  };
  const end = () => {
    const d = drag.current;
    d.active = false;
    setDragging(false);
    // Snap open past the halfway point, else closed.
    if (d.horiz) setTx((t) => (t < -reveal / 2 ? -reveal : 0));
  };

  /** The handlers for the row that moves. */
  const rowProps = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (t) begin(t.clientX, t.clientY);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    },
    onTouchEnd: end,
    onTouchCancel: end,
    onClickCapture: (e: React.MouseEvent) => {
      if (drag.current.moved) {
        // The click a browser makes right after a drag — ignored; the row keeps its snapped place.
        e.preventDefault();
        e.stopPropagation();
        drag.current.moved = false;
        return;
      }
      if (tx !== 0) {
        // A tap on an OPEN row closes it instead of opening the row.
        e.preventDefault();
        e.stopPropagation();
        setTx(0);
      }
    },
  };
  /** The row's own movement — none at rest (see the docblock). */
  const rowStyle: CSSProperties = {
    transform: tx === 0 && !dragging ? undefined : `translateX(${tx}px)`,
    transition: dragging ? 'none' : 'transform 0.2s ease',
    touchAction: 'pan-y',
  };
  return { tx, open: tx !== 0, close: () => setTx(0), rowProps, rowStyle, reveal };
}

/** The Delete the swipe reveals — behind the row, at its right. */
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
      className={`flex flex-col items-center justify-center gap-0.5 bg-danger-600 text-cream ${className}`}
      style={{ width: reveal, ...style }}
    >
      <Trash2 aria-hidden className="h-5 w-5" strokeWidth={2} />
      <span className="text-[11px] font-semibold">Delete</span>
    </button>
  );
}

/** An ordinary list row that swipes left to reveal Delete. */
export function SwipeToDelete({
  label,
  onDelete,
  enabled = true,
  radiusClass = '',
  children,
}: {
  label: string;
  /** Asks — the caller shows its warning. */
  onDelete: () => void;
  enabled?: boolean;
  radiusClass?: string;
  children: ReactNode;
}) {
  const swipe = useSwipeReveal({ enabled });
  if (!enabled) return <>{children}</>;
  return (
    <div className={`relative overflow-hidden ${radiusClass}`}>
      <div className="absolute inset-y-0 right-0 flex">
        <SwipeDeleteButton
          label={label}
          open={swipe.open}
          onDelete={() => {
            swipe.close();
            onDelete();
          }}
        />
      </div>
      <div {...swipe.rowProps} className="relative z-10 bg-white" style={swipe.rowStyle}>
        {children}
      </div>
    </div>
  );
}
