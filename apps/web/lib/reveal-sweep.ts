/**
 * reveal-sweep.ts — OPENING A LONG FOLD SHOWS WHAT IS INSIDE, THEN SETTLES ON ITS FIRST ROW.
 *
 * Owner, 2026-11-04 (card maker, "More settings"): "when i opened more settings. we want to scroll so the see all
 * animating then return back to the first one which is price". Controller's call: the FIRST open per visit only.
 *
 * The sweep: a short wait while the fold starts to open → scroll down until its last row is in view → back up until the
 * fold's head sits on the pin line, its first row right under it. ~1.8 s in all. ONLY the scroll moves; rows never do.
 *   · any touch, pointer press, wheel or key from the person stops it AT ONCE and leaves them exactly where they are;
 *   · under "reduce motion" there is no sweep — it settles straight on the first row;
 *   · it scrolls whatever the fold actually scrolls in (a panel that scrolls on its own, else the page), and every
 *     target is re-measured each frame and clamped to what can be scrolled — it can never scroll past the content (the
 *     2026-11-04 blank-screen family, `lib/keep-the-tap-in-place.ts`).
 * 🔒 lib/reveal-sweep.test.ts
 */
import { stopKeepingTheTap } from '@/lib/keep-the-tap-in-place';

export const SWEEP = { waitMs: 300, downMs: 750, holdMs: 150, backMs: 650 } as const;
export const SWEEP_TOTAL_MS = SWEEP.waitMs + SWEEP.downMs + SWEEP.holdMs + SWEEP.backMs;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Where the scroll should be `elapsed` ms in: start → down → back. Pure. */
export function sweepAt(elapsed: number, start: number, down: number, back: number): number {
  const { waitMs, downMs, holdMs, backMs } = SWEEP;
  if (elapsed <= waitMs) return start;
  if (elapsed <= waitMs + downMs) return start + (down - start) * ease((elapsed - waitMs) / downMs);
  if (elapsed <= waitMs + downMs + holdMs) return down;
  const t = Math.min(1, (elapsed - waitMs - downMs - holdMs) / backMs);
  return down + (back - down) * ease(t);
}

/** Everything the runner touches, injected so the cancel rule runs for real without a DOM. */
export type SweepEnv = {
  now: () => number;
  frame: (cb: () => void) => number;
  cancelFrame: (id: number) => void;
  /** Current scroll, the largest it can be, and the targets — re-measured every frame (the fold is still growing). */
  read: () => { scroll: number; max: number; down: number; back: number };
  write: (scroll: number) => void;
  /** Subscribe to the person's own input; returns the unsubscribe. */
  onPersonInput: (stop: () => void) => () => void;
  reducedMotion: boolean;
};

/** Runs the sweep. Returns `stop` (also called by any input from the person). */
export function runRevealSweep(env: SweepEnv): () => void {
  let id = 0;
  let done = false;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const stop = () => {
    if (done) return;
    done = true;
    if (id) env.cancelFrame(id);
    off();
  };
  const off = env.onPersonInput(stop);
  const t0 = env.now();
  // The start is read when the sweep BEGINS, after the wait — a fold shutting above in that time moves the page, and
  // `keep-the-tap-in-place` is still putting it right; the sweep writes nothing until then.
  let start: number | null = null;
  if (env.reducedMotion) {
    // No sweep — wait for the fold to open (it does not animate under reduced motion either), then settle on row one.
    id = env.frame(() => {
      if (done) return;
      const r = env.read();
      env.write(clamp(r.back, r.max));
      stop();
    });
    return stop;
  }
  const step = () => {
    if (done) return;
    const elapsed = env.now() - t0;
    if (elapsed > SWEEP.waitMs) {
      const r = env.read();
      if (start === null) start = r.scroll;
      env.write(clamp(sweepAt(elapsed, start, Math.max(start, r.down), r.back), r.max));
    }
    if (elapsed >= SWEEP_TOTAL_MS) stop();
    else id = env.frame(step);
  };
  id = env.frame(step);
  return stop;
}

/** The DOM side: sweep `fold` (its last row `lastRow`), settling with its head on the pin line. */
export function revealFold(fold: HTMLElement, lastRow: () => HTMLElement | null, opts: { bottomInset?: number } = {}): () => void {
  if (typeof window === 'undefined') return () => {};
  let scroller: HTMLElement | null = null;
  for (let p = fold.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) {
      scroller = p;
      break;
    }
  }
  const viewTop = () => (scroller ? scroller.getBoundingClientRect().top : 0);
  const viewH = () => (scroller ? scroller.clientHeight : window.innerHeight);
  const pinTop = () => (scroller ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sn-pin-top')) || 0);
  const bottomInset = opts.bottomInset ?? 0;
  const env: SweepEnv = {
    now: () => performance.now(),
    frame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (n) => cancelAnimationFrame(n),
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    read: () => {
      const scroll = scroller ? scroller.scrollTop : window.scrollY;
      const max = scroller
        ? scroller.scrollHeight - scroller.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const last = lastRow();
      const lastBottom = last ? last.getBoundingClientRect().bottom - viewTop() : 0;
      const down = scroll + lastBottom - (viewH() - bottomInset);
      const back = scroll + (fold.getBoundingClientRect().top - viewTop()) - pinTop();
      return { scroll, max: Math.max(0, max), down, back };
    },
    write: (v) => {
      // From the first frame the sweep moves the page on purpose — the tap-keeper must not pull it back.
      stopKeepingTheTap();
      if (scroller) scroller.scrollTop = v;
      else window.scrollTo(0, v);
    },
    onPersonInput: (stop) => {
      const evs = ['touchstart', 'pointerdown', 'wheel', 'keydown'] as const;
      for (const e of evs) window.addEventListener(e, stop, { capture: true, passive: true });
      return () => {
        for (const e of evs) window.removeEventListener(e, stop, { capture: true });
      };
    },
  };
  return runRevealSweep(env);
}
