/**
 * 🎚 MOVEMENT IS A FEEL, AND EACH PHASE HOLDS ITS OWN (owner 2026-10-09, verbatim: *"movement independent from each. not
 * universal for all"* · *"i thought this would be like how does the effect execute its effect, calmly, cinematic,
 * etc"*).
 *
 * A feel is TEMPO and nothing else — the one thing the old presets (`HUB_PRESET_BODY`) differed in once the effect
 * (Fade · Move …, the chips' job) and the drive (on arrival · with the scroll · the hand-off to the next scene) are
 * taken away: 0.6 s · 1.1 s · 1.8 s, and the gap between parts. Easing, travel and the lift are one fixed drawing for
 * every preset, so there is nothing else for a feel to be.
 *
 * WHERE EACH PHASE KEEPS ITS FEEL (every field but one shipped before this file):
 *
 *                 Build in                                  Build out
 *   a part        `motion.speed`      fast · — · gentle      `motion.outSpeed`   fast · — · gentle
 *   a scene       `duration` + `stagger`  0.6 · 1.1 · 1.8    `outSpeed`          fast · — · gentle   (NEW, 2026-10-09)
 *   Auto scroll   —                                          `autoSpeed`         fast · — · slow
 *
 * Calm is what plays when nothing is stored (a part's regular speed, a scene's regular way out, an Auto run's normal
 * speed), so there is no separate "Auto": the word shown is always what PLAYS (`sceneInFeel` for the one case with
 * two answers).
 *
 * ⛔ A feel NEVER writes an effect, a side, the Action or the drive — `layScene*Feel` touch only the fields above.
 * Action has no feel: a scene's lift follows the scroll over one fixed distance and a part's drift is one fixed loop.
 *
 * Imported only by the toolbar's lazy pieces (`scene-animate-tab.tsx`, `element-sheet.tsx`) — never by a Maker
 * first-load file. Guard: `lib/movement-is-a-feel-per-phase.test.ts`.
 */
import type { HubElSpeed } from './element-style';
import type { HubSectionCanvas } from './hub-canvas';
import type { HubAutoSpeed } from './hub-scenes';

export const ANIMATE_FEELS = ['quick', 'calm', 'cinematic'] as const;
export type AnimateFeel = (typeof ANIMATE_FEELS)[number];
export const ANIMATE_FEEL_LABEL: Record<AnimateFeel, string> = { quick: 'Quick', calm: 'Calm', cinematic: 'Cinematic' };

/** A timed Build in's seconds — the shipped three (`HUB_DURATION`; a part's Fast · Regular · Gentle are the same). */
export const FEEL_SECONDS: Record<AnimateFeel, number> = { quick: 0.6, calm: 1.1, cinematic: 1.8 };
/**
 * The gap between a scene's parts when they arrive one after another (`HUB_STAGGER`) — Calm's and Cinematic's own.
 * Quick takes Calm's: the old "Still" row's 0 would make "one after another" arrive together.
 */
export const FEEL_GAP: Record<AnimateFeel, number> = { quick: 0.12, calm: 0.12, cinematic: 0.25 };

const of = <K extends string>(quick: K, cinematic: K) => (stored: unknown): AnimateFeel => (stored === quick ? 'quick' : stored === cinematic ? 'cinematic' : 'calm');

/** The feel a number of seconds is (0.6 → Quick, 1.8 → Cinematic, anything else Calm). */
export function feelOfSeconds(seconds: number): AnimateFeel {
  return seconds === FEEL_SECONDS.quick ? 'quick' : seconds === FEEL_SECONDS.cinematic ? 'cinematic' : 'calm';
}

/* ── a scene ─────────────────────────────────────────────────────────────── */

/**
 * Build in: what PLAYS. On arrival that is the resolved duration — its own, else the stored preset's (a scene saved
 * with the old Cinematic preset and played on arrival reads Cinematic, nothing rewritten). Following the scroll, a
 * preset's seconds never played (the arrival ran one fixed range), so only a duration the couple set themselves
 * counts — exactly the rule `hubCanvasVars` draws `--hub-in-end` by.
 */
export function sceneInFeel(canvas: Pick<HubSectionCanvas, 'duration'>, resolved: { timeline: 'time' | 'scrub'; duration: number }): AnimateFeel {
  return feelOfSeconds(resolved.timeline === 'scrub' ? (canvas.duration ?? FEEL_SECONDS.calm) : resolved.duration);
}
export const sceneOutFeel = (canvas: Pick<HubSectionCanvas, 'outSpeed'>): AnimateFeel => of('fast', 'gentle')(canvas.outSpeed);

/** Build in's feel, written into the scene: its seconds and its gap. Nothing else. */
export function laySceneInFeel(c: HubSectionCanvas, feel: AnimateFeel): void {
  c.duration = FEEL_SECONDS[feel];
  c.stagger = FEEL_GAP[feel];
}
/** Build out's feel, written into the scene: Calm is the absence. Nothing else. */
export function laySceneOutFeel(c: HubSectionCanvas, feel: AnimateFeel): void {
  if (feel === 'calm') delete c.outSpeed;
  else c.outSpeed = feel === 'quick' ? 'fast' : 'gentle';
}

/* ── a part ──────────────────────────────────────────────────────────────── */

/** A part's stored speed (its In's `speed`, its Out's `outSpeed`) as a feel. */
export const partFeel = (speed: HubElSpeed | undefined): AnimateFeel => of('fast', 'gentle')(speed);
/** …and the feel as the speed to store — null for Calm (regular is the absence). */
export const partSpeedOf = (feel: AnimateFeel): HubElSpeed | null => (feel === 'quick' ? 'fast' : feel === 'cinematic' ? 'gentle' : null);

/* ── an Auto scroll hand-off ─────────────────────────────────────────────── */

export const autoFeel = (speed: HubAutoSpeed | undefined): AnimateFeel => of('fast', 'slow')(speed);
export const autoSpeedOf = (feel: AnimateFeel): HubAutoSpeed => (feel === 'quick' ? 'fast' : feel === 'cinematic' ? 'slow' : 'normal');

/* ── why Movement cannot be used (the tap says it) ───────────────────────── */

export const FEEL_OFF = {
  noEffect: 'Turn on Fade, Blur, Move or Size first.',
  scrub: 'Scrub out follows your thumb, so it has no speed of its own.',
  arrival: 'Build out plays when this follows the scroll.',
} as const;

/** Leaves ◆ — the scene's hand-off to the next one (the stored `transition`), in the owner's words; ◆ on the two that are Pro. */
export const LEAVES_OPTIONS = [
  { key: 'scroll', label: 'As it scrolls away' },
  { key: 'scrub', label: 'Scrub out ◆' },
  { key: 'auto', label: 'Auto scroll ◆' },
] as const;
