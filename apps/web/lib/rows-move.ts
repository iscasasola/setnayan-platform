/**
 * rows-move.ts — ROWS MOVE BY TRANSFORM, NEVER BY HEIGHT (the motion standard, owner 18 Nov 2026; specs
 * `MOTION_STANDARD_2026-11-18.md` § 3 rule 2 + § 4: Leave #6 · Open #9 · Enter (row arrives) #13).
 *
 * A list that changes — a row removed, a row added, a fold opened — is laid out ONCE, at once, and what the eye sees
 * is played over it with `transform` and `opacity` only ("measure once, then move with transform"):
 *
 *   · `slideBelow`   — everything under a box that just changed height slides from where it was to where it is
 *                      (Open: Move on Settle). Interrupted, it turns around from where it is.
 *   · `rowLeaves`    — a removed row's still copy slides out (Quick on Settle), then the rows under it close the gap
 *                      (Move on Settle). Never a height animated.
 *   · `rowArrives`   — a row added to a list that was already drawn comes in 8 px up (Move on Settle) with a soft
 *                      wash that fades over Rise. Only the first `CASCADE_ROWS` of a batch cascade, `CASCADE_STEP_MS`
 *                      apart; the rest are simply there. A list's first drawing never plays (nothing flashes over
 *                      the server's own HTML).
 *
 * Reduced motion: nothing here plays — the list moves at once. Every animation fills `backwards` or not at all, so
 * nothing is left holding a transform (a held transform unpins every `position: fixed` child).
 * 🔒 lib/the-motion-core-moves-by-transform.test.ts
 */
import { EASE_SETTLE, EASE_SPRING_FALLBACK, EASE_SPRING_LINEAR, MOVE_MS, QUICK_MS, RISE_MS_STANDARD } from './motion-table';

/** House rule 4: cascade only the first six rows; the rest appear at once. */
export const CASCADE_ROWS = 6;
/** …each this long after the one before. */
export const CASCADE_STEP_MS = 60;
/** How far a row rises as it arrives. */
export const ROW_RISE_PX = 8;
/** The most boxes one change will move (a very long page moves its first screens; the rest is off screen anyway). */
export const ROWS_MOVE_MAX = 80;

const MOVE_ID = 'sn-rows-move';

export const motionReduced = (): boolean =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/** Spring for a Web Animations call: the real `linear()` spring where the browser reads it, else the cubic fallback
 *  (an easing the browser cannot parse makes `animate()` throw). */
export function springEasing(): string {
  try {
    if (typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)')) return EASE_SPRING_LINEAR;
  } catch {
    /* fall through */
  }
  return EASE_SPRING_FALLBACK;
}

const canPlay = (el: Element | null | undefined): el is HTMLElement =>
  Boolean(el) && typeof (el as HTMLElement).animate === 'function' && typeof document !== 'undefined' && document.visibilityState !== 'hidden';

/**
 * Everything that sits BELOW `el` in the flow: its following siblings, then its parent's, and so on up — stopping at
 * the box that scrolls on its own (a sheet's body), at <body>, or at `ROWS_MOVE_MAX`.
 */
export function belowOf(el: Element, max = ROWS_MOVE_MAX): HTMLElement[] {
  const out: HTMLElement[] = [];
  let node: Element | null = el;
  for (let depth = 0; node && depth < 8 && out.length < max; depth++) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent || parent === document.documentElement) break;
    for (let n = node.nextElementSibling; n && out.length < max; n = n.nextElementSibling) {
      if (n instanceof HTMLElement) out.push(n);
    }
    if (parent === document.body) break;
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) break;
    node = parent;
  }
  return out;
}

const topsOf = (els: readonly HTMLElement[]): number[] => els.map((e) => e.getBoundingClientRect().top);

function stopMoves(els: readonly HTMLElement[]): void {
  for (const e of els) for (const a of e.getAnimations()) if (a.id === MOVE_ID) a.cancel();
}

/** Play each box from `dy` px away back to its own place. */
function slideFrom(els: readonly HTMLElement[], dys: readonly number[], delay = 0): void {
  els.forEach((e, i) => {
    const dy = dys[i] ?? 0;
    if (Math.abs(dy) < 1) return;
    e.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], {
      duration: MOVE_MS,
      easing: EASE_SETTLE,
      delay,
      fill: delay > 0 ? 'backwards' : 'none',
      id: MOVE_ID,
    });
  });
}

/**
 * OPEN — `el` has just changed height (a fold opened or shut; the new layout is already on the page). `undo` puts the
 * OLD layout back for one measure and returns the function that restores the new one. Everything below then slides
 * from the old place to the new one as one piece. A slide already in flight is picked up from where it is.
 */
export function slideBelow(el: HTMLElement, undo: () => () => void): void {
  if (!canPlay(el) || motionReduced()) return;
  const els = belowOf(el);
  if (els.length === 0) return;
  const seen = topsOf(els); // the new layout, plus whatever a slide in flight still adds
  stopMoves(els);
  const after = topsOf(els);
  const redo = undo();
  const before = topsOf(els);
  redo();
  slideFrom(
    els,
    els.map((_, i) => before[i]! + (seen[i]! - after[i]!) - after[i]!),
  );
}

/**
 * LEAVE — call while `el` (a row about to be removed) is still on the page; the removal itself is the caller's. Once
 * it has gone: a still copy slides out to the left (Quick on Settle) and the rows under it close the gap by transform
 * (Move on Settle), after the slide. If the row was not removed, or the whole list left with it, nothing plays.
 */
export function rowLeaves(el: HTMLElement): void {
  if (!canPlay(el) || motionReduced()) return;
  const rect = el.getBoundingClientRect();
  if (rect.height < 1 || rect.width < 1) return;
  const homes = [el.parentElement, el.parentElement?.parentElement, el.parentElement?.parentElement?.parentElement];
  const below = belowOf(el);
  const before = topsOf(below);
  const ghost = el.cloneNode(true) as HTMLElement;
  queueMicrotask(() => {
    if (el.isConnected) return; // it stayed (the effect was only cleaned up)
    if (!homes.some((h) => h && h.isConnected)) return; // the list left with it — a page change, not a removal
    for (const n of [ghost, ...Array.from(ghost.querySelectorAll('[id]'))]) n.removeAttribute('id');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    ghost.classList.add('sn-m-row-ghost');
    Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    // Inside a sheet or a full screen the copy stays on THAT layer (on <body> it would slide out underneath it).
    const home = homes.find((h) => h && h.isConnected);
    (home?.closest('[role="dialog"]') ?? document.body).appendChild(ghost);
    const gone = () => ghost.remove();
    ghost
      .animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-110%)', opacity: 0 }], { duration: QUICK_MS, easing: EASE_SETTLE, fill: 'forwards' })
      .finished.then(gone, gone);
    const still = below.map((e, i) => ({ e, top: before[i]! })).filter((x) => x.e.isConnected);
    const els = still.map((x) => x.e);
    stopMoves(els);
    const after = topsOf(els);
    slideFrom(
      els,
      still.map((x, i) => x.top - after[i]!),
      QUICK_MS,
    );
  });
}

/* ── ENTER · a row arrives ──────────────────────────────────────────────────────────────────────────────────────── */
/** Lists (a row's parent and grandparent) that have already drawn rows — a row mounting into one is an ARRIVAL. */
const drawn = new WeakSet<Element>();
let batch: HTMLElement[] = [];

function playArrivals(): void {
  const rows = batch.filter((r) => r.isConnected);
  batch = [];
  if (rows.length === 0 || motionReduced()) return;
  rows.slice(0, CASCADE_ROWS).forEach((row, i) => {
    if (!canPlay(row)) return;
    row.animate([{ opacity: 0, transform: `translateY(${ROW_RISE_PX}px)` }, { opacity: 1, transform: 'translateY(0)' }], {
      duration: MOVE_MS,
      easing: EASE_SETTLE,
      delay: i * CASCADE_STEP_MS,
      fill: 'backwards',
    });
  });
  // The wash marks ONE new row (a batch is a list being redrawn — a wash on each would be noise).
  const one = rows.length === 1 ? rows[0] : null;
  if (one && canPlay(one)) {
    const wash = document.createElement('span');
    wash.className = 'sn-m-row-wash';
    wash.setAttribute('aria-hidden', 'true');
    one.appendChild(wash);
    const gone = () => wash.remove();
    wash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: RISE_MS_STANDARD, easing: EASE_SETTLE, fill: 'forwards' }).finished.then(gone, gone);
  }
}

/**
 * ENTER — call once when a row mounts. The first drawing of a list is simply there; a row that mounts into a list
 * already drawn arrives. Rows mounting together are one batch: the first six cascade, the rest are simply there.
 */
export function rowArrives(el: HTMLElement): void {
  if (typeof document === 'undefined') return;
  const homes = [el.parentElement, el.parentElement?.parentElement].filter((h): h is HTMLElement => Boolean(h) && h !== document.body);
  const arrival = homes.some((h) => drawn.has(h));
  queueMicrotask(() => {
    for (const h of homes) drawn.add(h);
  });
  if (!arrival) return;
  batch.push(el);
  if (batch.length === 1) queueMicrotask(playArrivals);
}
