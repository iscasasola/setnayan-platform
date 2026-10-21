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
import type { FigureRole } from './attire-designs';

/** Who a figure is: a woman, a man, a girl or a boy. */
export type FigureWho = 'f' | 'm' | 'girl' | 'boy';
/** One of the 45 role drawings (owner 2026-10-16) — `<role>-<design>`, `ROLE_ART` below. */
export type RoleArtKey = `${FigureRole}-${AttireStyle}`;
/** What the figure wears: one of the 13 garment drawings, one of the 45 role drawings, or `unset` — the dotted
 *  silhouette ("Not said yet": no outfit is ever assumed). */
export type FigureGarment =
  | RoleArtKey
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

/** Each drawing: its file, its garment mask, and its size (px) — every one 280 tall, standing on the same line. A role
 *  drawing also has its colour ZONES, one alpha mask each (`zones`, in dot order; the first is `mask`). */
export type FigureArt = { src: string; mask: string; w: number; h: number; zones?: ReadonlyArray<{ key: ZoneKey; mask: string }> };
type GarmentKey = Exclude<FigureGarment, 'unset' | RoleArtKey>;
const SIZE: Readonly<Record<GarmentKey, readonly [number, number]>> = {
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
const GARMENT_ART: Readonly<Record<GarmentKey, FigureArt>> = Object.fromEntries(
  Object.entries(SIZE).map(([g, [w, h]]) => [g, { src: `/attire/${g}.webp`, mask: `/attire/${g}-mask.webp`, w, h }]),
) as Record<GarmentKey, FigureArt>;

/* ── THE 45 ROLE DRAWINGS (owner 2026-10-16, "Approved — use all 45 drawings") ───────────────────────────────── */

/** A colour zone: `a` the garment · `t` tie / bow tie (+ pocket square) · `s` shirt · `v` vest · `p` pants. */
export type ZoneKey = 'a' | 't' | 's' | 'v' | 'p';
/**
 * One zone of a design, in DOT ORDER — the word under its dot, and what it wears when the role has no colour for it.
 *   `first` — the garment's own colour (dot 1) · `deeper` — dot 1 a shade deeper (a tie in the suit's cloth) · a hex.
 */
export type DesignZone = { readonly key: ZoneKey; readonly label: string | null; readonly fallback: 'first' | 'deeper' | `#${string}` };

/**
 * 🎛 THE ENTOURAGE MAN'S THREE CONTROLS, IN THE OWNER'S WORDS (2026-10-21: *"groomsmen, sponsors entourage men has 3
 * palette controls. so the coat and pants can be a specific color / tie and accent a specific color / long sleeves a
 * specific color"*) — the words under the three dots of every suit, tuxedo and vest design.
 */
export const COAT_AND_PANTS = 'Coat & pants';
export const TIE_AND_ACCENT = 'Tie & accent';
export const LONG_SLEEVES = 'Long sleeves';

/**
 * 🎨 THE APPROVED ZONES (DECISION_LOG 2026-10-16 "ATTIRE COLOUR ZONES"; the brief's per-design list): dot 1 the garment,
 * dot 2 the accent (the tie on suits; the pants on a barong and smart casual), dot 3 the shirt — white unless said.
 * (2026-10-21: a 3-piece's vest is no fourth dot — it follows Coat & pants, `FOLLOWER_ZONES`.) Gowns, ternos and dresses — and the kids' dresses —
 * are one colour. Charcoal barong pants and khaki chinos are the approved prototype's own defaults.
 */
export const DESIGN_ZONES: Readonly<Partial<Record<AttireStyle, readonly DesignZone[]>>> = {
  suit: [
    { key: 'a', label: COAT_AND_PANTS, fallback: 'first' },
    { key: 't', label: TIE_AND_ACCENT, fallback: 'deeper' },
    { key: 's', label: LONG_SLEEVES, fallback: '#FFFFFF' },
  ],
  /* 🧥 The vest has no control of its own (owner 2026-10-21, "3 palette controls"): it is drawn in Coat & pants
     (`FOLLOWER_ZONES`). */
  three_piece_suit: [
    { key: 'a', label: COAT_AND_PANTS, fallback: 'first' },
    { key: 't', label: TIE_AND_ACCENT, fallback: 'deeper' },
    { key: 's', label: LONG_SLEEVES, fallback: '#FFFFFF' },
  ],
  tuxedo: [
    { key: 'a', label: COAT_AND_PANTS, fallback: 'first' },
    { key: 't', label: TIE_AND_ACCENT, fallback: 'deeper' },
    { key: 's', label: LONG_SLEEVES, fallback: '#FFFFFF' },
  ],
  /* A vest design draws no coat — its first control names what it colours (a build call, named in the PR). */
  vest_and_tie: [
    { key: 'a', label: 'Vest & pants', fallback: 'first' },
    { key: 't', label: TIE_AND_ACCENT, fallback: 'deeper' },
    { key: 's', label: LONG_SLEEVES, fallback: '#FFFFFF' },
  ],
  vest_and_bow_tie: [
    { key: 'a', label: 'Vest & pants', fallback: 'first' },
    { key: 't', label: TIE_AND_ACCENT, fallback: 'deeper' },
    { key: 's', label: LONG_SLEEVES, fallback: '#FFFFFF' },
  ],
  barong_tagalog: [
    { key: 'a', label: 'Barong', fallback: 'first' },
    { key: 'p', label: 'Pants', fallback: '#33302C' },
  ],
  smart_casual: [
    { key: 'a', label: LONG_SLEEVES, fallback: 'first' },
    { key: 'p', label: 'Pants', fallback: '#C9AD7E' },
  ],
};
/**
 * A drawing's zones that have NO control of their own — each drawn in the colour of the control it follows. The
 * 3-piece's vest follows Coat & pants (owner 2026-10-21: *"the coat and pants can be a specific color / tie and accent a
 * specific color / long sleeves a specific color"* — three controls, not four).
 */
export const FOLLOWER_ZONES: Readonly<Partial<Record<AttireStyle, ReadonlyArray<{ key: ZoneKey; follows: ZoneKey }>>>> = {
  three_piece_suit: [{ key: 'v', follows: 'a' }],
};
/** Every zone a design's DRAWING has a mask for — its controls, then the zones that follow one. */
export function artZoneKeys(style: AttireStyle | null | undefined): ZoneKey[] {
  return [...zonesOf(style).map((z) => z.key), ...((style && FOLLOWER_ZONES[style]) || []).map((f) => f.key)];
}
/** The control a zone is drawn in — itself, or the one it follows. */
export function controlOfZone(style: AttireStyle | null | undefined, key: ZoneKey): ZoneKey {
  return ((style && FOLLOWER_ZONES[style]) || []).find((f) => f.key === key)?.follows ?? key;
}
/**
 * 👔 A GUEST MAN WEARS THE PALETTE ON HIS TIE (owner 2026-10-21, on the guest's Dress with us: *"for the guests. the coat
 * and pants is not the color theme. we set the tie as their palette and keep the coat and pants black"*). For the guests'
 * man in a design with a tie or a bow tie, each colour OPTION is worn on the tie (zone `t`, the pocket square with it);
 * the coat, the pants and a vest are black; the shirt stays white. Only the DEFAULT: a figure given its colours zone by
 * zone (more than the one option colour) wears them as given. Read by `zoneTints` and `pickDots` (lib/role-figure.ts),
 * so the Studio's Guests row and the guest's Dress with us (the Guests card) draw it the same.
 * 👕 THE GUESTS' BARONG AND SMART CASUAL WEAR IT ON THE TOP (owner 2026-10-21: *"barong and smart casual will be their
 * long sleeves or the barong can be tinted as well"*): the barong, or the long-sleeve shirt, is the option colour (zone
 * `a`); the pants keep the approved neutral defaults (`DESIGN_ZONES` — charcoal barong pants, khaki chinos) unless the
 * host gave a zone colour. That is the 2026-10-16 zones exactly as shipped, so no override here — held by
 * `guests-wear-the-palette-on-the-tie.test.ts` so it stays so.
 * Entourage roles are unchanged (their men's rule is an open owner question). Women are unchanged.
 */
export const GUEST_SUIT_BLACK = '#1A1A1A';
/** The designs with a tie or a bow tie — the ones a guest man wears his colour on the tie in. */
export const TIE_DESIGNS: readonly AttireStyle[] = ['suit', 'three_piece_suit', 'tuxedo', 'vest_and_tie', 'vest_and_bow_tie'];
/** The guests' people (`ROW_FIGURE_ROLES.guest`) who wear the palette on the tie — the guests' man. */
const TIE_WEARERS: readonly FigureRole[] = ['guest_m'];
/** Does this person wear their colour on the tie (a guest man, in a design with a tie)? */
export function wearsColourOnTie(role: FigureRole | null | undefined, style: AttireStyle | null | undefined): boolean {
  return Boolean(role && style && TIE_WEARERS.includes(role) && TIE_DESIGNS.includes(style));
}
/** The colour each zone of a tie design wears when the one colour is on the tie: the tie that colour, coat · pants ·
 *  vest black, the shirt its own default (white). */
export function tieZoneColours(style: AttireStyle, colour: string): string[] {
  return zonesOf(style).map((z) => (z.key === 't' ? colour : z.key === 'a' || z.key === 'v' ? GUEST_SUIT_BLACK : z.fallback.startsWith('#') ? z.fallback : GUEST_SUIT_BLACK));
}

const ONE_ZONE: readonly DesignZone[] = [{ key: 'a', label: null, fallback: 'first' }];
/** A design's zones in dot order — one, unlabelled, for a gown, a terno, a dress. */
export function zonesOf(style: AttireStyle | null | undefined): readonly DesignZone[] {
  return (style && DESIGN_ZONES[style]) || ONE_ZONE;
}

/** Each role drawing's width at 280 tall — printed by `scripts/build-role-attire.py` (the #NN is its prompt number). There is
 *  no `best_woman` or `man_of_honor` drawing of their own: each is drawn as the person of their honour-row column — the
 *  best woman as the maid of honor, the man of honor as the best man (lib/attire-designs.ts `READER_FIGURE`). */
const ROLE_WIDTH: Readonly<Record<string, number>> = {
  'groom-suit': 76, // #01
  'best_man-suit': 80, // #02
  'groomsman-suit': 83, // #03
  'ninong-barong_tagalog': 85, // #04
  'father-barong_tagalog': 81, // #05
  'sponsor_m-barong_tagalog': 84, // #06
  'bride-mermaid': 218, // #07
  'maid_of_honor-long_gown': 69, // #08
  'bridesmaid-long_gown': 87, // #09
  'ninang-filipiniana': 80, // #10
  'mother-filipiniana': 72, // #11
  'sponsor_w-long_gown': 81, // #12
  'ring_bearer-vest_and_bow_tie': 84, // #13
  'bible_bearer-barong_tagalog': 83, // #14
  'flower_girl-tulle_dress': 120, // #15
  'guest_m-barong_tagalog': 105, // #16
  'guest_w-cocktail_dress': 94, // #17
  'groom-three_piece_suit': 80, // #18
  'groom-barong_tagalog': 78, // #19
  'groom-tuxedo': 83, // #20
  'best_man-three_piece_suit': 78, // #21
  'best_man-barong_tagalog': 82, // #22
  'best_man-tuxedo': 80, // #23
  'groomsman-vest_and_tie': 83, // #24
  'groomsman-barong_tagalog': 85, // #25
  'ninong-suit': 80, // #26
  'father-suit': 86, // #27
  'sponsor_m-suit': 86, // #28
  'bride-ball_gown': 201, // #29
  'bride-a_line': 181, // #30
  'bride-filipiniana': 158, // #31
  'maid_of_honor-filipiniana': 70, // #32
  'maid_of_honor-cocktail_dress': 86, // #33
  'bridesmaid-cocktail_dress': 96, // #34
  'bridesmaid-filipiniana': 68, // #35
  'ninang-long_gown': 101, // #36
  'mother-long_gown': 73, // #37
  'sponsor_w-filipiniana': 112, // #38
  'ring_bearer-barong_tagalog': 83, // #39
  'bible_bearer-vest_and_bow_tie': 83, // #40
  'flower_girl-filipiniana': 113, // #41
  'guest_m-suit': 76, // #42
  'guest_m-smart_casual': 83, // #43
  'guest_w-long_gown': 112, // #44
  'guest_w-filipiniana': 78, // #45
};
const ROLE_ART: Readonly<Record<string, FigureArt>> = Object.fromEntries(
  Object.entries(ROLE_WIDTH).map(([k, w]) => {
    const style = k.slice(k.indexOf('-') + 1) as AttireStyle;
    const zones = artZoneKeys(style).map((key) => ({ key, mask: `/attire/roles/${k}-${key}.webp` }));
    return [k, { src: `/attire/roles/${k}.webp`, mask: zones[0]!.mask, w, h: 280, zones }];
  }),
);
/** Every role drawing's key — 45 (a guard holds that each has its files). */
export const ROLE_ART_KEYS = Object.keys(ROLE_WIDTH) as RoleArtKey[];

/** A role drawing — one of the 45, or a style's design in its own folder (a `/` key with a drawing). */
export const isRoleArt = (g: string): g is RoleArtKey => g in ROLE_WIDTH || (g.includes('/') && g in FIGURE_ART);

/** Every drawing — the 13 garments and the 45 roles (and each drawn design of a style's five, added by
 *  `lib/attire-design-picks.ts` — the one door to a design key — so the Maker's first load never carries the library). */
export const FIGURE_ART: Readonly<Record<Exclude<FigureGarment, 'unset'>, FigureArt>> = { ...GARMENT_ART, ...ROLE_ART } as Record<Exclude<FigureGarment, 'unset'>, FigureArt>;
/** The design a role drawing is in (`groom-tuxedo` → `tuxedo`, `guest_m-suit/slim` → `suit`), or null for a garment drawing. */
export function designOfArt(g: FigureGarment): AttireStyle | null {
  return isRoleArt(g) ? (g.slice(g.indexOf('-') + 1).split('/')[0] as AttireStyle) : null;
}
/** The role a role drawing is of (`guest_m-suit` → `guest_m`), or null for a garment drawing. */
export function roleOfArt(g: FigureGarment): FigureRole | null {
  return isRoleArt(g) ? (g.slice(0, g.indexOf('-')) as FigureRole) : null;
}

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
