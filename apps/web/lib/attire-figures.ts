/**
 * lib/attire-figures.ts — THE ATTIRE FIGURES' ARTWORK, AND NOTHING ELSE.
 *
 * Owner 2026-10-14 (DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"): *"the sample person … that shows the palette for
 * that role is still a basic shape. need to improve the look"* — a figure per garment, the garment following Wear ▾,
 * "Not said yet" a dashed silhouette. Then, the same day, the owner turned down the hand-drawn SVG figures (*"the designs
 * you made are worse"*) and picked AI-drawn illustrations: 13 garments, each a transparent drawing with its garment in
 * ivory and a MASK of the garment area (controller `attire-figures/README.md`).
 *
 * HOW A ROLE'S COLOUR IS WORN: the drawing, then a layer of the colour clipped to the garment's mask with
 * `mix-blend-mode: multiply` — the drawing's shading survives, the colour is the role's own hex, exactly.
 * Files: `public/attire/<garment>.webp` (≈ 7–9 KB, 280 px tall — twice the Studio's 132 px) and
 * `public/attire/<garment>-mask.webp` (an ALPHA mask), built by `controller-2026-10-12/attire-figures/build-webp.py`,
 * which also cuts the shirt fronts, the boy's sleeves and the pantsuit's blouse out of their masks by hand.
 *
 * 🎨 THE ARTWORK IS A SEAM: everything that draws a person — the Studio's Attire blocks and the guest's dress code,
 * through ONE component (`app/_components/role-figure.tsx`) — reaches the drawings only through this file
 * (`FIGURE_ART`, `GARMENT_FOR`, `unsetSilhouette`). New drawings replace the files and the size table; nothing else moves.
 *
 * Pure data, no DOM, no React.
 */
import type { AttireStyle } from './role-dress-code';

/** Who a figure is: a woman, a man, a girl or a boy. */
export type FigureWho = 'f' | 'm' | 'girl' | 'boy';
/** What the figure wears. `unset` — the dotted silhouette ("Not said yet": no outfit is ever assumed). */
export type FigureGarment =
  | 'gown'
  | 'terno'
  | 'cocktail'
  | 'midi'
  | 'pantsuit'
  | 'barongf'
  | 'barong'
  | 'suit'
  | 'tux'
  | 'shirt'
  | 'flowergirl'
  | 'barongb'
  | 'suitb'
  | 'unset';

export const figureIsChild = (who: FigureWho) => who === 'boy' || who === 'girl';

/**
 * 👫 EACH PERSON IS OFFERED ONLY THEIR OWN STYLES (owner 2026-10-16, on his own sponsors' Attire: *"the drawing is not
 * following the type of attire"* — the men's column read "Long gown" and drew a suit). The 2026-10-14 prototype listed
 * every style for everyone, "the fitting ones first", and drew a man's "Long gown" as a suit; a column that names one
 * garment and draws another is the defect. So a person's list is the styles drawn as THEIR OWN garment:
 *   · a woman — all seven: each has a woman's drawing (a gown · a terno · a cocktail dress · a midi · a pantsuit · a
 *     women's barong; "Formal" is the gown);
 *   · a man — Barong Tagalog · Suit · Formal · Smart casual (a barong · a suit · black tie · an open shirt). A gown, a
 *     cocktail dress and a Filipiniana are never a man's;
 *   · a girl — the dresses (the flower-girl dress); never a suit or a barong;
 *   · a boy — the man's four (his barong · his suit).
 * The one vocabulary stays ONE (`ATTIRE_STYLES`): every style is someone's, and none is spelled twice.
 */
export const STYLE_ORDER: Readonly<Record<FigureWho, readonly AttireStyle[]>> = {
  f: ['long_gown', 'filipiniana', 'cocktail_dress', 'formal', 'smart_casual', 'suit', 'barong_tagalog'],
  m: ['barong_tagalog', 'suit', 'formal', 'smart_casual'],
  girl: ['cocktail_dress', 'filipiniana', 'long_gown', 'formal', 'smart_casual'],
  boy: ['barong_tagalog', 'suit', 'formal', 'smart_casual'],
};

/** Style × who → the garment drawn — only for that person's own styles (`STYLE_ORDER`). */
export const GARMENT_FOR: Readonly<Record<FigureWho, Readonly<Partial<Record<AttireStyle, Exclude<FigureGarment, 'unset'>>>>>> = {
  f: { long_gown: 'gown', cocktail_dress: 'cocktail', filipiniana: 'terno', barong_tagalog: 'barongf', suit: 'pantsuit', formal: 'gown', smart_casual: 'midi' },
  m: { barong_tagalog: 'barong', suit: 'suit', formal: 'tux', smart_casual: 'shirt' },
  girl: { cocktail_dress: 'flowergirl', filipiniana: 'flowergirl', long_gown: 'flowergirl', formal: 'flowergirl', smart_casual: 'flowergirl' },
  boy: { barong_tagalog: 'barongb', suit: 'suitb', formal: 'suitb', smart_casual: 'suitb' },
};

/** Is this style one this person wears (on their Wear ▾ list)? */
export function fitsWho(who: FigureWho, style: AttireStyle | null | undefined): style is AttireStyle {
  return Boolean(style) && STYLE_ORDER[who].includes(style as AttireStyle);
}

/** The other person of a pair: a man's is a woman, a boy's a girl. */
export const COUNTERPART: Readonly<Record<FigureWho, FigureWho>> = { f: 'm', m: 'f', girl: 'boy', boy: 'girl' };

/**
 * The garment a style is drawn as for this person — the silhouette when nothing is said, AND when the style is not
 * theirs (a man is never drawn in a suit under the words "Long gown"; the column names nothing it does not draw).
 */
export function garmentFor(who: FigureWho, style: AttireStyle | null | undefined): FigureGarment {
  return style ? (GARMENT_FOR[who][style] ?? 'unset') : 'unset';
}

/** Each drawing: its file, its garment mask, and its size (px) — every one 280 tall, standing on the same line. */
export type FigureArt = { src: string; mask: string; w: number; h: number };
const SIZE: Readonly<Record<Exclude<FigureGarment, 'unset'>, readonly [number, number]>> = {
  gown: [188, 280],
  terno: [82, 280],
  cocktail: [94, 280],
  midi: [79, 280],
  pantsuit: [77, 280],
  barongf: [77, 280],
  barong: [82, 280],
  suit: [76, 280],
  tux: [79, 280],
  shirt: [79, 280],
  flowergirl: [138, 280],
  barongb: [87, 280],
  suitb: [80, 280],
};
export const FIGURE_ART: Readonly<Record<Exclude<FigureGarment, 'unset'>, FigureArt>> = Object.fromEntries(
  Object.entries(SIZE).map(([g, [w, h]]) => [g, { src: `/attire/${g}.webp`, mask: `/attire/${g}-mask.webp`, w, h }]),
) as Record<Exclude<FigureGarment, 'unset'>, FigureArt>;

/** A child stands about four-fifths of an adult (the prototype's 104 of 132). */
export const CHILD_SCALE = 104 / 132;

/**
 * "NOT SAID YET" — a dashed silhouette, no outfit assumed (the prototype's own path), in a 120 × 300 box (240 for a
 * child): a gown's outline for a woman or a girl, a suit's for a man or a boy.
 */
export function unsetSilhouette(who: FigureWho): { viewBox: string; d: string } {
  const floor = (figureIsChild(who) ? 240 : 300) - 8;
  const d =
    who === 'm' || who === 'boy'
      ? `M60 18 m-13 16 a13 16 0 1 0 26 0 a13 16 0 1 0 -26 0 M34 66 C44 58 76 58 86 66 L90 152 L78 152 L80 ${floor - 4} L62 ${floor - 4} L60 200 L58 ${floor - 4} L40 ${floor - 4} L42 152 L30 152 Z`
      : `M60 18 m-13 16 a13 16 0 1 0 26 0 a13 16 0 1 0 -26 0 M43 66 C50 60 70 60 77 66 L79 104 C90 160 98 230 102 ${floor - 2} L18 ${floor - 2} C22 230 30 160 41 104 Z`;
  return { viewBox: `0 0 120 ${floor + 8}`, d };
}
