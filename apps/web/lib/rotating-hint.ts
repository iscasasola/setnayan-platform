/**
 * rotating-hint.ts — A BOX'S HINT CYCLES ITS EXAMPLES (owner 2026-11-01, "all yes": *every search and add box shows
 * rotating example hints, like a shopping app's search bar whose placeholder cycles every few seconds*).
 *
 * The ONE mechanism, for every shared text field (the thumb row's field, the Guests add box): the placeholder steps
 * from the box's own name ("Search guests") through its examples, one every `HINT_EVERY_MS`, and back —
 *
 *   · only while the box is EMPTY and NOT focused — a word typed, or a tap into the box, freezes it where it is (the
 *     host is reading it or typing; it must not move under them);
 *   · under reduced motion it never moves: the box shows ONE example, still;
 *   · it writes the input's `placeholder` attribute and nothing else — no React state, so a hint step never re-renders
 *     the page (`use-rotating-hint.ts` is the hook; it holds no state at all).
 *
 * Pure (a target with `value` + `placeholder`, an injected timer), so `rotating-hint.test.ts` drives it without a DOM.
 */

/** About every three seconds (owner 2026-11-01). */
export const HINT_EVERY_MS = 3000;

export type HintTarget = { value: string; placeholder: string };

export type HintEnv = {
  /** `prefers-reduced-motion: reduce` — one still example, no timer. */
  reduced: boolean;
  /** Is the box focused right now? */
  focused: () => boolean;
  /** Run `fn` every `ms`; returns the stop. */
  every: (fn: () => void, ms: number) => () => void;
};

/**
 * Start cycling `target`'s placeholder: `place` (the box's own name), then each of `hints`, round and round. Returns the
 * stop, which puts the box's own name back.
 */
export function startHintCycle(target: HintTarget, place: string, hints: readonly string[], env: HintEnv): () => void {
  const lines = hints.map((h) => h.trim()).filter(Boolean);
  if (lines.length === 0) return () => {};
  const restore = () => {
    target.placeholder = place;
  };
  if (env.reduced) {
    target.placeholder = lines[0]!;
    return restore;
  }
  const seq = [place, ...lines];
  let at = Math.max(0, seq.indexOf(target.placeholder));
  const stop = env.every(() => {
    if (target.value !== '' || env.focused()) return;
    at = (at + 1) % seq.length;
    target.placeholder = seq[at]!;
  }, HINT_EVERY_MS);
  return () => {
    stop();
    restore();
  };
}
