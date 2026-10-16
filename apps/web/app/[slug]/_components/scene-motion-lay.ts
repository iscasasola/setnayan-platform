/**
 * 🎬 A SCENE'S MOTION, ON THE CANVAS AT THE PICK — and played once (the 2026-10-15 Animate walk, F5 · F10).
 *
 * 🔴 What was measured: picking a scene's Build in (every effect, every scene) showed NOTHING on the canvas — the save
 * redrew the page in a hidden buffered frame, where the arrival (if it played at all) was over before the frame was
 * swapped in; only ▶ showed it. And ▶ could play the PREVIOUS pick: the shown frame was still the one drawn before
 * the last save (Move-from-bottom played instead of left; To-top instead of To-bottom).
 *
 * ✅ The Maker (`scene-animate-tab.tsx`) works out the scene's motion classes and values with the page's OWN functions
 * (`hubCanvasClass` · `hubCanvasVars`) and sends them here with the pick; the bridge lays them on the scene's frame on
 * screen now — so the frame ▶ plays always wears the latest pick — and plays the picked phase once
 * (`playSequence`, ▶'s own player). The redraw that follows carries the same values from the server. A new frame
 * that loads behind is told the latest pick too (its `ready`), so a redraw drawn before the pick never brings the old
 * one back.
 *
 * 🔒 THE BRIDGE TRUSTS NOTHING IT IS SENT: only the motion classes (`hub-seq-* · hub-in-* · hub-out-* · hub-during-* ·
 * hub-tl-*`, closed words) and only the motion custom properties, with values in a plain character set, are laid —
 * anything else is dropped. Nothing but motion is ever touched (the scene's photo, colour, shape stay as drawn).
 * Pure enough to test (duck-typed DOM). Guard: `lib/a-scene-pick-plays-on-the-canvas.test.ts`.
 */

/** A class this lays: the scene's motion classes, and nothing else on the frame. */
export const SCENE_MOTION_CLASS = /^hub-(?:seq|in|out|during|tl)-[a-z0-9_]{1,40}$/;
/** A custom property this lays: the motion's own (`hubCanvasVars`), never the photo's or the colour's. */
export const SCENE_MOTION_VAR = /^--hub-(?:in|out)(?:-[a-z]{1,8})?$|^--hub-(?:duration|stagger|ease)$/;
/** …with a value made of a closed character set: keyframe names, numbers, `translate3d(…)`, `blur(…)`, `entry min(…)`. */
const SAFE_VALUE = /^[a-zA-Z0-9 %().,_-]{0,120}$/;

export type SceneMotionMessage = { source: 'setnayan-editor'; t: 'sceneMotion'; key: string; classes: string[]; vars: Record<string, string>; play: 'in' | 'act' | 'out' | null };

/** What the Maker sends: the motion classes out of `hubCanvasClass`, the motion values out of `hubCanvasVars`. */
export function sceneMotionMessage(key: string, classList: string, vars: Record<string, string>, play: SceneMotionMessage['play']): SceneMotionMessage {
  return {
    source: 'setnayan-editor',
    t: 'sceneMotion',
    key,
    classes: classList.split(/\s+/).filter((c) => SCENE_MOTION_CLASS.test(c)),
    vars: Object.fromEntries(Object.entries(vars).filter(([k]) => SCENE_MOTION_VAR.test(k))),
    play,
  };
}

/** What the bridge accepts of it — null when it is not a scene's motion at all. */
export function readSceneMotion(raw: unknown): { classes: string[]; vars: Array<[string, string]>; play: SceneMotionMessage['play'] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as { classes?: unknown; vars?: unknown; play?: unknown };
  if (!Array.isArray(m.classes) || !m.vars || typeof m.vars !== 'object') return null;
  const classes = m.classes.filter((c): c is string => typeof c === 'string' && SCENE_MOTION_CLASS.test(c)).slice(0, 8);
  const vars = Object.entries(m.vars as Record<string, unknown>)
    .filter((e): e is [string, string] => SCENE_MOTION_VAR.test(e[0]) && typeof e[1] === 'string' && SAFE_VALUE.test(e[1]))
    .slice(0, 16);
  const play = m.play === 'in' || m.play === 'act' || m.play === 'out' ? m.play : null;
  return { classes, vars, play };
}

type Frame = {
  classList: { add(c: string): void; remove(c: string): void; [Symbol.iterator]?: () => Iterator<string> } & ArrayLike<string>;
  style: { setProperty(k: string, v: string): void; removeProperty(k: string): void } & ArrayLike<string>;
};

/** Lay a scene's motion on its frame: its old motion classes and values off, the new ones on. Nothing else moves. */
export function laySceneMotion(frame: Frame, motion: { classes: string[]; vars: Array<[string, string]> }): void {
  const oldClasses = Array.from(frame.classList as ArrayLike<string>).filter((c) => SCENE_MOTION_CLASS.test(c));
  for (const c of oldClasses) frame.classList.remove(c);
  for (const c of motion.classes) frame.classList.add(c);
  const oldVars = Array.from(frame.style as ArrayLike<string>).filter((p) => SCENE_MOTION_VAR.test(p));
  for (const p of oldVars) frame.style.removeProperty(p);
  for (const [p, v] of motion.vars) frame.style.setProperty(p, v);
}
