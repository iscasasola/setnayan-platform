/**
 * lib/role-figure.ts — THE ILLUSTRATED PERSON, IN A ROLE'S EXACT COLOURS.
 *
 * Owner 2026-09-27 (DECISION_LOG "OWNER: 'YES TO ALL' — PALETTE, DAY-OF
 * SCHEDULE…", item 1): the dress-code scene shows the palette three ways —
 * swatches · an ILLUSTRATED person in the exact role colours (*"not AI — exact
 * colour, free"*) · mood board photos. This file is the second.
 *
 * ♻ NOT A NEW DRAWING SYSTEM. The gown and suit figures are the reception
 * scene's own people (`lib/reception-scene.ts` draws the couple, the party and
 * the guests with them), moved here verbatim so both surfaces draw ONE figure.
 * The scene imports them back and renders byte-for-byte as before. The one
 * addition is an optional ACCENT (the Mood Board's "color 1 is the main piece,
 * the rest accents", `PALETTE_LIMITS[*].meaning === 'outfit'`): a sash on the
 * gown, the tie on the suit. With no accent the markup is exactly the old one.
 *
 * EXACT COLOUR. Every fill is the role's hex as stored — no tint, no blend, no
 * photo recolour (the Mood Board's `RecolorStudio` keeps a photo's lightness,
 * so a navy gown comes out light blue; this does not).
 *
 * Pure strings, no DOM, no React: the Event Hub's server-rendered dress-code
 * scene and the Mood Board's client palette both call it.
 *
 * 👗 2026-10-14 (owner, DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"): the PERSON a role's palette wears is now
 * the illustrated figure (`lib/attire-figures.ts` — the artwork seam), in the garment its Wear ▾ names, ONE drawing
 * for the Studio's Attire and the guest's dress code (`roleFigurePeople` → `figurePeopleSvg`). The little gown and
 * suit below stay what the reception scene draws its crowd with.
 */

import { FIGURE_BOX, figureArt, figureIsChild, garmentFor, type FigureGarment, type FigureWho } from './attire-figures';
import type { AttireStyle } from './role-dress-code';

export const SKIN = '#E7C8A2';
export const HAIR = '#352720';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
export function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}
/** A contrast edge for a figure: darker if the fill is light, lighter if dark —
 *  so figures separate from a same-toned background (white gown on a pale wall,
 *  dark suit on a dark backdrop). */
export function outlineOf(hex: string): string {
  return lum(hex) > 150 ? shade(hex, -82) : shade(hex, 92);
}

// ---- people ----
// Figures carry a contrast outline so they never blend into a same-toned
// backdrop (white gown on a pale wall, dark suit on a dark backdrop) — issue
// caught by the legibility-verification workflow 2026-06-09.
export function figHead(cx: number, cy: number, r: number): string {
  return (
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${SKIN}" stroke="${shade(SKIN, -55)}" stroke-width="0.7"/>` +
    `<path d="M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} a ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(2 * r).toFixed(1)} 0 Z" fill="${HAIR}"/>`
  );
}
export function gownFig(cx: number, baseY: number, h: number, color: string, accent?: string): string {
  const w = h * 0.5;
  const ol = outlineOf(color);
  return (
    `<polygon points="${(cx - w / 2).toFixed(1)},${baseY.toFixed(1)} ${(cx + w / 2).toFixed(1)},${baseY.toFixed(1)} ${(cx + w * 0.18).toFixed(1)},${(baseY - h * 0.58).toFixed(1)} ${(cx - w * 0.18).toFixed(1)},${(baseY - h * 0.58).toFixed(1)}" fill="${color}" stroke="${ol}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="${(cx - w * 0.18).toFixed(1)}" y="${(baseY - h * 0.78).toFixed(1)}" width="${(w * 0.36).toFixed(1)}" height="${(h * 0.26).toFixed(1)}" rx="3" fill="${color}" stroke="${ol}" stroke-width="1.1"/>` +
    // The accent: a sash at the waist, where the bodice meets the skirt.
    (accent
      ? `<rect x="${(cx - w * 0.2).toFixed(1)}" y="${(baseY - h * 0.6).toFixed(1)}" width="${(w * 0.4).toFixed(1)}" height="${(h * 0.06).toFixed(1)}" rx="1" fill="${accent}" stroke="${outlineOf(accent)}" stroke-width="0.6"/>`
      : '') +
    figHead(cx, baseY - h * 0.86, h * 0.13)
  );
}
export function suitFig(cx: number, baseY: number, h: number, color: string, accent?: string): string {
  const w = h * 0.34;
  const ol = outlineOf(color);
  return (
    `<rect x="${(cx - w / 2).toFixed(1)}" y="${(baseY - h * 0.72).toFixed(1)}" width="${w.toFixed(1)}" height="${(h * 0.72).toFixed(1)}" rx="2" fill="${color}" stroke="${ol}" stroke-width="1.2"/>` +
    // The tie: the jacket's own lighter stripe, or — with an accent — the accent itself.
    (accent
      ? `<rect x="${(cx - 1.6).toFixed(1)}" y="${(baseY - h * 0.72).toFixed(1)}" width="3.2" height="${(h * 0.5).toFixed(1)}" fill="${accent}" stroke="${outlineOf(accent)}" stroke-width="0.4"/>`
      : `<rect x="${(cx - 1.6).toFixed(1)}" y="${(baseY - h * 0.72).toFixed(1)}" width="3.2" height="${(h * 0.5).toFixed(1)}" fill="${shade(color, 40)}" opacity="0.5"/>`) +
    figHead(cx, baseY - h * 0.8, h * 0.13)
  );
}

// ─── A role, drawn ──────────────────────────────────────────────────────────

export type FigureKind = 'gown' | 'suit';

/**
 * Who a role's figure is. The couple and the gendered attendants are one
 * person; every other role (sponsors, parents, the party, custom roles…) is a
 * PAIR — a gown and a suit — because the role holds both. Keyed on the Mood
 * Board's `PaletteKey` (a custom role's `custom:<slug>` falls to the pair).
 */
const SINGLE: Record<string, FigureKind> = {
  // Mood Board keys.
  bride: 'gown',
  groom: 'suit',
  maid_of_honor: 'gown',
  bridesmaids: 'gown',
  best_man: 'suit',
  groomsmen: 'suit',
  // A reader's own guest-list role (the dress-code scene's "You are …"): a
  // ninang is one woman, not the sponsors' pair.
  matron_of_honor: 'gown',
  // Colours with the best man (palette key `best_man`), dresses as a woman.
  best_woman: 'gown',
  bridesmaid: 'gown',
  groomsman: 'suit',
  principal_sponsor_ninang: 'gown',
  principal_sponsor_ninong: 'suit',
  flower_girl: 'gown',
  ring_bearer: 'suit',
  bible_bearer: 'suit',
  coin_bearer: 'suit',
};

/**
 * The people who wear a role's colours, and what each wears:
 *   · an OUTFIT role (`meaning: 'outfit'`): colour 1 is the main piece and
 *     colour 2 its accent — one person, or the pair, dressed alike;
 *   · an OPTIONS role (the guests, `meaning: 'options'`): guests wear ANY ONE of
 *     the colours, never combined — so one person per colour, gown and suit in
 *     turn (up to six).
 * Nothing valid to wear → nobody (a figure in a guessed colour is not the
 * couple's palette).
 */
export function roleFigures(
  key: string,
  hexes: readonly string[],
  meaning: 'outfit' | 'options' = 'outfit',
): Array<{ kind: FigureKind; color: string; accent?: string }> {
  const colors = hexes.filter((h) => HEX.test(h));
  if (!colors.length) return [];
  if (meaning === 'options') return colors.slice(0, 6).map((color, i) => ({ kind: i % 2 ? 'suit' : 'gown', color }));
  const [color, accent] = [colors[0]!, colors[1]];
  const kinds: FigureKind[] = SINGLE[key] ? [SINGLE[key]!] : ['gown', 'suit'];
  return kinds.map((kind) => ({ kind, color, ...(accent ? { accent } : {}) }));
}

/* ── the people, drawn (owner 2026-10-14) ────────────────────────────────── */

/** One person in a picture: who, what they wear, and the colour slots. */
export type FigurePerson = { who: FigureWho; garment: FigureGarment; main: string; accent?: string };
/** A pick as a reader sees it (`picksOf`, lib/attire-rows.ts): who, the Wear (null = not said), its own colours (null = the row's). */
export type FigurePick = { who: FigureWho; style: AttireStyle | null; colours: readonly string[] | null };

/** What a person wears on the GUEST page when the Wear is not said but their colours are: the plain garment of
 *  their kind — the palette still wears a person (the dotted silhouette is the Studio's "Not said yet"). */
export const PLAIN_GARMENT: Readonly<Record<FigureWho, FigureGarment>> = { f: 'gown', m: 'suit', girl: 'dress', boy: 'suitb' };

/** Keys whose single person is a child. */
const CHILD: Record<string, FigureWho> = { flower_girl: 'girl', ring_bearer: 'boy', bible_bearer: 'boy', coin_bearer: 'boy' };

/**
 * The people a role's picture shows.
 *   · `picks` given (the dress code's rows and the reader's own panel): one person per pick, in the pick's garment
 *     (its plain one when not said) and its colours — colour 1 the main piece, colour 2 its accent; an OPTIONS role
 *     (the guests) wears its first colour, never two combined;
 *   · no `picks` (the Mood Board's palette cards): `roleFigures`' people — a gown is a woman, a suit a man — each in
 *     their plain garment.
 * Nothing valid to wear → nobody.
 */
export function roleFigurePeople(key: string, hexes: readonly string[], meaning: 'outfit' | 'options' = 'outfit', picks?: readonly FigurePick[] | null): FigurePerson[] {
  if (picks && picks.length > 0) {
    const out: FigurePerson[] = [];
    for (const p of picks) {
      const colours = (p.colours && p.colours.length > 0 ? p.colours : hexes).filter((h) => HEX.test(h));
      if (!colours.length) continue;
      const accent = meaning === 'options' ? undefined : colours[1];
      out.push({ who: p.who, garment: p.style ? garmentFor(p.who, p.style) : PLAIN_GARMENT[p.who], main: colours[0]!, ...(accent ? { accent } : {}) });
    }
    return out;
  }
  const isPair = key === 'bearers_flower_girl';
  return roleFigures(key, hexes, meaning).map((f) => {
    const who: FigureWho = CHILD[key] ?? (isPair ? (f.kind === 'gown' ? 'girl' : 'boy') : f.kind === 'gown' ? 'f' : 'm');
    return { who, garment: PLAIN_GARMENT[who], main: f.color, ...(f.accent ? { accent: f.accent } : {}) };
  });
}

/**
 * The people as ONE picture — side by side, standing on one line, each in a `<g data-person>`; the artwork is
 * `lib/attire-figures.ts`'s (the seam the final drawings drop into). Null when there is nobody.
 */
export function figurePeopleSvg(people: readonly FigurePerson[]): string | null {
  if (!people.length) return null;
  const tall = Math.max(...people.map((p) => (figureIsChild(p.who) ? FIGURE_BOX.child : FIGURE_BOX.adult)));
  const step = FIGURE_BOX.w * 0.78;
  const w = FIGURE_BOX.w + step * (people.length - 1);
  const body = people
    .map((p, i) => {
      const h = figureIsChild(p.who) ? FIGURE_BOX.child : FIGURE_BOX.adult;
      return `<g data-person="${p.who}" data-garment="${p.garment}" transform="translate(${(i * step).toFixed(1)} ${tall - h})">${figureArt(p.who, p.garment, { main: p.main, accent: p.accent ?? null })}</g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(1)} ${tall}" width="${w.toFixed(1)}" height="${tall}">${body}</svg>`;
}

/**
 * The role's people as one SVG, or null when the role has no colour to dress anybody in. (`picks`: see
 * `roleFigurePeople`.)
 */
export function roleFigureSvg(key: string, hexes: readonly string[], meaning: 'outfit' | 'options' = 'outfit', picks?: readonly FigurePick[] | null): string | null {
  return figurePeopleSvg(roleFigurePeople(key, hexes, meaning, picks));
}

/** A picture as an `<img>` source — no markup is ever injected into the page. */
export function figureDataUri(svg: string | null): string | null {
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}

/** The same picture as an `<img>` source — no markup is ever injected into the page. */
export function roleFigureDataUri(key: string, hexes: readonly string[], meaning: 'outfit' | 'options' = 'outfit', picks?: readonly FigurePick[] | null): string | null {
  return figureDataUri(roleFigureSvg(key, hexes, meaning, picks));
}
