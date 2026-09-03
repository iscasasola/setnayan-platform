/**
 * Shared color-naming library. Every hex color in the Mood Board (palette
 * swatches, theme meta, concept PDF, vendor view) should show a real name,
 * not a bare hex code.
 *
 * 🛑 EVERY LAYER BELOW IS HUE-GATED FIRST, distance second. A name from the
 * wrong hue family does not just misname one swatch — it destroys trust in
 * every other name on the page, and these names ride the palette editor, the
 * vendor mood board, the concept PDF, the gallery swatch strips and the
 * generated theme descriptions. See "the hue-honesty guard" below.
 *
 * Three layers, checked in priority order:
 *   0. an EXACT hex in either table — if the color IS Tan, it is called Tan.
 *   1. WEDDING_NAMES — a curated set of names a couple actually recognizes
 *      for wedding/decor colors (elegant, Filipino-relevant where the color
 *      calls for it), matched first within a tight distance so a couple's
 *      blush pink reads as "Blush", not the generic CSS "Pink".
 *   2. CSS_NAMES — the 140 standard CSS Color Module named colors (sourced
 *      2026-09-02 from https://www.w3.org/TR/css-color-4/#named-colors,
 *      cross-checked against bahamas10/css-color-names). Deliberately NOT the
 *      ~30k-entry crowdsourced meodai/color-names list: that dataset's names
 *      (e.g. "1989 Miami Hotline") don't fit a wedding platform's tone.
 *   3. a DESCRIPTIVE name built from the measurement — "Deep Green", "Light
 *      Yellow-Green". ⚠ THIS LAYER IS WHY THIS FILE NO LONGER SAYS THE CSS
 *      TABLE "guarantees every possible hex resolves to a real name". It did
 *      say that, and it was true only because the old matcher accepted ANY
 *      distance across ANY hue boundary — the guarantee and the defect were
 *      the same sentence. Coverage now comes from a name that is true rather
 *      than from a name that is merely present; ~0.2% of the hue circle lands
 *      here (measured over a 6,480-hex sweep).
 *
 * Pure, deterministic, no AI call — same architecture as the rest of the
 * Setnayan-AI derivation layer (see apps/web/lib/setnayan-ai-cockpit.ts).
 */

import {
  chromaStar,
  deltaHStar,
  hueDeltaDeg,
  hueStar,
  labDistance,
  labOfHex,
  type Lab,
} from './color-space';

export type NamedColor = { name: string; hex: string };

// Curated, wedding/décor-relevant names — checked first, tighter match radius.
export const WEDDING_NAMES: NamedColor[] = [
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'Cream', hex: '#FAF7F2' },
  { name: 'Blush', hex: '#F4C2C2' },
  { name: 'Dusty Rose', hex: '#C9A0A0' },
  { name: 'Rose', hex: '#BE185D' },
  { name: 'Burgundy', hex: '#7A1F2B' },
  { name: 'Terracotta', hex: '#C97B4B' },
  { name: 'Rust', hex: '#824A2A' },
  { name: 'Champagne Gold', hex: '#C5A059' },
  { name: 'Gold', hex: '#D4AF37' },
  { name: 'Mustard', hex: '#D97706' },
  { name: 'Sage', hex: '#8A9A6B' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Forest Green', hex: '#3A5746' },
  { name: 'Sky Blue', hex: '#7DB8D9' },
  { name: 'Navy', hex: '#1E2540' },
  { name: 'Slate', hex: '#3A5766' },
  { name: 'Lavender', hex: '#C9B8D9' },
  { name: 'Plum', hex: '#5C2542' },
  { name: 'Charcoal', hex: '#1E2229' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Silver', hex: '#CFD3D6' },
  { name: 'Peach', hex: '#F0B27A' },
  { name: 'Coral', hex: '#E8735A' },
  // Filipino-relevant additions (owner directive 2026-09-02).
  { name: 'Piña Cream', hex: '#F2E8D5' },
  { name: 'Capiz Pearl', hex: '#EAE6DA' },
  { name: 'Sampaguita White', hex: '#FBFBF3' },
  { name: 'Narra Brown', hex: '#6B4226' },
  { name: 'Banana Leaf Green', hex: '#4C6B3F' },
  { name: 'Waling-Waling Purple', hex: '#8E4B8C' },
  { name: 'Bamboo Tan', hex: '#C7A76C' },
];

function normalizeHex(hex: string): string | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  return m?.[1] ? `#${m[1].toUpperCase()}` : null;
}

// ── the hue-honesty guard ────────────────────────────────────────────────
//
// 🛑 THE DEFECT THIS EXISTS FOR — do not "simplify" it back out. Both layers
// used to match on plain RGB Euclidean distance, which is not a perceptual
// metric and knows nothing about hue. Measured on the shipped function:
//
//   #20452F  a deep pine GREEN  →  "Charcoal"  (a blue-black NEUTRAL)
//   #CDD590  a pale YELLOW-GREEN → "Tan"       (an orange-brown)
//   #DC143C  CRIMSON, which is in the CSS table EXACTLY → "Rose"
//
// and the first of those was the curated layer, not the CSS fallback: green
// #20452F sits 1265 RGB² from Charcoal #1E2229, comfortably inside the 2400
// radius, because the two differ almost entirely in the GREEN channel and
// RGB² does not care which channel moved. A name from the wrong family
// destroys trust in every other name on the page, so a candidate must now
// pass a hue test before its distance is even considered.

/**
 * C*ab below which a color has no hue anyone would name — the number in its
 * hue channel is an artifact of the conversion, not something anyone sees.
 * Taken from the mood-board completion's own `INVISIBLE_HUE_CHROMA`, which was
 * set at 6 for exactly this question ("which hue is this grey" is not a
 * question about the design). At or below this the color is ACHROMATIC and may
 * only be named by an achromatic name — Charcoal, Silver, Gainsboro.
 */
const ACHROMATIC_CHROMA = 6;

/**
 * C*ab below which a color is still a TINTED NEUTRAL — an ivory, a greige, a
 * blue-white. Between `ACHROMATIC_CHROMA` and here, both regimes are honest:
 * "Ghost White" and "Alice Blue" are both true of the same near-white, and
 * refusing one of them would push perfectly nameable creams into the
 * descriptive fallback. At or above this the color carries a hue anyone can
 * name, and a neutral name is a lie — this is the line #20452F (C*ab 21) sits
 * far above and Charcoal (C*ab 5) sits far below.
 */
const TINTED_NEUTRAL_CHROMA = 12;

/**
 * How far a candidate's hue may sit from the input's, in CIE ΔH*ab (Lab units,
 * the same units as ΔE — see `deltaHStar` for why this is not a degree count).
 *
 * 12 is the mood-board completion's own `MIN_PERCEPTUAL_GAP`: the distance at
 * which two chips in one strip stop reading as one color. A name may differ
 * from the color it names by less than the amount that makes two swatches
 * look different — measured purely in the hue direction.
 */
const MAX_HUE_DRIFT = 12;

/**
 * A hard angular ceiling on top of ΔH*, for the low-chroma case where the
 * chroma weighting alone would allow almost any hue. 40° is the completion's
 * `ANALOGOUS_MAX_HUE_GAP` — the widest hue gap that still reads as one
 * neighbourhood rather than two.
 */
const MAX_HUE_DRIFT_DEG = 40;

/**
 * ΔE (CIE76) within which a curated WEDDING_NAMES match wins over the CSS
 * fallback, so a couple's blush reads as "Blush" and not the generic "Pink".
 *
 * 20 is not a new judgement — it is the OLD `WEDDING_NAME_RADIUS_SQ = 2400`
 * re-expressed in Lab, and TWO independent measurements land on it:
 *
 *   · sampling 51,741 hexes uniformly inside that RGB ball around every
 *     curated name gives ΔE p50 18.6 · p90 30.5 · max 50.3 — so 20 is the
 *     typical reach the curated layer already had (the p90 is inflated by the
 *     ball's corners, not by colors anyone picks);
 *   · sweeping 6,480 hexes across the hue circle, agreement with the old
 *     function ON THE ANSWERS IT GOT RIGHT peaks at exactly this radius
 *     (70.3%, against 68.7% at 30 and 62.9% at 14).
 *
 * ⚠ DO NOT RAISE IT BACK. At 25 and above the curated layer starts winning on
 * lightness alone: #CDD590, a PALE yellow-green, is captured by Sage #8A9A6B
 * at ΔE 24.5 — same family, but 22 points of L* away, two whole lightness
 * bands. Same family is the floor, not the goal.
 *
 * Nothing legitimate is lost: all 15 curated near-misses in the test
 * (a couple's blush at #F5C4C4, terracotta at #C87D4D, Piña Cream at #F3E9D6,
 * Waling-Waling Purple at #8F4C8D …) still resolve at a radius of 14.
 */
const WEDDING_NAME_RADIUS_DE = 20;

/**
 * ΔE beyond which even the closest same-family CSS name is not a name for this
 * color, and the honest answer is a descriptive one ("Deep Green") rather than
 * a confidently wrong one. 40 is the point at which two colors share a family
 * and nothing else — a third of the L* axis, or the whole gap between a pastel
 * and its saturated parent.
 */
const MAX_NAMEABLE_DE = 40;

/**
 * May `candidate` supply a name for `input`?
 *
 * Three regimes, decided by the INPUT's chroma:
 *   · achromatic input (C* < 6)      → achromatic candidates only
 *   · tinted neutral  (6 ≤ C* < 12)  → achromatic candidates, or hue-matching ones
 *   · chromatic input (C* ≥ 12)      → hue-matching candidates only
 */
function hueCompatible(input: Lab, candidate: Lab): boolean {
  const inputChroma = chromaStar(input);
  const candidateChroma = chromaStar(candidate);
  const candidateIsAchromatic = candidateChroma < ACHROMATIC_CHROMA;

  if (inputChroma < ACHROMATIC_CHROMA) return candidateIsAchromatic;

  const hueMatches =
    !candidateIsAchromatic &&
    deltaHStar(input, candidate) <= MAX_HUE_DRIFT &&
    hueDeltaDeg(hueStar(input), hueStar(candidate)) <= MAX_HUE_DRIFT_DEG;

  if (inputChroma < TINTED_NEUTRAL_CHROMA) return candidateIsAchromatic || hueMatches;
  return hueMatches;
}

/** Nearest HUE-COMPATIBLE match in a candidate table, by ΔE (CIE76). */
function nearestIn(
  input: Lab,
  table: NamedColor[],
): { name: string; hex: string; d: number } | null {
  let best: { name: string; hex: string; d: number } | null = null;
  for (const nc of table) {
    const candidate = labOfHex(nc.hex);
    if (!hueCompatible(input, candidate)) continue;
    const d = labDistance(input, candidate);
    if (!best || d < best.d) best = { name: nc.name, hex: nc.hex, d };
  }
  return best;
}

// ── the honest fallback ──────────────────────────────────────────────────

/**
 * Hue-family bands, in Lab hue degrees, with the sRGB primaries/secondaries
 * they were drawn around. The bands are UNEVEN because Lab hue is uneven —
 * measured: red 40° · orange 60° · yellow 103° · chartreuse 128° · green 136°
 * · spring green 149° · cyan 196° · azure 285° · blue 306° · violet 312° ·
 * magenta 328° · pink-red 3°. Six of the twelve live in the 100° stretch
 * between yellow and cyan; the whole blue region is one 110° jump.
 */
const HUE_FAMILIES: ReadonlyArray<{ from: number; to: number; name: string }> = [
  { from: 20, to: 50, name: 'Red' },
  { from: 50, to: 80, name: 'Orange' },
  { from: 80, to: 115, name: 'Yellow' },
  { from: 115, to: 133, name: 'Yellow-Green' },
  { from: 133, to: 175, name: 'Green' },
  { from: 175, to: 215, name: 'Teal' },
  { from: 215, to: 300, name: 'Blue' },
  { from: 300, to: 320, name: 'Violet' },
  { from: 320, to: 340, name: 'Purple' },
  { from: 340, to: 20, name: 'Pink' }, // wraps through 0°
];

function hueFamily(hue: number): string {
  for (const band of HUE_FAMILIES) {
    const inBand =
      band.from < band.to ? hue >= band.from && hue < band.to : hue >= band.from || hue < band.to;
    if (inBand) return band.name;
  }
  return 'Pink';
}

/** The grey ladder, for a color with no hue and no close achromatic name. */
function greyName(L: number): string {
  if (L < 12) return 'Near Black';
  if (L < 30) return 'Dark Gray';
  if (L < 55) return 'Gray';
  if (L < 75) return 'Light Gray';
  if (L < 92) return 'Pale Gray';
  return 'Near White';
}

/**
 * A TRUE name for a color no table can name — never a confident wrong one.
 * "Deep Green", "Light Yellow-Green", "Pale Muted Blue". Built from what was
 * actually measured (L*, C*ab, h_ab), so it cannot claim a family the color
 * does not belong to.
 */
export function descriptiveColorName(lab: Lab): string {
  const chroma = chromaStar(lab);
  if (chroma < ACHROMATIC_CHROMA) return greyName(lab.L);
  const lightness =
    lab.L < 25 ? 'Deep' : lab.L < 45 ? 'Dark' : lab.L < 68 ? null : lab.L < 85 ? 'Light' : 'Pale';
  const muted = chroma < 15 ? 'Muted' : null;
  return [lightness, muted, hueFamily(hueStar(lab))].filter(Boolean).join(' ');
}

/**
 * Nearest color name for any hex — ALWAYS returns a real name (never null) for
 * a valid 6-digit hex. Returns null ONLY for an invalid/unparseable hex, which
 * is the contract every caller already codes against (`?? hex`, `?? 'soft
 * neutral'`, `.filter(Boolean)`).
 *
 * Order:
 *   0. an EXACT hex in either table is that table's name, full stop. Without
 *      this, curated "Rose" (ΔE 28.7 away, and hue-rejected anyway) could out-
 *      rank the CSS table's byte-exact "Crimson" for #DC143C. If the color IS
 *      Tan, it is called Tan.
 *   1. the nearest hue-COMPATIBLE curated wedding name, inside its radius.
 *   2. the nearest hue-COMPATIBLE CSS name, inside the nameable radius.
 *   3. an honest descriptive name built from the measurement itself.
 */
export function nearestColorName(hex: string): string | null {
  return resolveColorName(hex)?.name ?? null;
}

/**
 * `nearestColorName` with the LAYER that answered.
 *
 * 🔑 WHY THE SOURCE IS PART OF THE API: the descriptive fallback legitimately
 * emits words the CSS table also holds — "Purple" for a magenta the CSS
 * "Purple" #800080 is too far from to name, "Light Green", "Deep Pink". Both
 * are true of the color, so the collision is harmless to a reader and fatal to
 * a test: a guard that only sees the string cannot tell a hue-checked table
 * match from a fallback, and reported three violations that were neither.
 * Anything asserting on the hue guard must read `source`, not the name.
 */
export function resolveColorName(
  hex: string,
): { name: string; source: 'wedding' | 'css' | 'descriptive'; hex: string | null } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;

  const exactWedding = WEDDING_NAMES.find((n) => normalizeHex(n.hex) === normalized);
  if (exactWedding) return { name: exactWedding.name, source: 'wedding', hex: exactWedding.hex };
  const exactCss = CSS_NAMES.find((n) => normalizeHex(n.hex) === normalized);
  if (exactCss) return { name: exactCss.name, source: 'css', hex: exactCss.hex };

  const lab = labOfHex(normalized);
  const weddingMatch = nearestIn(lab, WEDDING_NAMES);
  if (weddingMatch && weddingMatch.d <= WEDDING_NAME_RADIUS_DE) {
    return { name: weddingMatch.name, source: 'wedding', hex: weddingMatch.hex };
  }
  const cssMatch = nearestIn(lab, CSS_NAMES);
  if (cssMatch && cssMatch.d <= MAX_NAMEABLE_DE) {
    return { name: cssMatch.name, source: 'css', hex: cssMatch.hex };
  }
  return { name: descriptiveColorName(lab), source: 'descriptive', hex: null };
}

// The 140 standard CSS Color Module named colors — the complete fallback.
export const CSS_NAMES: NamedColor[] = [
  { name: 'Alice Blue', hex: '#F0F8FF' },
  { name: 'Antique White', hex: '#FAEBD7' },
  { name: 'Aqua', hex: '#00FFFF' },
  { name: 'Aquamarine', hex: '#7FFFD4' },
  { name: 'Azure', hex: '#F0FFFF' },
  { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Bisque', hex: '#FFE4C4' },
  { name: 'Black', hex: '#000000' },
  { name: 'Blanched Almond', hex: '#FFEBCD' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Blue Violet', hex: '#8A2BE2' },
  { name: 'Brown', hex: '#A52A2A' },
  { name: 'Burly Wood', hex: '#DEB887' },
  { name: 'Cadet Blue', hex: '#5F9EA0' },
  { name: 'Chartreuse', hex: '#7FFF00' },
  { name: 'Chocolate', hex: '#D2691E' },
  { name: 'Coral', hex: '#FF7F50' },
  { name: 'Cornflower Blue', hex: '#6495ED' },
  { name: 'Cornsilk', hex: '#FFF8DC' },
  { name: 'Crimson', hex: '#DC143C' },
  { name: 'Dark Blue', hex: '#00008B' },
  { name: 'Dark Cyan', hex: '#008B8B' },
  { name: 'Dark Goldenrod', hex: '#B8860B' },
  { name: 'Dark Gray', hex: '#A9A9A9' },
  { name: 'Dark Green', hex: '#006400' },
  { name: 'Dark Khaki', hex: '#BDB76B' },
  { name: 'Dark Magenta', hex: '#8B008B' },
  { name: 'Dark Olive Green', hex: '#556B2F' },
  { name: 'Dark Orange', hex: '#FF8C00' },
  { name: 'Dark Orchid', hex: '#9932CC' },
  { name: 'Dark Red', hex: '#8B0000' },
  { name: 'Dark Salmon', hex: '#E9967A' },
  { name: 'Dark Sea Green', hex: '#8FBC8F' },
  { name: 'Dark Slate Blue', hex: '#483D8B' },
  { name: 'Dark Slate Gray', hex: '#2F4F4F' },
  { name: 'Dark Turquoise', hex: '#00CED1' },
  { name: 'Dark Violet', hex: '#9400D3' },
  { name: 'Deep Pink', hex: '#FF1493' },
  { name: 'Deep Sky Blue', hex: '#00BFFF' },
  { name: 'Dim Gray', hex: '#696969' },
  { name: 'Dodger Blue', hex: '#1E90FF' },
  { name: 'Firebrick', hex: '#B22222' },
  { name: 'Floral White', hex: '#FFFAF0' },
  { name: 'Forest Green', hex: '#228B22' },
  { name: 'Fuchsia', hex: '#FF00FF' },
  { name: 'Gainsboro', hex: '#DCDCDC' },
  { name: 'Ghost White', hex: '#F8F8FF' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Goldenrod', hex: '#DAA520' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Green', hex: '#008000' },
  { name: 'Green Yellow', hex: '#ADFF2F' },
  { name: 'Honeydew', hex: '#F0FFF0' },
  { name: 'Hot Pink', hex: '#FF69B4' },
  { name: 'Indian Red', hex: '#CD5C5C' },
  { name: 'Indigo', hex: '#4B0082' },
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'Khaki', hex: '#F0E68C' },
  { name: 'Lavender', hex: '#E6E6FA' },
  { name: 'Lavender Blush', hex: '#FFF0F5' },
  { name: 'Lawn Green', hex: '#7CFC00' },
  { name: 'Lemon Chiffon', hex: '#FFFACD' },
  { name: 'Light Blue', hex: '#ADD8E6' },
  { name: 'Light Coral', hex: '#F08080' },
  { name: 'Light Cyan', hex: '#E0FFFF' },
  { name: 'Light Goldenrod Yellow', hex: '#FAFAD2' },
  { name: 'Light Gray', hex: '#D3D3D3' },
  { name: 'Light Green', hex: '#90EE90' },
  { name: 'Light Pink', hex: '#FFB6C1' },
  { name: 'Light Salmon', hex: '#FFA07A' },
  { name: 'Light Sea Green', hex: '#20B2AA' },
  { name: 'Light Sky Blue', hex: '#87CEFA' },
  { name: 'Light Slate Gray', hex: '#778899' },
  { name: 'Light Steel Blue', hex: '#B0C4DE' },
  { name: 'Light Yellow', hex: '#FFFFE0' },
  { name: 'Lime', hex: '#00FF00' },
  { name: 'Lime Green', hex: '#32CD32' },
  { name: 'Linen', hex: '#FAF0E6' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Medium Aquamarine', hex: '#66CDAA' },
  { name: 'Medium Blue', hex: '#0000CD' },
  { name: 'Medium Orchid', hex: '#BA55D3' },
  { name: 'Medium Purple', hex: '#9370DB' },
  { name: 'Medium Sea Green', hex: '#3CB371' },
  { name: 'Medium Slate Blue', hex: '#7B68EE' },
  { name: 'Medium Spring Green', hex: '#00FA9A' },
  { name: 'Medium Turquoise', hex: '#48D1CC' },
  { name: 'Medium Violet Red', hex: '#C71585' },
  { name: 'Midnight Blue', hex: '#191970' },
  { name: 'Mint Cream', hex: '#F5FFFA' },
  { name: 'Misty Rose', hex: '#FFE4E1' },
  { name: 'Moccasin', hex: '#FFE4B5' },
  { name: 'Navajo White', hex: '#FFDEAD' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Old Lace', hex: '#FDF5E6' },
  { name: 'Olive', hex: '#808000' },
  { name: 'Olive Drab', hex: '#6B8E23' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Orange Red', hex: '#FF4500' },
  { name: 'Orchid', hex: '#DA70D6' },
  { name: 'Pale Goldenrod', hex: '#EEE8AA' },
  { name: 'Pale Green', hex: '#98FB98' },
  { name: 'Pale Turquoise', hex: '#AFEEEE' },
  { name: 'Pale Violet Red', hex: '#DB7093' },
  { name: 'Papaya Whip', hex: '#FFEFD5' },
  { name: 'Peach Puff', hex: '#FFDAB9' },
  { name: 'Peru', hex: '#CD853F' },
  { name: 'Pink', hex: '#FFC0CB' },
  { name: 'Plum', hex: '#DDA0DD' },
  { name: 'Powder Blue', hex: '#B0E0E6' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Rebecca Purple', hex: '#663399' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Rosy Brown', hex: '#BC8F8F' },
  { name: 'Royal Blue', hex: '#4169E1' },
  { name: 'Saddle Brown', hex: '#8B4513' },
  { name: 'Salmon', hex: '#FA8072' },
  { name: 'Sandy Brown', hex: '#F4A460' },
  { name: 'Sea Green', hex: '#2E8B57' },
  { name: 'Seashell', hex: '#FFF5EE' },
  { name: 'Sienna', hex: '#A0522D' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Sky Blue', hex: '#87CEEB' },
  { name: 'Slate Blue', hex: '#6A5ACD' },
  { name: 'Slate Gray', hex: '#708090' },
  { name: 'Snow', hex: '#FFFAFA' },
  { name: 'Spring Green', hex: '#00FF7F' },
  { name: 'Steel Blue', hex: '#4682B4' },
  { name: 'Tan', hex: '#D2B48C' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Thistle', hex: '#D8BFD8' },
  { name: 'Tomato', hex: '#FF6347' },
  { name: 'Turquoise', hex: '#40E0D0' },
  { name: 'Violet', hex: '#EE82EE' },
  { name: 'Wheat', hex: '#F5DEB3' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'White Smoke', hex: '#F5F5F5' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Yellow Green', hex: '#9ACD32' },
];
