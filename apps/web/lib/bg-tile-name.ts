/**
 * 🖼 BACKGROUND'S PICTURE TILES — the name is written ON the tile (owner 2026-10-09, choosing among three drawings:
 * *"A- picture tiles"*; reference `review/bg-tiles.html`): no white sticker under it, so the tile itself must make
 * its name readable, decided per tile from its own colours.
 *
 *   · A FLAT tile (None · Plain · Opaque · Frosted) — its colour under the name is KNOWN, so the name is ink or
 *     white, whichever reads (4.5 : 1, `AA_BODY`). In the narrow band where neither does, the foot fade below.
 *   · A PICTURE (Diagonal · Glow · a ready-made scene · the couple's own photo or clip) — what is under the name is
 *     not known (a measured luminance is the middle of the picture, not its foot; an upload has none). The name
 *     stands on a soft fade at the tile's foot — the picture's own colour, darkened or lightened, never a plate —
 *     strong enough that the name reads over ANY picture: white on a dark fade, or ink on a light one where the
 *     picture is a light one.
 *
 * Also the two glass tiles as what they really draw (they were diagonal stripes, which read as "switched off"):
 * Opaque is the flat tint at its opacity; Frosted is that tint under a soft haze.
 *
 * Imported only by the toolbar's lazy pieces. Guard: `lib/background-is-four-rows.test.ts` (7).
 */
import { AA_BODY, compositeOver, contrastRatio } from './hub-legibility';

export const TILE_INK = '#2C2A29';
export const TILE_WHITE = '#FFFFFF';
/** The foot fade's strength: the least that keeps the name at 4.5 : 1 over the worst picture, rounded up. */
export const TILE_FADE = { dark: 0.55, light: 0.62 } as const;
/** A picture is "a light one" from this measured luminance up. */
export const TILE_LIGHT_FROM = 0.6;

export type TileName = { tone: 'ink' | 'white'; fade: boolean };

/** A flat tile: the colour under the name is `hex`. */
export function tileNameOnFlat(hex: string): TileName {
  const ink = contrastRatio(TILE_INK, hex);
  const white = contrastRatio(TILE_WHITE, hex);
  if (ink >= AA_BODY && ink >= white) return { tone: 'ink', fade: false };
  if (white >= AA_BODY) return { tone: 'white', fade: false };
  if (ink >= AA_BODY) return { tone: 'ink', fade: false };
  return { tone: ink >= white ? 'ink' : 'white', fade: true };
}

/** A picture: the tone from its measured luminance where there is one; the foot fade always. */
export function tileNameOnPicture(lum: number | null): TileName {
  return { tone: lum !== null && lum >= TILE_LIGHT_FROM ? 'ink' : 'white', fade: true };
}

/** The LEAST contrast a faded name can have, whatever the picture: white on the dark fade over white, ink on the light fade over black. */
export function tileFadeFloor(tone: TileName['tone']): number {
  return tone === 'white' ? contrastRatio(TILE_WHITE, compositeOver('#000000', TILE_FADE.dark, '#FFFFFF')) : contrastRatio(TILE_INK, compositeOver('#FFFFFF', TILE_FADE.light, '#000000'));
}

/** Opaque — the tint at the opacity it draws, flat (over white, as a tile is). */
export const TILE_GLASS_ALPHA = { glass: 0.85, frost: 0.5 } as const;
export const tileGlassColour = (tint: string, kind: 'glass' | 'frost'): string => compositeOver(tint.slice(0, 7), TILE_GLASS_ALPHA[kind], '#FFFFFF');
/** Frosted — the soft haze laid over its tint (the reference's: nearly white at the top, lighter still than the tint at the foot). */
export const TILE_HAZE = { top: 0.85, foot: 0.45 } as const;
export const tileFrostCss = (tint: string): string => `linear-gradient(180deg, rgba(255,255,255,${TILE_HAZE.top}), rgba(255,255,255,${TILE_HAZE.foot})), ${tileGlassColour(tint, 'frost')}`;
/** …and the colour under a Frosted tile's name (its foot, the haze at its thinnest). */
export const tileFrostFoot = (tint: string): string => compositeOver('#FFFFFF', TILE_HAZE.foot, tileGlassColour(tint, 'frost'));
