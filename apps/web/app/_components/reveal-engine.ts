/**
 * 🔭 REVEAL ON OPEN — THE ENGINE (owner 2026-11-04, app-wide: "everytime a group expands, should we pin right under so
 * they see the most of the content of the expanded? this should apply universally?" → "Yes, app-wide").
 *
 * After a USER opens a section and its open motion has SETTLED, if any of it sits below the visible bottom of its scroll
 * box, glide the scroll so the section's HEAD sits on the pin line (just under whatever is already pinned at the top).
 * If the whole section already fits, nothing moves. Reduced motion → one jump, no glide. Any touch, wheel, key or a
 * scroll that is not ours cancels it.
 *
 * Pure: no DOM, no React — everything it reads or writes comes through `RevealEnv`, so the behaviour test drives it under
 * plain Node (`reveal-on-open.test.ts`). The DOM side and the hook live in `reveal-on-open.ts`.
 */

export type RevealEnv = {
  now(): number;
  frame(cb: () => void): number;
  cancelFrame(id: number): void;
  /** The section, head top → content bottom, in viewport px. */
  section(): { top: number; bottom: number };
  /** The scroll box's pin line (top) and its visible bottom, in viewport px. */
  view(): { top: number; bottom: number };
  getScroll(): number;
  setScroll(y: number): void;
  /** Reduced motion: jump, never glide. */
  reduced: boolean;
  /** Subscribe to the user's own input (touch · wheel · pointer · key). Returns the unsubscribe. */
  onInput(cb: () => void): () => void;
};

/** How long the height must hold still before it counts as settled (frames), and the longest we wait for it. */
export const REVEAL_STABLE_FRAMES = 6;
export const REVEAL_MAX_WAIT_MS = 2500;
/** The glide — the press family's one speed (`--sn-pill-dur`). */
export const REVEAL_GLIDE_MS = 450;

// Was this open the user's? — kept in its own small file (the hook carries it on every page); re-exported for the test.
export { isUserOpen } from './reveal-intent';

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Where the scroll should land so the head sits on the pin line — or null when nothing should move. */
export function revealTarget(section: { top: number; bottom: number }, view: { top: number; bottom: number }, scroll: number): number | null {
  if (section.bottom <= view.bottom + 1) return null; // it all fits — leave it
  const delta = section.top - view.top;
  if (delta <= 1) return null; // the head is already at (or above) the line
  return scroll + delta;
}

/**
 * Wait for the layout to settle (the height and the place stop moving — a fold above closing under one-open-at-a-time
 * moves the place), then reveal. Returns cancel.
 */
export function revealAfterSettle(env: RevealEnv, opts: { minWaitMs?: number; maxWaitMs?: number; glideMs?: number } = {}): () => void {
  const minWait = opts.minWaitMs ?? 0;
  const maxWait = opts.maxWaitMs ?? REVEAL_MAX_WAIT_MS;
  const glideMs = opts.glideMs ?? REVEAL_GLIDE_MS;
  let raf = 0;
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    if (raf) env.cancelFrame(raf);
    raf = 0;
    off();
  };
  const off = env.onInput(stop);
  const t0 = env.now();
  let prev = env.section();
  let still = 0;

  const glide = (from: number) => {
    const g0 = env.now();
    let last = from;
    const step = () => {
      raf = 0;
      if (done) return;
      const cur = env.getScroll();
      if (Math.abs(cur - last) > 2) return stop(); // somebody else scrolled — theirs wins
      // Re-read every frame: the pin line moves as the bar above slides away.
      const dest = cur + env.section().top - env.view().top;
      const t = Math.min(1, (env.now() - g0) / glideMs);
      env.setScroll(Math.round(from + (dest - from) * ease(t)));
      last = env.getScroll();
      if (t >= 1) return stop();
      raf = env.frame(step);
    };
    raf = env.frame(step);
  };

  const wait = () => {
    raf = 0;
    if (done) return;
    const r = env.section();
    still = Math.abs(r.top - prev.top) < 0.5 && Math.abs(r.bottom - prev.bottom) < 0.5 ? still + 1 : 0;
    prev = r;
    const waited = env.now() - t0;
    if ((still >= REVEAL_STABLE_FRAMES && waited >= minWait) || waited >= maxWait) {
      const scroll = env.getScroll();
      const dest = revealTarget(r, env.view(), scroll);
      if (dest === null) return stop();
      if (env.reduced) {
        env.setScroll(dest);
        return stop();
      }
      return glide(scroll);
    }
    raf = env.frame(wait);
  };
  raf = env.frame(wait);
  return stop;
}
