/**
 * lift.ts — THE ONE LIFT (MOTION_STANDARD_2026-11-18 § 4 #15; drawing `motion_standard_2026-11-18_fable.html` Part B
 * "Drag lift"; owner 19 Nov 2026 "animations build the rest").
 *
 * "Hold a row and it lifts off the list." Every drag in the app — reorder rows, the seat plan's list, the schedule, the
 * guest list's role drag — lifts the SAME way: the held row grows to 1.03 in Quick on Spring under a shadow that fades
 * in on Settle; the others make room and it drops in Move on Settle. The motion is the `.sn-m-lift` class in
 * globals.css (`scale` + the `::after` shadow's opacity — never the row's `transform`, which is the drag's own
 * translate). This file is how a drag wears it:
 *
 *   · `liftGhost(ghost)` — a drag that carries a COPY of the row under the finger: dress the copy; `@starting-style`
 *     plays the lift the moment it is on the page (no class toggle, no frame wait);
 *   · `ghostAt(x, y)` — the copy's `transform`: the translate ONLY (the scale is the class's);
 *   · `dropGhost(ghost)` — the drop: back to 1 and the shadow gone in Move on Settle, then the copy is removed;
 *   · `liftRow(el)` / `settleRow(el)` — a row that lifts in place (Long press).
 *
 * Reduced motion: no scale — the shadow only, at once; `dropGhost` removes the copy at once.
 */
import { HOLD_MS, MOTION_TABLE } from './motion-table';

/** How long a finger holds still before a row lifts — the standard's one wait (350 ms). */
export const LIFT_HOLD_MS = HOLD_MS;
export const LIFT_SCALE = MOTION_TABLE.liftScale;
export const LIFT_CLASS = 'sn-m-lift';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The translate that puts a ghost's corner at (x, y). The scale is NOT here: the class plays it on `scale`. */
export const ghostAt = (x: number, y: number): string => `translate(${x}px,${y}px)`;

/** Dress a drag's ghost in the Lift. Call it BEFORE the ghost is added to the page, so the entrance plays. */
export function liftGhost(ghost: HTMLElement): void {
  ghost.classList.add(LIFT_CLASS);
  ghost.setAttribute('data-lift-ghost', '');
}

/** The drop: the ghost settles back to its size, its shadow fades, then it is removed. Resolves when it is gone. */
export function dropGhost(ghost: HTMLElement): Promise<void> {
  if (!ghost.isConnected) return Promise.resolve();
  if (reduced() || !ghost.classList.contains(LIFT_CLASS)) {
    ghost.remove();
    return Promise.resolve();
  }
  return new Promise((done) => {
    let over = false;
    const end = () => {
      if (over) return;
      over = true;
      ghost.remove();
      done();
    };
    ghost.setAttribute('data-lift-dropping', '');
    ghost.addEventListener('transitionend', (e) => e.target === ghost && end(), { once: true });
    // A transition that never starts (a hidden tab, a detached box) must not leave the copy on the page.
    window.setTimeout(end, MOTION_TABLE.liftDropMs + 80);
  });
}

/** A row that lifts where it stands (Long press). */
export function liftRow(el: HTMLElement): void {
  el.classList.add(LIFT_CLASS);
  el.setAttribute('data-lifted', '');
}
export function settleRow(el: HTMLElement): void {
  el.removeAttribute('data-lifted');
}
