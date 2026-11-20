'use client';

import { useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { SWIPE_REVEAL_PX, swipeBegin, swipeMove, type SwipeDrag } from '@/app/_components/swipe-to-delete';
import { ArrowRight, CalendarClock, Lock } from 'lucide-react';
import { PUT_OFF_WORDS, dragArmed, dragOffset, dragOutcome } from '@/lib/today-put-off';

/**
 * ⏭↔ THE TWO DRAGS (Today v3 part 2 — owner 19 Nov: *"drag left to do tomorrow / drag right open it"*; drawing V3 · 2,
 * 2b). The shipped swipe's own gesture (`swipeBegin` · `swipeMove` from `swipe-to-delete.tsx` — the axis lock on the
 * first 8 px, a still finger is not a swipe, the 84 px area, nothing visible on touch-down) in BOTH directions:
 *   · RIGHT past halfway → the task's own page (the same place as "Open in page ›");
 *   · LEFT past halfway → "Do it tomorrow", with "Moved to tomorrow · Undo";
 *   · a RED row dragged left moves about a third as far and springs back, with "Urgent · can't go to tomorrow";
 *   · short of halfway → it springs back (Release, 220 ms).
 * Used by the supplier's Today (`today-v2-client.tsx`) and admin Focus (`focus-row.tsx`) — ONE gesture for both
 * (owner 19 Nov: "this applies to admin and supplier's today"). Only a CLOSED row drags: an open card holds a reply box, and a drag there would fight the text. No ✕, no delete —
 * a task leaves only by being finished, or by going to tomorrow ("you cannot delete a task until its complete").
 */
export function useTodayDrag({ enabled, red, onOpen, onTomorrow, onRefuse }: { enabled: boolean; red: boolean; onOpen: () => void; onTomorrow: () => void; onRefuse: () => void }) {
  const [tx, setTx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<SwipeDrag>({ ...swipeBegin(0, 0, 0), active: false });
  const end = () => {
    const d = drag.current;
    drag.current = { ...d, active: false };
    setDragging(false);
    if (!d.horiz) return;
    const outcome = dragOutcome(tx, red, SWIPE_REVEAL_PX);
    setTx(0);
    if (outcome === 'open') onOpen();
    else if (outcome === 'tomorrow') onTomorrow();
    else if (outcome === 'refused') onRefuse();
  };
  const handlers = enabled
    ? {
        onTouchStart: (e: ReactTouchEvent) => {
          const t = e.touches[0];
          if (t) drag.current = swipeBegin(t.clientX, t.clientY, 0, e.timeStamp);
        },
        onTouchMove: (e: ReactTouchEvent) => {
          const t = e.touches[0];
          if (!t) return;
          // The shipped gesture decides the axis; this row then follows the finger BOTH ways.
          const { drag: next } = swipeMove(drag.current, t.clientX, t.clientY, e.timeStamp);
          drag.current = next;
          if (!next.active) return setDragging(false);
          if (!next.horiz) return;
          setDragging(true);
          setTx(dragOffset(t.clientX - next.x, red, SWIPE_REVEAL_PX));
        },
        onTouchEnd: end,
        onTouchCancel: end,
        onClickCapture: (e: ReactMouseEvent) => {
          if (drag.current.moved) {
            // The click a drag ends in — not a tap.
            e.preventDefault();
            e.stopPropagation();
            drag.current = { ...drag.current, moved: false };
          }
        },
      }
    : {};
  return { tx, dragging, handlers, armed: dragArmed(tx, red, SWIPE_REVEAL_PX) };
}


/**
 * The two panes behind a moving row — drawn only while it moves, so a still row shows no colour at its edges. Each is a
 * ready-coloured layer that fades in past halfway (motion "Status change", Quick). Left: "Open in page ›". Right:
 * "Tomorrow", or on a red row "Can't push — urgent".
 */
export function TwoWayPanes({ tx, armed, red }: { tx: number; armed: 'open' | 'tomorrow' | null; red: boolean }) {
  return (
    <>
          <span
            aria-hidden
            data-today-drag-pane="open"
            className="absolute inset-y-0 left-0 flex items-center gap-1.5 px-3 text-[12.5px] font-bold text-white"
            style={{ width: SWIPE_REVEAL_PX, transition: 'opacity var(--sn-m-quick) var(--sn-m-settle)', background: 'rgb(var(--sn-accent-rgb, 194 78 37))', opacity: tx > 0 ? (armed === 'open' ? 1 : 0.55) : 0 }}
          >
            <ArrowRight className="h-4 w-4 flex-none" strokeWidth={2} /> Open in page ›
          </span>
          <span
            aria-hidden
            data-today-drag-pane={red ? 'refused' : 'tomorrow'}
            className="absolute inset-y-0 right-0 flex items-center justify-end gap-1.5 px-3 text-right text-[12.5px] font-bold"
            style={{
              width: SWIPE_REVEAL_PX,
              transition: 'opacity var(--sn-m-quick) var(--sn-m-settle)',
              background: red ? 'rgb(var(--color-danger))' : 'color-mix(in srgb, rgb(var(--color-info, 45 90 146)) 16%, rgb(var(--sn-page-bg)))',
              color: red ? '#fff' : 'rgb(var(--color-info, 45 90 146))',
              opacity: tx < 0 ? (armed === 'tomorrow' || red ? 1 : 0.55) : 0,
            }}
          >
            {red ? <Lock className="h-4 w-4 flex-none" strokeWidth={2} /> : <CalendarClock className="h-4 w-4 flex-none" strokeWidth={2} />}
            {red ? 'Can’t push — urgent' : PUT_OFF_WORDS.pane}
          </span>
        </>
  );
}
