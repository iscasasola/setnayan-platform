/**
 * lib/scene-shade-bar.ts — 🌗 A SCENE PICTURE'S "DARKER ↔ LIGHTER" AS ONE LINE BAR (owner 2026-10-09, verbatim:
 * *"darker lighter line bar"*; `TOOLBAR-SPEC-2026-10-09.md` § BACKGROUND, row 3). It was a dropdown of three words.
 *
 * The bar is the Look's own line (−100 … 100, the centre is "as is" and stores nothing — `lib/background-fade.ts`).
 * THIS file says what a position MEANS for a scene: where the stored value sits on the bar, where a release
 * settles, and what is stored for it.
 *
 * 🎚 A SCENE STORES THE POSITION ITSELF (`HubSectionCanvas.shade`, the Look's own shape since 2026-10-09 — a word
 * from before the bar, or a non-zero whole number): a release rests where it is let go, and within ±8 of the centre
 * it IS the centre (the Look's snap). A word stored before reads at the Look's place for it (−70 · +70) and is not
 * rewritten until the couple moves the bar.
 * (Before the stored shape took a number this file had THREE STOPS — Darker · As is · Lighter. Reverting that one
 * commit brings them back and nothing else changes.)
 */
import { fadeClamp, fadeSettled } from './background-fade';
import { HUB_MAIN_FADE_MAX, HUB_MAIN_FADE_MIN, hubMainFadeAt, type HubSectionCanvas } from './hub-canvas';

type Shade = HubSectionCanvas['shade'];

/** The bar's ends. */
export const SCENE_SHADE_MIN = HUB_MAIN_FADE_MIN;
export const SCENE_SHADE_MAX = HUB_MAIN_FADE_MAX;
/** Where the two words stored before the bar sit — the Look's own places for them (`HUB_MAIN_SHADE_AT`). */
export const SCENE_SHADE_WORD_AT = { darker: hubMainFadeAt('darker'), lighter: hubMainFadeAt('lighter') } as const;
/** Every position a release can settle on — null: any whole position. */
export const SCENE_SHADE_STOPS: readonly number[] | null = null;

/** The position the stored value reads at (nothing stored = the centre). */
export function sceneShadeAt(shade: Shade | null | undefined): number {
  return hubMainFadeAt(shade ?? undefined);
}

/** Where a release at `at` settles: where it is — the centre when it is within the snap. */
export function sceneShadeSettled(at: number): number {
  return fadeSettled(at);
}

/** What is stored for a settled position — the centre stores NOTHING. */
export function sceneShadeOf(at: number): Shade | undefined {
  const n = sceneShadeSettled(at);
  return n === 0 ? undefined : n;
}

/** What the bar says for a position, to a screen reader. */
export function sceneShadeWords(at: number): string {
  const n = fadeClamp(sceneShadeSettled(at));
  return n === 0 ? 'As is' : n < 0 ? `Darker ${-n}% · light words` : `Lighter ${n}%`;
}
