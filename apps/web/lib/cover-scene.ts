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
import { hubGlassOpacity, hubMainFadeAt, type HubCoverGround } from './hub-canvas';
import { compositeOver, requiredScrim } from './hub-legibility';
import { INVITE_THEMES } from './invite-themes';

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

/* ── legibility: the words follow the Cover Scene's OWN ground (`lib/hub-legibility.ts`, free by ruling 2026-09-25) ─ */

/** The two inks the cover's words take — the page's espresso and its paper. */
export const COVER_INK = '#2C2A29';
export const COVER_PAPER = '#FBFAF7';
/** A photo is not measured on the server: its worst case is assumed — a mid, a deep and a bright patch under the words. */
export const COVER_PHOTO_SAMPLES: readonly string[] = ['#7A7A7A', '#2A2A2A', '#D8D8D8'];
const THEME_GLASS_UNDER = '#EDE3D2';

/** The Darker ↔ Lighter bar laid over a ground, as the veil the page draws (black down to −100, white up to +100). */
export function coverShadeVeil(shade: HubCoverGround['shade']): { color: string; opacity: number } | null {
  const at = hubMainFadeAt(shade ?? null);
  if (!at) return null;
  return at < 0 ? { color: '#000000', opacity: Number(((-at / 100) * 0.75).toFixed(2)) } : { color: '#FFFFFF', opacity: Number(((at / 100) * 0.8).toFixed(2)) };
}

/** What lies under the words, as colours to measure: the colour, the glass over the theme's paper, the loop's
 *  measured clusters, or a photo's worst case — each under the shade veil when one is laid. */
export function coverGroundSamples(g: HubCoverGround): string[] {
  let base: string[];
  if (g.kind === 'loop') {
    const m = INVITE_THEMES[g.loop].media;
    base = m ? [m.samples.light, m.samples.dark] : [...COVER_PHOTO_SAMPLES];
  } else if (g.kind === 'photo' || g.kind === 'snippet') base = [...COVER_PHOTO_SAMPLES];
  else if (g.kind === 'glass' || g.kind === 'frost') {
    const tint = g.color ?? '#FFFFFF';
    const a = (hubGlassOpacity(g.opacity) ?? 70) / 100;
    base = [compositeOver(tint, g.kind === 'frost' ? a * 0.65 : a, THEME_GLASS_UNDER)];
  } else base = g.kind === 'color' ? [g.color] : [g.color, compositeOver('#000000', 0.3, g.color), compositeOver('#FFFFFF', 0.3, g.color)];
  const veil = coverShadeVeil(g.shade);
  return veil ? base.map((c) => compositeOver(veil.color, veil.opacity, c)) : base;
}

/**
 * The words' tone over the Cover Scene's ground, and the weakest scrim that holds them at AA over every sample —
 * whichever ink needs the lighter scrim wins (the prototype: slide the bar past the middle and the words flip
 * from cream to ink on their own).
 */
export function coverSceneLegibility(g: HubCoverGround): { tone: 'ink' | 'cream'; scrim: { color: string; opacity: number } } {
  const samples = coverGroundSamples(g);
  const ink = requiredScrim(COVER_INK, COVER_PAPER, samples);
  const paper = requiredScrim(COVER_PAPER, COVER_INK, samples);
  return ink <= paper ? { tone: 'ink', scrim: { color: COVER_PAPER, opacity: ink } } : { tone: 'cream', scrim: { color: COVER_INK, opacity: paper } };
}

/** The CSS a colour or a glass paints with (the prototype's tiles: Plain · Diagonal · Glow · Opaque · Frosted). */
export function coverGroundCss(g: HubCoverGround): string | null {
  if (g.kind === 'color') return g.color;
  if (g.kind === 'diagonal') return `linear-gradient(150deg, ${g.color} 0%, color-mix(in srgb, ${g.color} 70%, #000) 100%)`;
  if (g.kind === 'glow') return `radial-gradient(80% 70% at 50% 40%, color-mix(in srgb, ${g.color} 70%, #fff) 0%, ${g.color} 100%)`;
  if (g.kind === 'glass' || g.kind === 'frost') {
    const a = Math.round((hubGlassOpacity(g.opacity) ?? 70) * (g.kind === 'frost' ? 0.65 : 1));
    return `color-mix(in srgb, ${g.color ?? '#FFFFFF'} ${a}%, ${THEME_GLASS_UNDER})`;
  }
  return null;
}
