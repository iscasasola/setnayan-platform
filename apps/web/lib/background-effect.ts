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
 * ◆ EVERY EFFECT IS PRO, TRIED FREE AND NAMED AT ✓ APPLY (owner 2026-10-16, DECISION_LOG "ALL ANIMATE, EFFECTS,
 * STYLES AND ACCENTS ARE EVENT HUB PRO ◆"; the #6623 pattern). A tap is written to the draft whoever taps it — the
 * sample wears it — and the one gate is Apply (`mainGroundChange` → `mainEffectChange`, lib/hub-draft.ts). Until
 * 2026-10-16 a ◆ effect was tried on the sample and never written, with a See Pro note; that path is gone.
 *
 * Pure. Held by `lib/the-effects-are-picked-on-the-sample.test.ts`.
 */
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

/** The Colour ▾ key for "the effect's own". Never stored. */
export const EFFECT_COLOUR_ORIGINAL = 'original';
export const EFFECT_COLOUR_ORIGINAL_LABEL = 'Original';
/** The first card: no effect. */
export const EFFECT_NONE = 'none';
export const EFFECT_NONE_LABEL = 'None';

/** What the Effects rows' ⓘ says. */
export const EFFECTS_INFO = 'On top of your background, under the words — one at a time. It never covers what guests read.';
export const EFFECT_COLOUR_INFO = 'Its own colour, or one of your five. A pale colour is deepened on a light page and lightened on a dark one until it shows.';

/* ══ 🖼 THE PICTURE — Parallax ◆ · Blur ▾ (Look restudy row 8) ══════════════════════════════════════════════════
   Owner 2026-10-08 (DECISION_LOG "LOOK › BACKGROUND, AMENDED"; approved amendment § 2.A "Effects ▾ on every
   source"): *"Effects: Lantern / Parallax / etc"* · *"parallax is an effect also"*. The background's OWN treatment —
   it moves a little slower than the page (Parallax), or is softened (Blur) — sits in the Effects block beside the
   overlays, on EVERY source: where there is no picture (a colour, a pattern, "just the colour") both are shown OFF
   with the reason, never hidden. Parallax is widened to every picture — a scene still, a theme video, the couple's
   clip — on the shipped page-scroll parallax (`PahinaCoverParallax`); Pro ◆ as it always was (tried free, named at
   Apply). Stored on the main background (`motion: 'parallax'`, `blur`), as before — no new key. */

export type PictureBlur = 'none' | 'soft' | 'strong';
export const PICTURE_BLUR_LABEL: Readonly<Record<PictureBlur, string>> = { none: 'None', soft: 'Soft', strong: 'Strong' };
/** The approved prototype's words under each row — what it does, or why it is off. */
export const PICTURE_LINE = {
  parallax: 'Moves a little slower than the page as guests scroll',
  parallaxOff: 'Needs a picture — a plain colour has nothing to move',
  blur: 'Softens the picture under the words',
  blurOff: 'Needs a picture — a plain colour has nothing to blur',
} as const;

/** Does this background have a picture to move and blur (a photo, a scene, a clip, a video of ours, the cover)? */
export function pictureTakes(main: HubMainGround | null): boolean {
  return Boolean(main) && (isHubMainOwn(main) || isHubMainLoop(main) || (main !== null && 'follow' in main));
}

/** The background with Parallax on or off — every other key exactly as it was. Refused (unchanged) where there is no picture. */
export function withParallax(main: HubMainGround | null, on: boolean): HubMainGround | null {
  if (!main || !pictureTakes(main)) return main;
  const { motion: _was, ...rest } = main as HubMainGround & { motion?: unknown };
  return (on ? { ...rest, motion: 'parallax' } : rest) as HubMainGround;
}

/** The background with Blur set (`none` takes the key off) — every other key exactly as it was. Refused where there is no picture. */
export function withBlur(main: HubMainGround | null, blur: PictureBlur): HubMainGround | null {
  if (!main || !pictureTakes(main)) return main;
  const { blur: _was, ...rest } = main as HubMainGround & { blur?: unknown };
  return (blur === 'none' ? rest : { ...rest, blur }) as HubMainGround;
}

/** The Effects row's closed summary — "Lanterns · Parallax · Blur · Soft", or "Off" (the approved prototype's `effectsSummary`). */
export function effectsSummary(overlay: string | null, picture: { parallax: boolean; blur: PictureBlur } | null): string {
  const parts: string[] = [];
  if (overlay) parts.push(overlay);
  if (picture?.parallax) parts.push('Parallax');
  if (picture && picture.blur !== 'none') parts.push(`Blur · ${PICTURE_BLUR_LABEL[picture.blur]}`);
  return parts.length > 0 ? parts.join(' · ') : 'Off';
}
