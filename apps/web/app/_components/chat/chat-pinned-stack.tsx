'use client';

/**
 * 📐 EVERYTHING PINNED ABOVE THE MESSAGES IS ONE STACK, CAPPED AT 4/9 OF THE SCREEN (owner, 9 Nov — corpus fb2217b6).
 *
 * The head, the host strip (`ChatHostStrip`), the Chat · Decisions · Files switch, the file-expiry line and Lane B's
 * pins + Waiting line (the `pins` slot) together never take more than `calc(100dvh * 4 / 9)`; past that the stack
 * scrolls INSIDE ITSELF, so the messages and the composer always keep at least 5/9.
 *
 * The head is not inside this box (it holds ✕ / ‹ and must never scroll away), so the box measures how far its own top
 * sits below the top of the screen — the head and anything else above it — and caps ITSELF at 4/9 minus that, keeping
 * the whole pinned region inside the line. Until it has measured (the server's pass) the cap is the plain 4/9.
 *
 * `isolate` gives the stack its own stacking context: nothing pinned can paint over an open panel below it.
 * 🔒 lib/the-pinned-stack-keeps-five-ninths.test.ts
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** The one cap — never written anywhere else. */
export const PINNED_STACK_CAP = 'calc(100dvh * 4 / 9)';
/** Room the stack keeps even under a tall head, so a pin is never cut to nothing (it scrolls instead). */
const PINNED_STACK_FLOOR = '4.5rem';

export function pinnedStackMaxHeight(aboveTopPx: number): string {
  const above = Math.max(0, Math.round(aboveTopPx));
  return above > 0 ? `max(${PINNED_STACK_FLOOR}, calc(${PINNED_STACK_CAP} - ${above}px))` : PINNED_STACK_CAP;
}

export function ChatPinnedStack({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // The distance from the top of the screen to this box: the head (and anything pinned above it). Measured on mount
      // and on a resize — never on scroll, so scrolling never changes the cap.
      const top = el.getBoundingClientRect().top;
      setAbove((was) => (Math.abs(was - top) > 1 ? top : was));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const head = el.parentElement;
    if (ro && head) ro.observe(head);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, []);
  return (
    <div
      ref={ref}
      className="isolate shrink-0 overflow-y-auto overscroll-contain"
      style={{ maxHeight: pinnedStackMaxHeight(above) }}
      data-chat-pinned-stack=""
    >
      {children}
    </div>
  );
}
