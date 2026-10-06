/**
 * ▶ PLAY REPLAYS THE MOTION THE COUPLE CHOSE — never a stand-in.
 *
 * Owner, desktop screenshot 2026-10-06 (handoff NEXT BUILDS 3; folded into the
 * Stages | Studio build plan §3, PR 2): Schedule › Animate · Editorial · "follows
 * the scroll" · Fade + from the right + Grow + Blur — and ▶ Preview did nothing
 * he could see.
 *
 * 🔴 WHAT WAS PLAYING. The canvas's `play` ran ONE generic fade-up on the whole
 * section (`el.animate`, opacity + 22px) — the same for every choice — while the
 * scene's own arrival (`--hub-in-kf`, `lib/hub-canvas.ts`) stayed bound to the
 * page's SCROLL (`animation-timeline: view()`) or to the first approach
 * (`.pahina-in`, already finished). Brought to the middle of the screen, a
 * "follows the scroll" scene sits at the end of its arrival: nothing moves, and
 * the only thing the couple saw was the stand-in — identical for Calm, Editorial
 * and Cinematic. A control whose preview cannot show what it chose.
 *
 * ✅ WHAT PLAYS NOW. The scene's frame wears `hub-replay` for one arrival
 * (`globals.css`, "PLAY REPLAYS THE CHOSEN MOTION"): its OWN keyframe, on TIME
 * rather than on the scroll, whole or part after part as the scene arrives —
 * restarted from its first frame (`getAnimations` → cancel → play, the browser's
 * own restart). Every part with motion of its own replays its own In
 * (`replayPart`, the bridge's `replayElementIn` — the `-p` twin). The class
 * comes off after the longest arrival, and the page is the page again.
 *
 * Reduced motion: the rules sit behind `prefers-reduced-motion: no-preference`,
 * so nothing moves and the caller flashes the section instead.
 *
 * DOM-shaped but not DOM-bound (duck-typed), so a test can drive it.
 */

/** The class the frame wears for one replay (`globals.css`). */
export const SCENE_REPLAY_CLASS = 'hub-replay';
/** Long enough for the slowest arrival: 1.1s + seven staggers of 0.12s, and a margin. */
export const SCENE_REPLAY_MS = 2600;

type Anim = { animationName?: string; cancel(): void; play(): void };
type Classes = { add(c: string): void; remove(c: string): void };
export type ReplayNode = {
  classList: Classes;
  matches(sel: string): boolean;
  querySelector(sel: string): ReplayNode | null;
  querySelectorAll(sel: string): ArrayLike<ReplayNode>;
  getAnimations?(opts?: { subtree?: boolean }): readonly Anim[];
  offsetWidth?: number;
};

/** The scene's frame — the element that carries its motion (`.hub-canvas`, `hub-canvas-frame.tsx`). */
export function sceneFrameOf(section: ReplayNode): ReplayNode | null {
  return section.matches('.hub-canvas') ? section : section.querySelector('.hub-canvas');
}

/** An arrival — never a departure (`hub-out-*`, `el-out-*`) or a while-on-screen (`*-during-*`). */
export function isArrival(name: string | undefined): boolean {
  return typeof name === 'string' && /^(hub|el)-in-/.test(name);
}

/**
 * Replay one scene's arrival — its own, and each of its parts'. Returns how many
 * things it set moving; 0 = nothing chose motion here (the caller flashes).
 */
export function replaySceneIn(
  section: ReplayNode,
  opts: {
    /** A part's own In (`replayElementIn`): true when it had one to replay. */
    replayPart: (part: ReplayNode) => boolean;
    /** `window.setTimeout`, handed in. */
    later: (fn: () => void, ms: number) => void;
  },
): number {
  let moved = 0;
  const frame = sceneFrameOf(section);
  if (frame) {
    frame.classList.remove(SCENE_REPLAY_CLASS);
    // Read layout once so the class's removal and its return are two style changes, not none.
    void frame.offsetWidth;
    frame.classList.add(SCENE_REPLAY_CLASS);
    for (const a of frame.getAnimations?.({ subtree: true }) ?? []) {
      if (!isArrival(a.animationName)) continue;
      try {
        a.cancel();
        a.play();
        moved += 1;
      } catch {
        /* an animation the browser will not restart keeps its place */
      }
    }
    opts.later(() => frame.classList.remove(SCENE_REPLAY_CLASS), SCENE_REPLAY_MS);
  }
  const parts = section.querySelectorAll('[data-el]');
  for (let i = 0; i < parts.length; i++) if (opts.replayPart(parts[i]!)) moved += 1;
  return moved;
}
