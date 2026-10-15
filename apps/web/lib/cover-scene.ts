/**
 * lib/cover-scene.ts — 🖼 THE COVER SCENE: the cover's words as ONE group, filling the whole first screen.
 *
 * Owner-approved 2026-10-15 on `Setnayan/prototypes/maker_cover_group_background_2026-10-14_fable.html`
 * (DECISION_LOG 2026-10-15 "COVER SCENE APPROVED"): *"Cover scene will take up the whole screen initially whatever
 * screen type it is"* · *"Call it Cover Scene"* · Framed = the first screen inset with a rounded margin on the page
 * colour, Full width = edge to edge — "Yes" · the Hero folds into the Cover Scene's Background — "Yes, one
 * background" · Scene ◆ moving backgrounds stay Pro — "Pro".
 *
 * The part (its key, its door, its three grey lines) is `lib/maker-parts.ts` `MAKER_COVER_SCENE`. This module is
 * what the GUEST's page needs of it — so it imports nothing of the Maker and stays out of the Maker's bytes.
 *
 * Pure. No I/O, no React.
 */
import { BACKGROUND_SOURCE_IS_PRO, BACKGROUND_SOURCE_LABEL } from './background-source';
import type { HubCoverGround } from './hub-canvas';

/**
 * 📐 THE WHOLE FIRST SCREEN, ON ANY DEVICE: `100svh` — the SMALL viewport, so a phone's browser bars never cut the
 * words — and `100dvh` where the browser has it (the prototype's own rule). The words are centred in it (The Letter
 * keeps its own foot-of-the-screen column); the page's first scroll begins under it.
 */
export const COVER_SCENE_SCREEN = 'min-h-[100svh] supports-[height:100dvh]:min-h-[100dvh]';
/** …the centred column every design but The Letter lays its words in. */
export const COVER_SCENE_CENTRED = `${COVER_SCENE_SCREEN} flex flex-col justify-center`;

/** The attribute the cover's first screen carries — the guard and the Maker find the Cover Scene by it. */
export const COVER_SCENE_ATTR = 'data-cover-scene';

/* ── its background (`HubSectionCanvas.ground`, the hero row's; sanitised by `sanitizeHubCoverGround`) ─────────── */

/**
 * The Background tool's four sources on the Cover Scene, in the toolbar's order (the prototype's `SOURCES`): The
 * theme's own (nothing stored — today's written card) · Colour · Scene ◆ · Upload ◆.
 */
export const COVER_SCENE_SOURCES = ['theme', 'colour', 'scene', 'own'] as const;
export type CoverSceneSource = (typeof COVER_SCENE_SOURCES)[number];
export const COVER_SCENE_SOURCE_LABEL: Readonly<Record<CoverSceneSource, string>> = {
  theme: 'The theme’s own',
  colour: BACKGROUND_SOURCE_LABEL.colour,
  scene: BACKGROUND_SOURCE_LABEL.scene,
  own: BACKGROUND_SOURCE_LABEL.own,
};
/** ◆ — the shipped rule, never a second one: Colour free; Scene and Upload Event Hub Pro (asked at Apply). */
export const COVER_SCENE_SOURCE_IS_PRO: Readonly<Record<CoverSceneSource, boolean>> = {
  theme: false,
  colour: BACKGROUND_SOURCE_IS_PRO.colour,
  scene: BACKGROUND_SOURCE_IS_PRO.scene,
  own: BACKGROUND_SOURCE_IS_PRO.own,
};
/** The quiet line under The theme's own (the prototype's words). */
export const COVER_SCENE_THEME_LINE = 'The written card on the theme’s own ground — every stage, the poster.';

/** The source a stored Cover Scene background IS — absent: The theme's own. */
export function coverGroundSource(g: HubCoverGround | null | undefined): CoverSceneSource {
  if (!g) return 'theme';
  if (g.kind === 'loop') return 'scene';
  if (g.kind === 'photo' || g.kind === 'snippet') return 'own';
  return 'colour';
}

/** Does the Cover Scene's background ask Apply for Event Hub Pro? (`hub-pro-effect-view.ts` names it there.) */
export function coverGroundIsPro(g: HubCoverGround | null | undefined): boolean {
  return COVER_SCENE_SOURCE_IS_PRO[coverGroundSource(g)];
}

/**
 * 🖼 FRAMED | FULL WIDTH — both the whole first screen tall (owner 2026-10-15, "Yes"): Framed insets the screen with
 * a rounded margin on the page colour (12 px on a phone, the page gutter from `sm`); Full width runs edge to edge.
 * Framed is the default (the absence of `shape`).
 */
export const COVER_SCENE_FRAMED = 'm-3 rounded-[18px] sm:m-6 overflow-hidden';
export const COVER_SCENE_FULL = 'm-0 rounded-none overflow-hidden';
export function coverGroundShape(g: HubCoverGround | null | undefined): 'framed' | 'full' {
  return g?.shape === 'full' ? 'full' : 'framed';
}
