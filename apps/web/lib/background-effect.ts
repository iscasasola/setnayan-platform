/**
 * lib/background-effect.ts — WHAT ONE TAP IN STUDIO › LOOK › BACKGROUND › EFFECTS WRITES.
 *
 * Owner 2026-10-08 (DECISION_LOG "LOOK EFFECTS ROUND 4" · "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A): six effects on top of the background, one at a time,
 * each with How much ▾ and a Colour ▾. The effect is stored ON the main background (`main.effect`,
 * `lib/hub-canvas.ts`) — so every rule about what a tap writes is a rule about that one key:
 *
 *   · an effect is put on, changed or taken off WITHOUT touching the background under it (`withEffect`);
 *   · picking ANOTHER background keeps the effect that was on (`keepEffect`) — it lies on whatever is there;
 *   · turned on from None over a ground that MOVES, it starts at its gentlest (`effectStart`) — two things moving at
 *     full strength is too much (the note, round 5); over a still ground it starts at Standard;
 *   · an event that stored no background at all has one written with its first effect: the page's own
 *     (`{ ground: 'theme' }`), which draws exactly what "nothing stored" draws.
 *     ⚠ ONE CONSEQUENCE, said in the changelog: "the page's own" is a CHOICE, so a cover photo added later no
 *     longer becomes the background by itself (`heroNeedsMeasuring`).
 *
 * ◆ A PRO EFFECT IS TRIED, NEVER APPLIED (the approved gallery, kind 20 "Pro mark"): a couple without Event Hub
 * Pro may tap one — the sample screen wears it — but nothing is written, and one note offers See Pro / Not now.
 *
 * Pure. Held by `lib/the-effects-are-picked-on-the-sample.test.ts`.
 */
import { AMBIENT_EFFECT_IS_PRO, AMBIENT_EFFECT_LABEL } from './ambient-effects';
import {
  hubMainEffect,
  isHubMainLoop,
  isHubMainOwn,
  type HubMainEffect,
  type HubMainEffectColour,
  type HubMainEffectIntensity,
  type HubMainEffectKind,
  type HubMainGround,
} from './hub-canvas';

/** The page's own background — what "nothing stored" draws. */
const PAGES_OWN: HubMainGround = { ground: 'theme' };

/** The background with `effect` on it (null: taken off) — every other key exactly as it was. */
export function withEffect(main: HubMainGround | null, effect: HubMainEffect | null): HubMainGround {
  const { effect: _was, ...under } = (main ?? PAGES_OWN) as HubMainGround & { effect?: unknown };
  return (effect ? { ...under, effect } : under) as HubMainGround;
}

/** ANOTHER background was picked: the effect that was on stays on. (A write that is ABOUT the effect never passes here.) */
export function keepEffect(next: HubMainGround | null, was: HubMainGround | null): HubMainGround | null {
  const effect = hubMainEffect(was);
  if (!effect || hubMainEffect(next)) return next;
  return withEffect(next, effect);
}

/** Does the ground under the effect MOVE — a video of ours, the page's own film, a clip of theirs? */
export function groundMoves(main: HubMainGround | null, themeHasLoop: boolean): boolean {
  if (isHubMainLoop(main)) return true;
  if (isHubMainOwn(main)) return main.kind === 'snippet';
  if (!main || ('ground' in main && main.ground === 'theme')) return themeHasLoop;
  return false;
}

/** How much an effect starts at when it is turned ON: its gentlest over a ground that moves, else Standard. */
export function effectStart(main: HubMainGround | null, themeHasLoop: boolean): HubMainEffectIntensity {
  return groundMoves(main, themeHasLoop) ? 'subtle' : 'standard';
}

/**
 * The effect a tap on a card asks for. Switching from one effect to another keeps How much and the Colour (they are
 * the couple's own answers); turning one on from None starts at `effectStart`, in the effect's own colour.
 */
export function effectPicked(kind: HubMainEffectKind, on: HubMainEffect | null, main: HubMainGround | null, themeHasLoop: boolean): HubMainEffect {
  if (!on) return { kind, intensity: effectStart(main, themeHasLoop) };
  return { kind, intensity: on.intensity, ...(on.colour ? { colour: on.colour } : {}) };
}

/** How much ▾ / Colour ▾ on the effect that is on (`colour: null` = the effect's own — the key is taken off, never stored). */
export function effectWith(on: HubMainEffect, change: { intensity?: HubMainEffectIntensity; colour?: HubMainEffectColour | null }): HubMainEffect {
  const colour = change.colour === undefined ? (on.colour ?? null) : change.colour;
  return { kind: on.kind, intensity: change.intensity ?? on.intensity, ...(colour ? { colour } : {}) };
}

/** May this tap be WRITTEN? A Pro effect, for a couple without Event Hub Pro, may only be tried. */
export function effectMayApply(kind: HubMainEffectKind, ownsPro: boolean): boolean {
  return ownsPro || !AMBIENT_EFFECT_IS_PRO[kind];
}

/** The note under the cards while a Pro effect is being tried — the approved gallery's own words (kind 20). */
export function effectProNote(kind: HubMainEffectKind): { title: string; body: string; later: string; see: string } {
  return {
    title: `${AMBIENT_EFFECT_LABEL[kind]} is part of Pro`,
    body: 'Pro also gives you scenes, films and your own music. You can keep trying it on the preview.',
    later: 'Not now',
    see: 'See Pro',
  };
}

/** The Colour ▾ key for "the effect's own". Never stored. */
export const EFFECT_COLOUR_ORIGINAL = 'original';
export const EFFECT_COLOUR_ORIGINAL_LABEL = 'Original';
/** The first card: no effect. */
export const EFFECT_NONE = 'none';
export const EFFECT_NONE_LABEL = 'None';

/** What the Effects rows' ⓘ says. */
export const EFFECTS_INFO = 'On top of your background, under the words — one at a time. It never covers what guests read.';
export const EFFECT_COLOUR_INFO = 'Its own colour, or one of your five. A pale colour is deepened on a light page and lightened on a dark one until it shows.';
