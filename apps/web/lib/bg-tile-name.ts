/**
 * 🖼 BACKGROUND'S PICTURE TILES — the name is written ON the tile (owner 2026-10-09, choosing among three drawings:
 * *"A- picture tiles"*; reference `review/bg-tiles.html`): no white sticker under it, so the tile itself must make
 * its name readable, decided per tile from its own colours AT THE NAME'S PLACE — the tile's foot.
 *
 *   · A COLOUR tile (None · Plain · Opaque · Frosted · Diagonal · Glow) is drawn from ONE known colour, so the
 *     colour under its name is known: the name is ink or white, whichever reads better there, and NOTHING is laid
 *     over the swatch — it is exactly what the page will draw (the first version put a fade on Diagonal and Glow and
 *     both ended as the same dark block).
 *   · A PHOTO (a ready-made scene, the couple's own) gets a LIGHT fade at its foot — 35 %, the bottom half only —
 *     and the reference's soft shadow: a dark fade under a white name, or a light fade under an ink name where the
 *     photo's foot is a light one. For a ready-made scene the foot's colour is MEASURED (`TILE_FOOT`, the picture's
 *     own pixels where the name sits); an upload's is not known, and it wears the dark default.
 *
 * Also the two glass tiles as what they really draw (they were diagonal stripes, which read as "switched off"):
 * Opaque is the flat tint at its opacity; Frosted is that tint under a soft haze.
 *
 * Imported only by the toolbar's lazy pieces. Guard: `lib/background-is-four-rows.test.ts` (7).
 */
import { AA_BODY, compositeOver, contrastRatio } from './hub-legibility';

export const TILE_INK = '#2C2A29';
export const TILE_WHITE = '#FFFFFF';
/** A photo's foot fade — light, and the bottom half only (the first version's 55 % hid the picture). */
export const TILE_FADE = 0.35;

export type TileName = { tone: 'ink' | 'white'; fade: boolean };
const hexOf = (tone: TileName['tone']) => (tone === 'ink' ? TILE_INK : TILE_WHITE);

/** How well a name of `tone` reads on a flat `hex`. */
export const tileFlatContrast = (tone: TileName['tone'], hex: string): number => contrastRatio(hexOf(tone), hex);

/** A flat tile: the colour under the name is `hex` — the tone that reads better on it. Never a fade. */
export function tileNameOnFlat(hex: string): TileName {
  return { tone: tileFlatContrast('ink', hex) >= tileFlatContrast('white', hex) ? 'ink' : 'white', fade: false };
}

/**
 * A gradient tile (Diagonal · Glow): `ramp` is the ombré's own stops, light to dark (`ombreRamp`), and the name sits
 * over the part of it in `span` (from…to, 0…1 along the ramp). The tone whose WORST stop there reads better.
 */
export function tileNameOnRamp(ramp: readonly string[], span: readonly [number, number]): TileName {
  const under = tileRampUnder(ramp, span);
  const worst = (tone: TileName['tone']) => Math.min(...under.map((c) => tileFlatContrast(tone, c)));
  return { tone: worst('ink') >= worst('white') ? 'ink' : 'white', fade: false };
}
export function tileRampUnder(ramp: readonly string[], [from, to]: readonly [number, number]): string[] {
  const last = ramp.length - 1;
  return ramp.slice(Math.max(0, Math.floor(from * last)), Math.min(last, Math.ceil(to * last)) + 1);
}
/**
 * WHERE THE NAME SITS ON EACH OMBRÉ, on an 84 × 38 tile with the name in its bottom 4…18 px, the middle 60 px wide
 * (`ombreCss`): Diagonal is a 160° line — the name covers 0.36…0.88 of it; Glow radiates from the top centre
 * (radii 140 % × 105 %) — 0.50…0.89. Rounded outward.
 */
export const TILE_RAMP_SPAN: Readonly<Record<'diagonal' | 'glow', readonly [number, number]>> = { diagonal: [0.35, 0.9], glow: [0.5, 0.9] };

/**
 * 📏 THE COLOUR AT EACH READY-MADE SCENE'S FOOT — measured, not guessed: the mean of the picture's own pixels where
 * the tile writes the name (the tile shows the 1024-px square `cover` and centred, so its 84 × 38 window is the full
 * width and rows 281…744; the name's band is that window's bottom 4…18 px, the middle 70 % of the width).
 * `lib/background-is-four-rows.test.ts` measures the files again with sharp and fails if a picture changes.
 * (`std-backgrounds.ts`'s `lum` is the middle of the picture — the wrong place: Peony field reads 0.49 there and
 * is a light picture at its foot.)
 */
export const TILE_FOOT: Readonly<Record<string, string>> = {
  aurora: '#6a6268',
  ballroom: '#443f43',
  bridgerton: '#9a9795',
  'fairy-lights': '#775e5b',
  'golden-hour': '#706747',
  peonies: '#9c9080',
  'rose-archway': '#656851',
  seascape: '#464d51',
  starlit: '#8d8da9',
  sunrise: '#e2e7e6',
};
/** The band the foot is measured over, as fractions of the tile's window — the test measures with the same numbers. */
export const TILE_FOOT_BAND = { tile: [84, 38], fromBottom: [4, 18], across: [0.15, 0.85] } as const;

/** A photo's name over its fade: white on the dark fade, or ink on the light one. */
export const tilePhotoContrast = (tone: TileName['tone'], foot: string): number =>
  contrastRatio(hexOf(tone), compositeOver(tone === 'white' ? '#000000' : '#FFFFFF', TILE_FADE, foot));

/** A photo: the tone that reads better over its measured foot; nothing measured (an upload) → the dark default. */
export function tileNameOnPhoto(foot: string | null): TileName {
  if (!foot) return { tone: 'white', fade: true };
  return { tone: tilePhotoContrast('ink', foot) >= tilePhotoContrast('white', foot) ? 'ink' : 'white', fade: true };
}

/** The least a name can read on a FLAT colour with the better of the two tones — where ink and white read the same. */
export const TILE_FLAT_FLOOR = 3.7;
export { AA_BODY as TILE_READS };

/** Opaque — the tint at the opacity it draws, flat (over white, as a tile is). */
export const TILE_GLASS_ALPHA = { glass: 0.85, frost: 0.5 } as const;
export const tileGlassColour = (tint: string, kind: 'glass' | 'frost'): string => compositeOver(tint.slice(0, 7), TILE_GLASS_ALPHA[kind], '#FFFFFF');
/** Frosted — the soft haze laid over its tint (the reference's: nearly white at the top, lighter still than the tint at the foot). */
export const TILE_HAZE = { top: 0.85, foot: 0.45 } as const;
export const tileFrostCss = (tint: string): string => `linear-gradient(180deg, rgba(255,255,255,${TILE_HAZE.top}), rgba(255,255,255,${TILE_HAZE.foot})), ${tileGlassColour(tint, 'frost')}`;
/** …and the colour under a Frosted tile's name (its foot, the haze at its thinnest). */
export const tileFrostFoot = (tint: string): string => compositeOver('#FFFFFF', TILE_HAZE.foot, tileGlassColour(tint, 'frost'));
