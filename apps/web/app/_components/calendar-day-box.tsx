'use client';

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

/**
 * 📅 THE ONE PICKED MARK + THE ONE CALENDAR SWIPE (Build 2 row #37, prototype v116/v118 `.dn` · `calSwipe`).
 *
 * ONE picked mark on all three supplier calendars — the Clients month, the Clients week strip and the client's Schedule
 * page: the day NUMBER in a 30×30 box, 10 px corners, ink fill, paper text. It pops in (scale .55 → 1, 0.3 s) and fades
 * out (0.22 s). Dots and a blocked day's strike stay visible on it; today keeps its thin ring (drawn by the cell).
 * Reduced motion: no pop, no fade.
 *
 * ONE swipe for the month and the week: sideways only (a vertical drag stays the page's scroll), the days follow the
 * finger, past 40 px the old and the new slide together (320 ms), under 40 px it snaps back. A swipe NEVER picks a day —
 * the click that ends it is swallowed. Reduced motion: the step is instant.
 */
export const DAY_BOX_MOTION = { popMs: 300, outMs: 220, ease: 'cubic-bezier(.33,1,.68,1)' } as const;
export const CALENDAR_SWIPE = { thresholdPx: 40, slideMs: 320, ease: 'cubic-bezier(.33,1,.68,1)', decidePx: 8 } as const;

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** The picked mark: the day's number in its box. `on` fills it; `struck` draws a blocked day's strike. */
export function DayBox({ on, struck = false, children }: { on: boolean; struck?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const was = useRef(on);
  useLayoutEffect(() => {
    const el = ref.current;
    const popped = on && !was.current;
    was.current = on;
    if (!popped || !el?.animate || reducedMotion()) return;
    el.animate([{ transform: 'scale(.55)' }, { transform: 'none' }], { duration: DAY_BOX_MOTION.popMs, easing: DAY_BOX_MOTION.ease });
  }, [on]);
  return (
    <span
      ref={ref}
      data-calendar-dn={on ? 'on' : ''}
      className={`grid h-[30px] w-[30px] place-items-center rounded-[10px] transition-colors ease-out motion-reduce:transition-none ${
        on ? 'bg-ink text-cream' : ''
      } ${struck ? 'line-through decoration-2' : ''}`}
      style={{ transitionDuration: `${DAY_BOX_MOTION.outMs}ms` }}
    >
      {children}
    </span>
  );
}

/**
 * Swipe the AREA (`ref`, which must outlive a month's remount) sideways to step: `onStep(+1)` for the next month / week
 * (finger moved left), `-1` for the previous. Only the `target` inside it moves (the days — the ‹ title › row stays).
 * `onStep` runs after the old days have been cloned as a ghost; once the new days have mounted, `slideIn()` (returned)
 * slides both together. The area must be `relative overflow-hidden`. Pure DOM — no state of its own.
 */
export function useCalendarSwipe(
  ref: RefObject<HTMLElement | null>,
  onStep: (side: 1 | -1) => void,
  target: string,
) {
  const step = useRef(onStep);
  step.current = onStep;
  /** The ghost of the old content and the side it leaves to, kept until the new content has mounted. */
  const pending = useRef<{ ghost: HTMLElement; side: 1 | -1; from: number } | null>(null);

  useLayoutEffect(() => {
    const area = ref.current;
    if (!area) return;
    const days = () => area.querySelector<HTMLElement>(target);
    let el: HTMLElement | null = null;
    let x0 = 0;
    let y0 = 0;
    let id: number | null = null;
    let sideways: boolean | null = null;
    let dx = 0;
    let swallow = false;
    const reset = () => {
      id = null;
      sideways = null;
      dx = 0;
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      el = days();
      if (!el) return;
      id = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
      sideways = null;
      dx = 0;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id || !el) return;
      const mx = e.clientX - x0;
      const my = e.clientY - y0;
      if (sideways === null) {
        if (Math.abs(mx) < CALENDAR_SWIPE.decidePx && Math.abs(my) < CALENDAR_SWIPE.decidePx) return;
        sideways = Math.abs(mx) > Math.abs(my);
        if (!sideways) return reset(); // a vertical drag is the page's scroll
        try {
          area.setPointerCapture(e.pointerId);
        } catch {
          /* a pointer that already ended */
        }
      }
      if (!sideways) return;
      dx = mx;
      el.style.transform = `translateX(${dx}px)`;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id || !el) return;
      const moved = sideways === true;
      const at = dx;
      reset();
      if (!moved) return;
      swallow = true; // the click this release makes never picks a day
      if (Math.abs(at) < CALENDAR_SWIPE.thresholdPx) {
        // Under 40 px: back where it was.
        if (el.animate && !reducedMotion()) {
          el.animate([{ transform: `translateX(${at}px)` }, { transform: 'none' }], { duration: CALENDAR_SWIPE.slideMs, easing: CALENDAR_SWIPE.ease });
        }
        el.style.transform = '';
        return;
      }
      const side: 1 | -1 = at < 0 ? 1 : -1;
      el.style.transform = '';
      if (!reducedMotion()) {
        // The old content as a ghost, exactly where the finger left it, over the new one.
        const ghost = el.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('id');
        ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
        ghost.setAttribute('aria-hidden', 'true');
        ghost.setAttribute('inert', '');
        ghost.dataset.calendarGhost = '';
        // Placed by the boxes (the area is `relative`): the same spot, whatever sits between the area and the days.
        const a = area.getBoundingClientRect();
        const d = el.getBoundingClientRect();
        Object.assign(ghost.style, { position: 'absolute', left: `${d.left - a.left}px`, top: `${d.top - a.top}px`, width: `${el.offsetWidth}px`, margin: '0', pointerEvents: 'none', transform: `translateX(${at}px)` });
        area.appendChild(ghost);
        pending.current = { ghost, side, from: at };
      }
      step.current(side);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      reset();
      if (el) el.style.transform = '';
    };
    const click = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };
    area.addEventListener('pointerdown', down);
    area.addEventListener('pointermove', move);
    area.addEventListener('pointerup', up);
    area.addEventListener('pointercancel', cancel);
    area.addEventListener('click', click, true);
    return () => {
      area.removeEventListener('pointerdown', down);
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerup', up);
      area.removeEventListener('pointercancel', cancel);
      area.removeEventListener('click', click, true);
    };
  }, [ref, target]);

  /** Call once the new content has mounted (a layout effect on the month / week): old and new slide together. */
  return function slideIn(): boolean {
    const p = pending.current;
    pending.current = null;
    const el = ref.current?.querySelector<HTMLElement>(target) ?? null;
    if (!p) return false;
    const w = el?.offsetWidth ?? p.ghost.offsetWidth;
    const done = () => p.ghost.remove();
    if (!el?.animate || !p.ghost.animate) {
      done();
      return true;
    }
    const opts = { duration: CALENDAR_SWIPE.slideMs, easing: CALENDAR_SWIPE.ease };
    p.ghost.animate([{ transform: `translateX(${p.from}px)` }, { transform: `translateX(${-p.side * w}px)` }], opts).onfinish = done;
    el.animate([{ transform: `translateX(${p.side * w + p.from}px)` }, { transform: 'none' }], opts);
    return true;
  };
}
