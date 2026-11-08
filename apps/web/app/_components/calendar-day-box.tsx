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
      className={`grid h-[30px] w-[30px] place-items-center rounded-md transition-colors ease-out motion-reduce:transition-none ${
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

/**
 * ↩ THE RETURN RULE (Build 2 row #27, owner: *"when things return, it returns to the last state"*). Closing anything
 * that expanded — a picked day on the Clients month or the Schedule page — glides its scroller back to exactly where it
 * was before it opened (and so the month's compact/open state with it), 520 ms on `cubic-bezier(.33,1,.68,1)`, never a
 * jump. Reduced motion: instant.
 */
export const RETURN_MOTION = { ms: 520, ease: [0.33, 1, 0.68, 1] as const } as const;

/** `cubic-bezier(x1,y1,x2,y2)` as a function of time 0…1 (Newton on x, then y). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
  const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3;
  const dx = (s: number) => 3 * x1 * (1 - s) ** 2 + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s * s;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= (bx(s) - t) / d;
      s = Math.min(1, Math.max(0, s));
    }
    return by(s);
  };
}

/** The element that scrolls `el` (the page itself when nothing nearer does). */
export function scrollerOf(el: HTMLElement | null): HTMLElement {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if (oy === 'auto' || oy === 'scroll') return n; // the nearest scroller, even if it does not overflow yet
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/**
 * Glide `scroller` to `top` with the return motion; returns a stop function.
 *
 * ⚠ It WAITS until `top` is reachable, then glides — the target is never clamped once, up front. Measured (#27, the
 * Clients lab at 375 px, headless Chromium): a picked day shrinks the page to the viewport (992 → 812 px, scroll
 * clamped to 0), and the list grows back only some frames AFTER the let-go's layout effect (still 812 px on the next
 * frame). Clamped up front — or on the first frame — the target was 0 and nothing moved: the jump the rule forbids.
 * Once landed it HOLDS the spot for `RETURN_WAIT_MS` (measured: the page settles 1000 → 992 px a few frames after an
 * instant return and scroll anchoring moved it 8 px off) — and lets go the moment the person touches, scrolls or
 * presses a key, so it never fights them. Reduced motion: one instant step once the spot is reachable, then the hold.
 */
export const RETURN_WAIT_MS = 400;
export function glideScrollTo(scroller: HTMLElement, top: number): () => void {
  const target = () => Math.max(0, Math.min(Math.max(0, scroller.scrollHeight - scroller.clientHeight), top));
  if (typeof requestAnimationFrame === 'undefined') {
    scroller.scrollTop = target();
    return () => {};
  }
  const still = reducedMotion();
  const ease = cubicBezier(...RETURN_MOTION.ease);
  let asked = -1;
  let t0 = -1;
  let landed = -1;
  let from = 0;
  let raf = 0;
  const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  const stop = () => {
    cancelAnimationFrame(raf);
    for (const e of inputs) window.removeEventListener(e, stop, true);
  };
  for (const e of inputs) window.addEventListener(e, stop, { capture: true, passive: true });
  const tick = (now: number) => {
    if (asked < 0) asked = now;
    const to = target();
    if (t0 < 0) {
      // Wait for the page to grow back far enough (or for the cap), then start the clock from where it stands.
      if (to < top - 1 && now - asked < RETURN_WAIT_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      t0 = now;
      from = scroller.scrollTop;
    }
    const t = still || Math.abs(to - from) < 1 ? 1 : Math.min(1, (now - t0) / RETURN_MOTION.ms);
    const at = t >= 1 ? to : from + (to - from) * ease(t);
    if (Math.abs(scroller.scrollTop - at) >= 0.5) scroller.scrollTop = at;
    if (t >= 1 && landed < 0) landed = now;
    if (t < 1 || now - landed < RETURN_WAIT_MS) raf = requestAnimationFrame(tick);
    else stop();
  };
  raf = requestAnimationFrame(tick);
  return stop;
}

/**
 * 🎉 ACCEPT BOOKINGS IS FELT (Build 2 row #29, owner: *"turning off a date did not cross out the date… the date
 * crushing… a celebratory when it is going to turn on"* — prototype v118 `dayMark` · `@keyframes dcrush / dcheer`).
 *
 * The day's mark (its `DayBox`, on the month and on the week strip) moves the moment the switch is flipped — the
 * strike itself is drawn by the calendar at once, from the switch's shown state:
 *   · off → a squash (wide-and-flat, then back) while the strike draws in, 620 ms;
 *   · on  → a pop with a small tilt, 700 ms, and 12 pieces of confetti burst from each visible cell, 820 ms.
 * Reduced motion: nothing moves and no confetti — the strike still changes at once. The confetti is page decoration:
 * it rides at the sticky layer (`--sn-z-sticky`), under the thumb row, the nav and every pop-up.
 */
export const DAY_FEEL = {
  crushMs: 620,
  cheerMs: 700,
  confettiMs: 820,
  pieces: 12,
  ease: DAY_BOX_MOTION.ease,
  confettiEase: 'cubic-bezier(.2,.7,.3,1)',
} as const;
/** The prototype's five (gold · green · blue · pink · deep gold) as the app's tokens — the month's own mark colours. */
const CONFETTI_COLOURS = ['var(--sn-gold-500)', 'rgb(var(--color-ok))', 'rgb(var(--color-info))', 'rgb(var(--color-mulberry))', 'var(--sn-gold-700)'] as const;

/** Squash (off) or pop + confetti (on) every given day mark. Returns how many confetti pieces it threw. */
export function feelDay(boxes: readonly HTMLElement[], off: boolean): number {
  if (reducedMotion()) return 0;
  for (const b of boxes) {
    if (!b.animate) continue;
    if (off) {
      b.animate(
        [
          { transform: 'none', textDecorationColor: 'transparent' },
          { transform: 'scale(1.18,.55)', offset: 0.3 },
          { transform: 'scale(.9,1.1)', textDecorationColor: 'transparent', offset: 0.55 },
          { transform: 'scale(1.04,.96)', offset: 0.75 },
          { transform: 'none', textDecorationColor: 'currentColor' },
        ],
        { duration: DAY_FEEL.crushMs, easing: DAY_FEEL.ease },
      );
    } else {
      b.animate(
        [
          { transform: 'none' },
          { transform: 'scale(1.3) rotate(-4deg)', offset: 0.35 },
          { transform: 'scale(.94) rotate(2deg)', offset: 0.6 },
          { transform: 'scale(1.05)', offset: 0.8 },
          { transform: 'none' },
        ],
        { duration: DAY_FEEL.cheerMs, easing: DAY_FEEL.ease },
      );
    }
  }
  if (off) return 0;
  let thrown = 0;
  for (const b of boxes) {
    const r = b.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > window.innerHeight) continue; // off screen: no burst
    const hold = b.closest<HTMLElement>('[data-dates-week-strip]');
    if (hold && Number(getComputedStyle(hold).opacity) < 0.4) continue; // the folded-away week strip
    thrown += confettiFrom(r.left + r.width / 2, r.top + r.height / 2);
  }
  return thrown;
}

function confettiFrom(cx: number, cy: number): number {
  for (let i = 0; i < DAY_FEEL.pieces; i++) {
    const f = document.createElement('i');
    f.setAttribute('aria-hidden', 'true');
    f.dataset.dayConfetti = '';
    Object.assign(f.style, {
      position: 'fixed',
      left: `${cx - 3.5}px`,
      top: `${cy - 3.5}px`,
      width: '7px',
      height: '7px',
      borderRadius: '28%', // ≈2px on the 7px piece — a confetti shape, relative to its own fixed size (lint:radius allows %)
      pointerEvents: 'none',
      zIndex: 'var(--sn-z-sticky)',
      background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]!,
    });
    document.body.appendChild(f);
    if (!f.animate) {
      f.remove();
      continue;
    }
    const a = (i / DAY_FEEL.pieces) * Math.PI * 2 + Math.random() * 0.4;
    const d = 26 + Math.random() * 22;
    f.animate(
      [
        { transform: 'translate(0,0) rotate(0) scale(.6)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d - 6}px) rotate(${180 + Math.random() * 180}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${Math.cos(a) * d * 1.15}px,${Math.sin(a) * d + 14}px) rotate(360deg) scale(.8)`, opacity: 0 },
      ],
      { duration: DAY_FEEL.confettiMs, easing: DAY_FEEL.confettiEase },
    ).onfinish = () => f.remove();
  }
  return DAY_FEEL.pieces;
}
