/**
 * lib/scene-shade-bar.ts — 🌗 A SCENE PICTURE'S "DARKER ↔ LIGHTER" AS ONE LINE BAR (owner 2026-10-09, verbatim:
 * *"darker lighter line bar"*; `TOOLBAR-SPEC-2026-10-09.md` § BACKGROUND, row 3). It was a dropdown of three words.
 *
 * The bar is the Look's own line (−100 … 100, the centre is "as is" and stores nothing — `lib/background-fade.ts`).
 * THIS file says what a position MEANS for a scene: where the stored value sits on the bar, where a release
 * settles, and what is stored for it.
 *
 * ⚙ TODAY A SCENE STORES ONE OF TWO WORDS (`HubSectionCanvas.shade`: 'darker' | 'lighter'), so the bar has THREE
 * STOPS — Darker · As is · Lighter, at the places the Look gives those words (−70 · 0 · +70): a release settles on
 * the nearest, and the page shows that stop while the thumb moves. Nothing new is stored.
 */
import type { HubSectionCanvas } from './hub-canvas';

type Shade = HubSectionCanvas['shade'];

/** The bar's ends. */
export const SCENE_SHADE_MIN = -100;
export const SCENE_SHADE_MAX = 100;
/** Where the two stored words sit — the Look's own places for them (`HUB_MAIN_SHADE_AT`). */
export const SCENE_SHADE_WORD_AT = { darker: -70, lighter: 70 } as const;
/** Every position a release can settle on — null: any whole position. */
export const SCENE_SHADE_STOPS: readonly number[] | null = [SCENE_SHADE_WORD_AT.darker, 0, SCENE_SHADE_WORD_AT.lighter];

const clamp = (n: number) => (Number.isFinite(n) ? Math.max(SCENE_SHADE_MIN, Math.min(SCENE_SHADE_MAX, Math.round(n))) : 0);

/** The position the stored value reads at (nothing stored = the centre). */
export function sceneShadeAt(shade: Shade | null | undefined): number {
  return shade === 'darker' ? SCENE_SHADE_WORD_AT.darker : shade === 'lighter' ? SCENE_SHADE_WORD_AT.lighter : 0;
}

/** Where a release at `at` settles: the nearest stop. */
export function sceneShadeSettled(at: number): number {
  const n = clamp(at);
  return (SCENE_SHADE_STOPS ?? [n]).reduce((best, stop) => (Math.abs(stop - n) < Math.abs(best - n) ? stop : best));
}

/** What is stored for a settled position — the centre stores NOTHING. */
export function sceneShadeOf(at: number): Shade | undefined {
  const n = sceneShadeSettled(at);
  return n < 0 ? 'darker' : n > 0 ? 'lighter' : undefined;
}

/** What the bar says for a position, to a screen reader. */
export function sceneShadeWords(at: number): string {
  const n = sceneShadeSettled(at);
  return n === 0 ? 'As is' : n < 0 ? 'Darker · light words' : 'Lighter';
}
