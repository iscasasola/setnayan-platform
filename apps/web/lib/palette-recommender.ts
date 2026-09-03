/**
 * The Setnayan AI colour recommender for the Mood Board's Palette editor
 * (section 02) — progressive, cumulative suggestions for the couple's
 * reception "majors", ported from the prototype's `atelier-board.html`
 * (`harmonySuggestions`, `shadeSuggestions`, `candidatesFor`,
 * `dedupeSuggestionsByName`) — a translation, not a reinterpretation.
 *
 * ⚠ NOT OKLCH, ON PURPOSE — A CORRECTION TO THE MB13 BUILD BRIEF.
 * The brief that requested this port calls it "the OKLCH progressive
 * recommender", but the scratchpad spec itself says otherwise, in its own
 * words, right next to this code (`atelier-board.html`, above the
 * `[PALETTE-ENGINE BEGIN]` marker): "the HSL set above serves the drag
 * picker and suggestion chips only, never placement." Placement (lightness
 * walks, chroma caps, gamut clamping) is OKLCH and lives in
 * `palette-styles.ts`; this file is the "suggestion chips" the prototype's
 * own comment excludes from that boundary. `color-space.ts`'s shipped,
 * owner-approved docblock (MB4) is explicit that OKLCH has exactly one
 * importer — `palette-styles.ts` — for exactly one job: the derivation
 * engine. Importing OKLCH primitives here for colour-wheel suggestions
 * would silently create a second importer and blur a boundary the owner
 * signed off on the same day this brief was written. Per this repo's
 * standing rule ("where the spec and the shipped code disagree, the
 * shipped code wins"), this port keeps the prototype's ACTUAL suggestion
 * math — HSL colour-wheel relations — and leaves OKLCH exactly where MB4
 * put it.
 *
 * "Progressive" is the real point, and it doesn't depend on which colour
 * space generates candidates: `candidatesFor` takes every colour the couple
 * has ALREADY chosen and requires a candidate to sit distinctly apart from
 * ALL of them, not just the most recent one — so the second colour offered
 * is never a near-repeat of the first, the third accounts for the first
 * two, and so on. `progressiveReceptionSuggestion` is the single gated
 * entry point section 02 calls: it reads `hasChosenMajors` (`./mood-board`,
 * landed by MB3) as its one predicate for "has the couple actually started
 * choosing colours" and returns `undefined` — advises nothing — until they
 * have. There is no second, parallel "is this still an untouched theme"
 * signal here; `hasChosenMajors` is reused exactly as MB3's docblock asks
 * every surface to.
 *
 * Naming for de-duplication uses the real app's namer (`nearestColorName`,
 * CIELAB-based, `./color-names`) rather than the prototype's own RGB-
 * distance approximation — the prototype's comment says as much: "Naming/
 * nearest-match is CIELAB in the real app... this prototype's namer
 * approximates it in RGB distance."
 */

import { hasChosenMajors } from './mood-board';
import { nearestColorName } from './color-names';

export type ColorSuggestion = {
  readonly label: string;
  readonly hex: string;
};

/* ── HSL primitives (colour-wheel math only — never placement) ─────────── */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return (
    '#' +
    rgb
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function hexToHsl(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : [0, 0, 0];
}

/** WCAG-style relative-luminance contrast ratio — used only to flag two
 *  colours as too close to read apart, never for placement/naming. */
function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 1;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/* ── suggestion generators (ported verbatim from atelier-board.html) ────── */

/** Cross-hue "pairs with this" set: complementary, the two split-
 *  complementaries, and one analogous neighbour — softened toward
 *  wedding-friendly saturation/lightness so a neon base still yields
 *  wearable pairs. */
export function harmonySuggestions(baseHex: string): ColorSuggestion[] {
  const [h, s, l] = hexToHsl(baseHex);
  const S = Math.min(Math.max(s, 0.25), 0.6);
  const L = Math.min(Math.max(l, 0.35), 0.75);
  return [
    { label: 'Complementary', hex: hslToHex(h + 180, S, L) },
    { label: 'Split', hex: hslToHex(h + 150, S, L) },
    { label: 'Split', hex: hslToHex(h + 210, S, L) },
    { label: 'Analogous', hex: hslToHex(h + 30, S, L) },
    { label: 'Triadic', hex: hslToHex(h + 120, S * 0.85, L) },
  ];
}

/** Same-hue "more like this" set: a light tint, a deep shade, a muted
 *  tone, and a richer version — hue held constant. */
export function shadeSuggestions(baseHex: string): ColorSuggestion[] {
  const [h, s, l] = hexToHsl(baseHex);
  return [
    { label: 'Lighter', hex: hslToHex(h, Math.max(s * 0.8, 0.12), Math.min(l + 0.22, 0.92)) },
    { label: 'Deeper', hex: hslToHex(h, Math.min(s * 1.05, 0.85), Math.max(l - 0.22, 0.12)) },
    { label: 'Muted', hex: hslToHex(h, Math.max(s * 0.45, 0.08), l) },
    { label: 'Richer', hex: hslToHex(h, Math.min(s * 1.4 + 0.08, 0.9), l) },
  ];
}

/** THE PROGRESSIVE STEP. Candidates that must work with EVERY colour
 *  already chosen — generated from harmony/shade relations off each
 *  chosen colour, then filtered so a candidate sits perceptibly apart from
 *  ALL of them (a suggestion that matches one chosen colour but collides
 *  with another is not a completion, it's a collision). This is what makes
 *  the recommender cumulative rather than one-shot: the pool and the
 *  filter both grow with `chosen`, so the fourth and fifth colours offered
 *  are shaped by the first three, not blind to them. */
export function candidatesFor(chosen: readonly string[]): ColorSuggestion[] {
  const pool = chosen.flatMap((h) => [...harmonySuggestions(h), ...shadeSuggestions(h)]);
  return pool.filter((s) => chosen.every((o) => contrastRatio(s.hex, o) >= 1.15));
}

/** No suggestion row may print one name twice — two different hexes both
 *  reading "Emerald" are one suggestion wearing two chips. Names resolve
 *  first; the earlier (better-scoring) candidate per name survives.
 *  `takenNames` additionally excludes names already chosen, so a
 *  suggestion never proposes a colour the couple already holds by name. A
 *  hex with no nearby named colour (`nearestColorName` returning `null`)
 *  is keyed on its own hex instead, so it can never collide with a real
 *  name and is never silently dropped. */
export function dedupeSuggestionsByName(
  list: readonly ColorSuggestion[],
  takenNames: readonly string[] = [],
): ColorSuggestion[] {
  const seen = new Set(takenNames);
  return list.filter((sug) => {
    const name = nearestColorName(sug.hex) ?? sug.hex.toUpperCase();
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

/**
 * The single gated entry point section 02's Palette editor calls when the
 * couple adds another reception colour. Returns `undefined` — advise
 * nothing — until `hasChosenMajors` is true, matching the scope rule this
 * session was given verbatim: Setnayan AI advises on the create-your-own
 * path and stays quiet until the board is the couple's own, reusing
 * `hasChosenMajors` rather than deriving a parallel signal. The very first
 * colour (`chosen` empty) has nothing to be progressive FROM — the
 * prototype's own "starter five" panel for that moment is explicitly out
 * of this session's scope (`page.tsx`: "a proper 'Setnayan AI suggests a
 * starting palette, dismissible' affordance... belongs with the
 * palette-style engine landing in MB4/MB5, not as a half-built suggestion
 * here") — so the caller's existing default stands for that one case.
 *
 * Once `chosen` is non-empty, this picks the best surviving candidate:
 * built from every colour already chosen, filtered so it's distinct from
 * all of them, and not a name already on the strip.
 */
export function progressiveReceptionSuggestion(
  chosen: readonly string[],
): string | undefined {
  if (!hasChosenMajors({ reception: [...chosen] })) return undefined;
  const takenNames = chosen.map((h) => nearestColorName(h) ?? h.toUpperCase());
  const [best] = dedupeSuggestionsByName(candidatesFor(chosen), takenNames);
  return best?.hex;
}
