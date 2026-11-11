'use client';

/**
 * 📐 EVERYTHING PINNED ABOVE THE MESSAGES IS ONE STACK, CAPPED AT 4/9 OF THE SCREEN (owner, 9 Nov — corpus fb2217b6).
 *
 * The head, the host strip (`ChatHostStrip`), the Chat · Decisions · Files switch, the file-expiry line and Lane B's
 * pins + Waiting line (the `pins` slot) together never take more than `calc(100dvh * 4 / 9)`, so the messages and the
 * composer always keep at least 5/9.
 *
 * 📌 PINNED STAYS PINNED (owner, 9 Nov, "the pinned on top should stay pinned" — 03-FINAL-RULINGS): the `fixed` part
 * (the who's-here strip and the switch) NEVER scrolls — not with the messages, not inside the stack. Over the cap, only
 * the region BELOW it (`children`: the pins, the Waiting line, the expiry line) scrolls; the messages scroll underneath.
 *
 * The head is not inside this box (it holds ✕ / ‹ and must never scroll away), so the box measures how far its own top
 * sits below the top of the screen — the head and anything else above it — and caps ITSELF at 4/9 minus that, keeping
 * the whole pinned region inside the line. Until it has measured (the server's pass) the cap is the plain 4/9.
 *
 * ✂ WHOLE ROWS ONLY (controller review of #7489, 11 Nov): over the cap the scrolling region stops at the last row
 * boundary that fits, never mid-row — a pin cut in half under the first date divider read as broken, not as "scrolls".
 * The leftover sliver goes back to the messages; the cap is still the ceiling, only rounded DOWN to a row.
 *
 * `isolate` gives the stack its own stacking context: nothing pinned can paint over an open panel below it.
 * 🔒 lib/the-pinned-stack-keeps-five-ninths.test.ts
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** The one cap — never written anywhere else. */
export const PINNED_STACK_CAP = 'calc(100dvh * 4 / 9)';
/** Room the stack keeps even under a tall head, so a pin is never cut to nothing (it scrolls instead). */
const PINNED_STACK_FLOOR = '4.5rem';

export function pinnedStackMaxHeight(aboveTopPx: number, fixedPx = 0): string {
  const above = Math.max(0, Math.round(aboveTopPx));
  const fixed = Math.max(0, Math.round(fixedPx));
  // 📌 The FIXED part (strip + switch) is never clipped: on a short screen the cap gives way to it, and only the
  // scrolling region below it (the pins) shrinks — to nothing if it must (v8.3 pinned audit, 320×568).
  const floor = fixed > 0 ? `${fixed}px, ${PINNED_STACK_FLOOR}` : PINNED_STACK_FLOOR;
  return above > 0 || fixed > 0 ? `max(${floor}, calc(${PINNED_STACK_CAP} - ${above}px))` : PINNED_STACK_CAP;
}

export function ChatPinnedStack({ fixed, children }: { fixed: ReactNode; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(0);
  const fixedRef = useRef<HTMLDivElement>(null);
  const [fixedH, setFixedH] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rowsH, setRowsH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // The distance from the top of the screen to this box: the head (and anything pinned above it). Measured on mount
      // and on a resize — never on scroll, so scrolling never changes the cap.
      const top = el.getBoundingClientRect().top;
      setAbove((was) => (Math.abs(was - top) > 1 ? top : was));
      const h = fixedRef.current?.getBoundingClientRect().height ?? 0;
      setFixedH((was) => (Math.abs(was - h) > 1 ? h : was));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const head = el.parentElement;
    if (ro && head) ro.observe(head);
    if (ro && fixedRef.current) ro.observe(fixedRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, []);
  // ✂ Round the scrolling region DOWN to the last whole row that fits under the cap (null = everything fits).
  useLayoutEffect(() => {
    const stack = ref.current;
    const sc = scrollRef.current;
    if (!stack || !sc) return;
    const fit = () => {
      const cap = parseFloat(getComputedStyle(stack).maxHeight);
      const fixed = fixedRef.current?.getBoundingClientRect().height ?? 0;
      const room = cap - fixed;
      if (!Number.isFinite(room) || sc.scrollHeight <= room + 1) return setRowsH(null);
      const top = sc.getBoundingClientRect().top - sc.scrollTop;
      let best = 0;
      for (const el of sc.querySelectorAll('li, button')) {
        const b = el.getBoundingClientRect();
        if (b.height === 0) continue;
        const bottom = b.bottom - top;
        if (bottom <= room + 0.5 && bottom > best) best = bottom;
      }
      // No row fits whole (a very short screen): keep the plain cap — it scrolls.
      setRowsH(best >= 40 ? Math.floor(best) : null);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(stack);
    for (const child of sc.children) ro.observe(child);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [above, fixedH]);
  return (
    <div
      ref={ref}
      className="isolate flex shrink-0 flex-col overflow-hidden"
      style={{ maxHeight: pinnedStackMaxHeight(above, fixedH) }}
      data-chat-pinned-stack=""
    >
      <div ref={fixedRef} className="shrink-0" data-chat-pinned-fixed="">
        {fixed}
      </div>
      {children ? (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={rowsH != null ? { maxHeight: rowsH } : undefined}
          data-chat-pinned-scroll=""
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
