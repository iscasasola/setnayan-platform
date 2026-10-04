/**
 * 🅻 THE LOGO'S FONTS ARE THE STAGES' FONTS (owner 2026-09-28, on the Logo
 * editor's eight-face typeface list: *"on the logo. we need to show all fonts
 * as well like in stages"*).
 *
 * ONE LIST: a text layer picks from `HUB_FONTS` — through the very dropdown the
 * Maker's per-element Font row is (`FontPick`, `font-pick.tsx`, 2026-09-29: one
 * font dropdown across the editor). This module does not list fonts; it
 * only says, for each of those keys, WHERE ITS OUTLINES ARE.
 *
 * WHY A SECOND FILE PER FACE AT ALL: a text layer is turned into paths in the
 * browser with opentype.js (so every surface draws the couple's words as ink,
 * in any font, with nothing to load), and opentype.js cannot read the WOFF2 the
 * stages serve. So each face has a TrueType copy made from THAT SAME file at
 * the weight the stage draws (`scripts/make-logo-outline-fonts.py`) — or, for
 * the eight the Monogram Studio already bundled, that studio file.
 *
 * 🔒 `lib/logo-fonts.test.ts` fails when a stage font has no outline file here,
 * when a file is missing from `public/`, or when it cannot outline "AM".
 */

import type { HubFontKey } from './hub-fonts';

const STUDIO = '/monogram-studio/fonts/';
const OWN = '/logo-fonts/';

/** Every stage font → the TrueType file its outlines are read from. */
export const LOGO_FONT_OUTLINE: Readonly<Record<HubFontKey, string>> = {
  cormorant: `${OWN}cormorant.ttf`,
  fraunces: `${OWN}fraunces.ttf`,
  playfair: `${OWN}playfair.ttf`,
  caslon: `${OWN}caslon.ttf`,
  vidaloka: `${OWN}vidaloka.ttf`,
  cinzel: `${OWN}cinzel.ttf`,
  script: `${STUDIO}GreatVibes-Regular.ttf`,
  tangerine: `${OWN}tangerine.ttf`,
  luxurious: `${OWN}luxurious.ttf`,
  cormorantsc: `${OWN}cormorantsc.ttf`,
  playfairsc: `${STUDIO}PlayfairDisplaySC-Regular.ttf`,
  bodoni: `${OWN}bodoni.ttf`,
  prata: `${OWN}prata.ttf`,
  instrument: `${OWN}instrument.ttf`,
  cardo: `${OWN}cardo.ttf`,
  gilda: `${STUDIO}GildaDisplay-Regular.ttf`,
  cinzeldeco: `${STUDIO}CinzelDecorative-Regular.ttf`,
  italiana: `${OWN}italiana.ttf`,
  marcellus: `${STUDIO}Marcellus-Regular.ttf`,
  yeseva: `${STUDIO}YesevaOne-Regular.ttf`,
  limelight: `${OWN}limelight.ttf`,
  alfaslab: `${OWN}alfaslab.ttf`,
  oswald: `${OWN}oswald.ttf`,
  syne: `${OWN}syne.ttf`,
  poiret: `${OWN}poiret.ttf`,
  pinyon: `${STUDIO}PinyonScript-Regular.ttf`,
  herrvon: `${OWN}herrvon.ttf`,
  haviland: `${OWN}haviland.ttf`,
  manrope: `${OWN}manrope.ttf`,
  hanken: `${OWN}hanken.ttf`,
  jost: `${OWN}jost.ttf`,
  quicksand: `${OWN}quicksand.ttf`,
  outfit: `${OWN}outfit.ttf`,
  schibsted: `${OWN}schibsted.ttf`,
  poppins: `${OWN}poppins.ttf`,
  // 2026-10-04 · the ten theme faces. Eight reserve their name, so their files
  // are the stage WOFF2 decompressed and nothing else — never cut, never
  // instanced (`scripts/make-logo-outline-fonts.py`, THEME_FACES).
  lora: `${OWN}lora.ttf`,
  baskerville: `${OWN}baskerville.ttf`,
  crimson: `${OWN}crimson.ttf`,
  josefin: `${OWN}josefin.ttf`,
  kaushan: `${OWN}kaushan.ttf`,
  alexbrush: `${OWN}alexbrush.ttf`,
  parisienne: `${OWN}parisienne.ttf`,
  cookie: `${OWN}cookie.ttf`,
  delafield: `${OWN}delafield.ttf`,
  monoton: `${OWN}monoton.ttf`,
};

/**
 * A variable outline file whose DEFAULT instance is not the weight the stage
 * draws → the weight to pin at draw time. Josefin Sans defaults to 100 (a
 * hairline); the stage sets it at 400. Its name is reserved, so the file may not
 * be instanced to 400 (OFL §3) — opentype.js pins it instead (`pinLogoFaceWeight`).
 * Lora and Libre Baskerville already default to 400. 🔒 `lib/logo-fonts.test.ts`
 * fails when a variable outline file would draw at any other weight.
 */
export const LOGO_FONT_VARIATION: Readonly<Partial<Record<HubFontKey, Readonly<Record<string, number>>>>> = {
  josefin: { wght: 400 },
};

/** Pin a variable outline face to the weight the stage draws (a no-op for every other face). */
export function pinLogoFaceWeight(face: OtFace, key: HubFontKey): void {
  const v = LOGO_FONT_VARIATION[key];
  if (v) face.variation?.set({ ...v });
}

/**
 * The italic outlines we hold. Only Cardo's — the face every logo made before
 * this list was set in (the studio's "Cardo" WAS Cardo Italic), kept so those
 * logos draw exactly as they were made. There is no Italic control on the
 * layer; picking a font from the list sets the upright face.
 */
export const LOGO_FONT_OUTLINE_ITALIC: Readonly<Partial<Record<HubFontKey, string>>> = {
  cardo: `${STUDIO}Cardo-Italic.ttf`,
};

/** Studio-era keys a saved layer may still carry → the stage key for that face. */
export const LOGO_LEGACY_FONT: Readonly<Record<string, HubFontKey>> = { cinzeldec: 'cinzeldeco' };

/** The file a text layer's words are outlined from. */
export function logoFontOutlineUrl(font: HubFontKey, italic: boolean): string {
  return (italic ? LOGO_FONT_OUTLINE_ITALIC[font] : undefined) ?? LOGO_FONT_OUTLINE[font];
}

/* ── the words, as outlines ─────────────────────────────────────────────────
   🪤 opentype.js ALWAYS runs a face's `ccmp` substitutions, whatever features
   it is asked for, and throws on a chained-context lookup it does not support
   ("lookupType: 6 - substFormat: 2 is not yet supported"). Great Vibes and
   Gilda Display carry one, so ANY two letters in those faces threw — the
   editor then said the typeface "could not be loaded", and the couple could
   never set their initials in Vibes or Gilda (measured 2026-09-28 by
   `lib/logo-fonts.test.ts`). When the face's own layout throws, the words are
   set glyph by glyph — the same outlines at the same advances and kerning,
   without the ligatures, which a logo's few letters seldom use. */

type OtBox = { x1: number; y1: number; x2: number; y2: number };
/** The slice of an opentype.js Path the Logo uses. */
export type OtPath = { getBoundingBox: () => OtBox; toPathData: (decimals: number) => string; extend: (p: OtPath) => void };
type OtGlyph = { advanceWidth?: number; getPath: (x: number, y: number, size: number) => OtPath };
/** The slice of an opentype.js Font the Logo uses. */
export type OtFace = {
  unitsPerEm: number;
  getPath: (text: string, x: number, y: number, size: number) => OtPath;
  charToGlyph: (ch: string) => OtGlyph;
  getKerningValue: (a: OtGlyph, b: OtGlyph) => number;
  /** opentype.js 2's variable-font manager — present on every parsed face. */
  variation?: { set: (coords: Record<string, number>) => void };
};

/** The words' outlines, pen at (x, y) on the baseline, `size` units per em. */
export function outlineWords(face: OtFace, words: string, x: number, y: number, size: number): OtPath {
  try {
    return face.getPath(words, x, y, size);
  } catch {
    const scale = size / face.unitsPerEm;
    let pen = x;
    let prev: OtGlyph | null = null;
    let out: OtPath | null = null;
    for (const ch of Array.from(words)) {
      const g = face.charToGlyph(ch);
      if (prev) {
        try {
          pen += face.getKerningValue(prev, g) * scale;
        } catch {
          /* no kerning for this pair */
        }
      }
      const p = g.getPath(pen, y, size);
      if (out) out.extend(p);
      else out = p;
      pen += (g.advanceWidth ?? 0) * scale;
      prev = g;
    }
    if (!out) return face.getPath('', x, y, size);
    return out;
  }
}
