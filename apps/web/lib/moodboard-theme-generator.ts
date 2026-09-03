import {
  MOODBOARD_STYLE_FAMILIES,
  MOODBOARD_MOOD_TAGS,
  STYLE_FAMILY_LABELS,
  MOOD_LABELS,
  type MoodboardStyleFamily,
  type MoodboardMoodTag,
  type MoodboardThemeTemplate,
} from './moodboard-templates';
import { nearestColorName } from './color-names';
import { labDistance, labOfHex } from './color-space';
import { sanitizeRolePalette } from './mood-board';
import { optionIds, sanitizeReceptionDesign, type ReceptionDesign } from './reception-scene';

/**
 * Theme-template PROCEDURAL GENERATOR — 10 style families × 10 moods ×
 * ≥25 themes per combination = ≥2,500 rows (Mood Board redesign, taxonomy
 * expansion, 2026-09-03). Hand-authoring 2,500 rows one at a time isn't
 * tractable — this module is a deterministic function of (style, mood,
 * variantIndex) → a schema-valid `moodboard_theme_templates` row, run once by
 * `apps/web/scripts/generate-moodboard-theme-seed.ts` to emit the seed SQL
 * for migration 20271196372720. Re-run that script any time this generator
 * changes (e.g. to widen the taxonomy further or refresh naming).
 *
 * Design, mirroring the ORIGINAL 100 hand-authored rows
 * (20271194462267_moodboard_theme_templates.sql) rather than inventing a new
 * shape:
 *   • Every row uses the SAME 6 role_palette keys the hand-authored rows used
 *     (ceremony/reception/bride/groom/wedding_party/guest) and the SAME
 *     `reception_design` part→attribute→option shape from
 *     `apps/web/lib/reception-scene.ts` — no new schema, only more content.
 *   • Every generated row is validated against the REAL
 *     `sanitizeRolePalette` / `sanitizeReceptionDesign` before being emitted
 *     — see `validateGeneratedTemplate` below, called by the seed script for
 *     every one of the 2,500 rows, and by the generator's own unit tests for
 *     a representative sample.
 *   • Colors vary by transforming a per-style ANCHOR palette through a
 *     per-mood HSL transform (dark_moody lowers lightness + raises
 *     saturation, minimalist trims to fewer/desaturated colors, etc.) —
 *     never by generating near-duplicate rows with trivial 1-hex diffs.
 *   • Reception materials vary by cycling through the REAL option
 *     vocabulary already defined in `RECEPTION_PARTS` (including the
 *     Filipino-specific options — capiz/banig/bamboo/sampaguita/banana_leaf —
 *     and the newer Walls/Photo Wall/Welcome & Signage zones), per style.
 *   • Names lean emotional/evocative (word-bank prefix × noun, per
 *     style × mood) rather than the literal "{Color} & {Color} {Style}
 *     Reception" pattern most of the original 100 used.
 */

// Style/mood taxonomy, labels: single source of truth is moodboard-templates.ts
// (MOODBOARD_STYLE_FAMILIES / MOODBOARD_MOOD_TAGS / STYLE_FAMILY_LABELS /
// MOOD_LABELS), re-exported here under the names this module's own tests and
// the seed script already reference.
export const ALL_STYLE_FAMILIES = MOODBOARD_STYLE_FAMILIES;
export type AllStyleFamily = MoodboardStyleFamily;

/**
 * 🛑 THE MOODS THIS GENERATOR GENERATES — a SUBSET of the app's vocabulary,
 * and it must stay one (2026-09-03).
 *
 * This was `= MOODBOARD_MOOD_TAGS` while the two lists happened to be equal.
 * They are no longer: `festive_celebratory` was added to the app vocabulary
 * as an eleventh mood, and populating it would mean regenerating the 2,500
 * rows in the COMMITTED seed migration (20271196372720) — an owner decision
 * that has not been made. Re-pointing this at the app list would silently
 * change what `pnpm tsx scripts/generate-moodboard-theme-seed.ts` emits and
 * put the generator out of step with the file already in production.
 *
 * So the rule is: this list describes WHAT WAS GENERATED. Add a mood here
 * only in the same change that regenerates the seed. `every-theme-carries-
 * five-reception-colors.test.ts` (2,600 rows) and
 * `the-completion-cannot-invert-a-theme-s-mood.test.ts` (2,600 rows) both
 * read the committed SQL, so they are the fence on that.
 *
 * The subset relationship is type-checked below and asserted in
 * moodboard-theme-generator.test.ts.
 */
export const ALL_MOOD_TAGS = [
  'whimsical_storybook',
  'minimalist',
  'dark_moody',
  'bold_contrasting',
  'simple_understated',
  'maximalist_complex',
  'romantic_ethereal',
  'nostalgic_vintage',
  'glam_luxurious',
  'organic_natural',
] as const satisfies readonly MoodboardMoodTag[];

export type AllMoodTag = (typeof ALL_MOOD_TAGS)[number];

/** Moods in the app's vocabulary that this generator produces NO rows for.
 *  Empty is the normal state; a non-empty list is the open owner decision. */
export const UNGENERATED_MOOD_TAGS: readonly MoodboardMoodTag[] =
  MOODBOARD_MOOD_TAGS.filter((m) => !(ALL_MOOD_TAGS as readonly string[]).includes(m));

export { STYLE_FAMILY_LABELS, MOOD_LABELS };

// ── HSL utilities ────────────────────────────────────────────────────────

type HSL = { h: number; s: number; l: number };

function hexToHsl(hex: string): HSL {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: HSL): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toByte = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── the five-color reception contract ───────────────────────────────────
//
// OWNER DIRECTIVE 2026-09-03: "themes must be 5 colors". EVERY theme — the
// 100 hand-authored rows AND the 2,500 generated ones — ships a reception
// palette of exactly RECEPTION_PALETTE_SIZE colors, in these fixed slots
// (mirrored by PALETTE_LIMITS.reception.slotLabels in lib/mood-board.ts):
//
//   0 Dominant · 1 Supporting · 2 Accent · 3 Neutral · 4 Accent 2
//
// `completeReceptionFive` is the ONE implementation of slots 3-4, shared by
// both groups so the slot labels are truthful for all 2,600 rows. Both callers
// pass the theme's colors AND its `mood_tag` — the mood is a required
// parameter, see MOOD_COMPLETION below for what happened when it was not an
// input at all:
//   • the generator passes its (Dominant, Supporting, chroma-tamed Accent)
//     plus the mood it is generating for;
//   • scripts/lift-moodboard-hand-authored-reception-to-five.ts passes each
//     hand-authored row's existing three — which it never reorders or edits —
//     plus that row's own mood_tag, read out of the VALUES line.
// Two mechanisms deriving the same five slots two different ways would each
// pass their own tests and still disagree — so there is only one.

/** Colors in every theme's `role_palette.reception`. Owner-locked at 5. */
export const RECEPTION_PALETTE_SIZE = 5;

/**
 * How colorful a color actually is, 0-100 — the RGB max-min spread, expressed
 * in HSL terms.
 *
 * 🛑 NEVER JUDGE "IS THIS A HUE OR A NEUTRAL" BY HSL SATURATION. Ivory
 * `#FFFFF0` has saturation ONE HUNDRED (three points of yellow across a
 * near-white), and it beat every real color in this palette set when the
 * first cut of `hueCarrier` picked by `s` — which is how a blue-and-ivory
 * theme was handed an olive fifth color. Its chroma is 6, which is the number
 * that matches what anyone actually sees.
 */
function chromaOf(c: HSL): number {
  return c.s * (1 - Math.abs(2 * (c.l / 100) - 1));
}

/** Build a color at a target CHROMA (not saturation) for a given hue and
 *  lightness — the inverse of `chromaOf`, so "a barely-tinted cream" means the
 *  same thing at l=91 as at l=18. */
function withChroma(h: number, chroma: number, l: number): HSL {
  const factor = 1 - Math.abs(2 * (l / 100) - 1);
  return { h, s: factor <= 0.0001 ? 0 : clamp(chroma / factor, 0, 100), l };
}

/**
 * Chroma at or above which a color reads as a competing HUE rather than a
 * tinted neutral. Real wedding palettes are two hues plus neutrals — cream,
 * ivory, charcoal, greige — so a completed palette never ADDS a third
 * high-chroma member past this budget.
 */
const HIGH_CHROMA = 42;
const MAX_HIGH_CHROMA = 2;

/**
 * Chroma below which a color's HUE carries no perceptual weight — it is a
 * grey, and the number in its hue channel is an artifact of the conversion,
 * not a color anyone sees. Blending against one is how silver's ~200° and
 * gold's ~46° averaged into an olive nobody asked for.
 */
const HUE_BEARING_CHROMA = 12;

// ── CIELAB, for the two questions HSL cannot answer ─────────────────────
//
// 🛑 (1) HSL `l` IS NOT LIGHTNESS. It is (max+min)/2 of the RGB channels. A
// spring green `#19D393` sits at HSL l=46 and at L*=75 — five generated rows
// were completed against the HSL number and still flipped from reading light
// to reading mid, because the number the completion balanced was not the
// number anyone sees. Every lightness decision below is made in L*.
//
// 🛑 (2) A DIFFERENT HEX IS NOT A DIFFERENT COLOR. `ensureDistinct` used to
// settle for hex inequality, which a one-bit difference satisfies. Once the
// completion (correctly) stopped jumping to the opposite lightness pole, added
// members started landing on top of colors already in the set: measured in
// ΔE2000 across all 2,600 rows, hex-inequality alone left 874 palettes with an
// added chip nobody can tell from its neighbour — a five-swatch strip that
// renders as four.
//
// The distance below is deliberately CIE76 (a plain Lab distance) and NOT
// ΔE2000: the audit that finds this class of defect measures in ΔE2000, and a
// guard sharing its formula with the audit agrees with it by construction.

// 📦 `labOfHex` AND `labDistance` BOTH LIVE IN `./color-space` (2026-09-03) —
// `color-names.ts` needed the identical conversion to stop naming colors out of
// their hue family, and two copies of a color space drift apart silently.
// Imported at the top of this file; the two guard tests still write CIELAB out
// themselves on purpose.
//
// 🛑 THIS FILE BRIEFLY KEPT A SECOND `labDistance` — a hex-taking wrapper with
// the same name as the exported Lab-taking one. Same name, same arithmetic
// (verified equal to 0.0 across 48,737 hex pairs), different signature: exactly
// the shape `scripts/lint-dup-rule.ts` exists to catch, and it turned that
// guard red. The wrapper bought one `labOfHex` call per argument at the single
// call site; converting at the call site costs nothing and leaves ONE rule.

/** Perceptual lightness (CIELAB L*) of an HSL color. */
function lightnessStar(c: HSL): number {
  return labOfHex(hslToHex(c)).L;
}

/** Perceptual colorfulness (CIELAB C*ab) of a hex.
 *
 *  🔑 HSL CHROMA IS NOT THIS NUMBER: the same 3 points of HSL chroma render at
 *  C*ab 5 on a near-white and at C*ab 2 in the midtones. Judging "is this still
 *  a neutral" in HSL is how *Pure White Minimal Modern* — "All white, no accent
 *  color at all" — received a fifth chip more colorful than anything already
 *  in it. The ceiling below is applied in C*ab, where the audit and the eye
 *  both live. */
function starChromaOf(hex: string): number {
  const { a, b } = labOfHex(hex);
  return Math.hypot(a, b);
}

/** The HSL lightness that renders at a target L* for this hue and chroma.
 *  L* rises monotonically with HSL `l` at fixed (hue, chroma), so a fixed-step
 *  bisection is both exact enough and deterministic. */
function hslLightnessForStar(h: number, chroma: number, targetStar: number): number {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (lightnessStar(withChroma(h, chroma, mid)) < targetStar) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** How far apart two chips in one strip must sit to read as two colors. */
const MIN_PERCEPTUAL_GAP = 12;

/** C*ab below which a chip carries no hue anyone would name — the point at
 *  which "which hue is this grey" stops being a question about the design. */
const INVISIBLE_HUE_CHROMA = 6;

/**
 * The widest hue gap whose MIDPOINT still reads as "between" its two ends.
 * Past this the midpoint is a THIRD hue belonging to neither: amethyst at 328°
 * and gold at 46° are 78° apart and their midpoint is 7° — the salmon
 * `#D4857A` that shipped into *Amethyst & Gold Regal*, 45° off every hue that
 * theme actually contains. Beyond this gap the added accent REUSES a hue the
 * palette already has instead of inventing one between them.
 */
const ANALOGOUS_MAX_HUE_GAP = 40;

// ── mood is an INPUT to the completion ──────────────────────────────────
//
// 🛑 THE DEFECT THIS TABLE EXISTS FOR — do not "simplify" it back out. The
// first cut of this completion chose slots 3-4 with a `missingBand` helper:
// "whichever lightness pole the set does not have yet, deep first". `mood_tag`
// was never an input at all. But a dark palette ALWAYS already has deep, so it
// always received light; a light palette always received deep. Measured in
// CIELAB across all 2,600 seeded rows: dark_moody went from 2 swatches at
// L*≥85 to 262, romantic_ethereal from 0 at L*≤25 to 235, 383 rows stopped
// reading dark and 523 stopped reading light — 906 rows, 35%, had the exact
// property their mood NAMES dragged out of them.
//
// ⚠ AND THE METRIC THAT PASS WAS PROUD OF — "rows with a lightness span under
// 30: zero" — WAS THAT DEFECT STATED AS A VIRTUE. Every palette spanned both
// poles precisely because the ones that deliberately did not were forced to.
// A full lightness span is not a goal here.
//
// So the pair is placed against THE SET'S OWN lightness ladder — its darkest,
// its lightest, its median — pushed the way the mood actually means:
//
//   deeper   dark_moody · nostalgic_vintage
//   lighter  romantic_ethereal · whimsical_storybook · minimalist
//   widen    bold_contrasting · maximalist_complex · glam_luxurious
//   stay     simple_understated · organic_natural
//
// 🔑 AND THE PAIR STRADDLES THE SET'S MEDIAN: one addition at or below it, one
// at or above. The median of the five is then EXACTLY the median of the three,
// so completing a palette CANNOT change whether it reads dark or light. That
// is arithmetic, not tuning — the profile below only decides how far each half
// travels and how far outside the existing band it may reach.

type MoodCompletion = {
  /** Which side of the median the grounding NEUTRAL (slot 3) takes; the
   *  ACCENT (slot 4) always takes the other. */
  neutralSide: 'deep' | 'light';
  /** How far BELOW the set's own darkest / ABOVE its own lightest the pair may
   *  reach, in HSL lightness points. Small numbers keep a palette inside the
   *  band it already occupies. */
  reachDeep: number;
  reachLight: number;
  /** How far from the median toward each bound the pair actually travels,
   *  0 (sit on the median) to 1 (all the way to the bound). */
  towardDeep: number;
  towardLight: number;
};

const MOOD_COMPLETION: Record<AllMoodTag, MoodCompletion> = {
  // Deeper: the darkness IS the mood. A bone-white fifth erases the theme.
  dark_moody: { neutralSide: 'deep', reachDeep: 14, reachLight: 0, towardDeep: 0.85, towardLight: 0.3 },
  // Deeper: sepia and faded-photograph read as aged paper and old wood, and
  // aged paper is never brighter than the print it carries.
  nostalgic_vintage: { neutralSide: 'deep', reachDeep: 10, reachLight: 2, towardDeep: 0.7, towardLight: 0.35 },
  // Lighter: "gossamer", "cloud-soft", "featherlight" — a charcoal fifth is
  // the literal opposite of every word in the mood's own name bank.
  romantic_ethereal: { neutralSide: 'light', reachDeep: 0, reachLight: 12, towardDeep: 0.3, towardLight: 0.85 },
  // Lighter: storybook pastel; the airiness is the whole effect.
  whimsical_storybook: { neutralSide: 'light', reachDeep: 2, reachLight: 10, towardDeep: 0.35, towardLight: 0.8 },
  // Lighter: minimal means LESS ink on the page, not more contrast on it.
  minimalist: { neutralSide: 'light', reachDeep: 2, reachLight: 10, towardDeep: 0.35, towardLight: 0.8 },
  // Widen: contrast is the mood, so the pair reinforces BOTH poles — this is
  // the one mood for which a bigger lightness span is genuinely the point.
  bold_contrasting: { neutralSide: 'deep', reachDeep: 16, reachLight: 14, towardDeep: 0.9, towardLight: 0.9 },
  // Widen: layered and abundant wants range at the top and the bottom.
  maximalist_complex: { neutralSide: 'deep', reachDeep: 12, reachLight: 10, towardDeep: 0.75, towardLight: 0.75 },
  // Widen: gilded needs a deep ground for the metal to catch light against.
  glam_luxurious: { neutralSide: 'deep', reachDeep: 12, reachLight: 8, towardDeep: 0.8, towardLight: 0.7 },
  // Stay: restraint. The completion adds TONE, not range.
  simple_understated: { neutralSide: 'deep', reachDeep: 5, reachLight: 5, towardDeep: 0.45, towardLight: 0.45 },
  // Stay: earth tones already sit in a mid band; keep them in it.
  organic_natural: { neutralSide: 'deep', reachDeep: 6, reachLight: 6, towardDeep: 0.5, towardLight: 0.5 },
};

/** Bounds of the completion's working range, in L*. */
const STAR_FLOOR = 4;
const STAR_CEIL = 98;

/**
 * The narrowest lightness window (in L*) a completion will work in.
 *
 * A DELIBERATELY NARROW palette — all-black, all-white, dove-grey on
 * dove-grey — completes with tonal variation INSIDE its own band, never a jump
 * to the opposite pole, and it is detected from the colors' own spread rather
 * than from the theme's name (a name is not evidence). The window below is
 * built from the set's own min/median/max, so a set that occupies 8 points of
 * L* gets a completion that occupies about 18 — and a set that spans 80 gets
 * one that spans 80. This constant only stops a perfectly flat set from
 * producing two colors it cannot tell apart.
 */
const MIN_COMPLETION_WINDOW = 18;

function median(values: ReadonlyArray<number>): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

type CompletionWindow = {
  /** The set's own median L* — the pivot both additions straddle. */
  pivot: number;
  deepBound: number;
  lightBound: number;
  deepTarget: number;
  lightTarget: number;
};

/**
 * Where THIS set's two new members may sit: an L* window derived from the
 * set's own darkest / lightest / median, opened in the direction its mood
 * means. `deepTarget <= pivot <= lightTarget` always holds — and because both
 * additions straddle the pivot, the median L* of the five is exactly the
 * median L* of the three. That is what makes completing a palette unable to
 * change whether it reads dark or light.
 */
function completionWindow(list: ReadonlyArray<HSL>, profile: MoodCompletion): CompletionWindow {
  const stars = list.map(lightnessStar);
  const lo = Math.min(...stars);
  const hi = Math.max(...stars);
  const pivot = median(stars);
  let deepBound = clamp(lo - profile.reachDeep, STAR_FLOOR, pivot);
  let lightBound = clamp(hi + profile.reachLight, pivot, STAR_CEIL);
  if (lightBound - deepBound < MIN_COMPLETION_WINDOW) {
    const half = MIN_COMPLETION_WINDOW / 2;
    deepBound = clamp(Math.min(deepBound, pivot - half), STAR_FLOOR, pivot);
    lightBound = clamp(Math.max(lightBound, pivot + half), pivot, STAR_CEIL);
  }
  return {
    pivot,
    deepBound,
    lightBound,
    deepTarget: pivot - profile.towardDeep * (pivot - deepBound),
    lightTarget: pivot + profile.towardLight * (lightBound - pivot),
  };
}

/** Signed shortest angular distance between two hues, in degrees. */
function hueDelta(a: number, b: number): number {
  let d = (((b - a) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** The hue halfway between two hues, taking the short way round the wheel. */
function hueMid(a: number, b: number): number {
  return (((a + hueDelta(a, b) / 2) % 360) + 360) % 360;
}

/** The most CHROMATIC member — the color that gives the set its hue family. */
function hueCarrier(list: ReadonlyArray<HSL>): HSL {
  return list.reduce((best, c) => (chromaOf(c) > chromaOf(best) ? c : best), list[0]!);
}

/** The next-most-chromatic member, excluding the carrier. Falls back to the
 *  carrier for a one-color list (then `deriveAccent` treats it as monochrome). */
function secondHue(list: ReadonlyArray<HSL>): HSL {
  const carrier = hueCarrier(list);
  const rest = list.filter((c) => c !== carrier);
  if (rest.length === 0) return carrier;
  return rest.reduce((best, c) => (chromaOf(c) > chromaOf(best) ? c : best), rest[0]!);
}

/**
 * How colorful this palette is AS A SET.
 *
 * 🔑 THE SECOND DEFECT THIS FIXES: the first cut derived both added colors
 * from the hue CARRIER alone, so the addition was a function of one member,
 * not of the theme. 99 distinct hand-authored triples collapsed into 68
 * distinct added pairs — `#F5EFDB + #E7D186` was appended byte-identically to
 * *Navy & Gold Ballroom Regal*, *Midnight Garden Regal*, *Moonlit Mangrove
 * Heritage* AND *Full Black Modern Statement*, four themes whose only shared
 * property is a gold. Every derivation below reads the WHOLE set.
 */
function meanChroma(list: ReadonlyArray<HSL>): number {
  return list.reduce((sum, c) => sum + chromaOf(c), 0) / list.length;
}

/**
 * The loudest an ADDED color is allowed to be: the set's SECOND-loudest
 * member (with a floor at a third of the loudest, so a single-hue palette can
 * still receive a muted tonal cousin). A palette that carries one hue does not
 * gain a second — which is how *Blush Line Modern*, "nearly monochrome, one
 * soft color kept to a minimum", stops receiving a second soft color, and how
 * *Pure White Minimal Modern*, "no accent color at all", stops receiving a
 * sage. Derived from the colors, not from the description.
 */
function chromaCeiling(list: ReadonlyArray<HSL>): number {
  const sorted = list.map(chromaOf).sort((a, b) => b - a);
  const loudest = sorted[0] ?? 0;
  const second = sorted[1] ?? loudest;
  return Math.max(second, loudest * 0.35);
}

/**
 * A color stated the way this module reasons about one: a hue, how colorful it
 * is, and where it sits in PERCEPTUAL lightness. `buildColor` turns it into the
 * HSL the rest of the file speaks.
 */
type Recipe = {
  h: number;
  chroma: number;
  star: number;
  /** HSL-chroma ceiling this slot may search up to for distinctness. */
  maxChroma: number;
  /** 🔒 C*ab ceiling the finished color may not exceed — the set's own loudest
   *  member. An ADDED color is never more colorful than anything the theme
   *  already contains, which is the whole of "a palette that carries one hue
   *  does not gain a second". */
  maxStarChroma: number;
};

function buildColor(r: Recipe): HSL {
  return withChroma(r.h, r.chroma, hslLightnessForStar(r.h, r.chroma, r.star));
}

/** Build a recipe's color, backing its chroma off until it renders at or below
 *  the recipe's C*ab ceiling. Bisection, so deterministic. */
function buildWithinChromaCeiling(r: Recipe): { hex: string; hsl: HSL } {
  const direct = buildColor(r);
  const directHex = hslToHex(direct);
  if (starChromaOf(directHex) <= r.maxStarChroma) return { hex: directHex, hsl: direct };
  let lo = 0;
  let hi = r.chroma;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (starChromaOf(hslToHex(buildColor({ ...r, chroma: mid }))) > r.maxStarChroma) hi = mid;
    else lo = mid;
  }
  const hsl = buildColor({ ...r, chroma: lo });
  return { hex: hslToHex(hsl), hsl };
}

/** The loudest member of a set, in C*ab. */
function maxStarChromaOf(list: ReadonlyArray<HSL>): number {
  return Math.max(...list.map((c) => starChromaOf(hslToHex(c))));
}

/**
 * Slot 3 — the NEUTRAL that grounds the set: the hue carrier's own hue at a
 * tint the WHOLE set's chroma decides, so it is a cream/greige/charcoal that
 * belongs to THIS palette and not a generic grey dropped in from outside. Its
 * lightness is chosen by `completionWindow` from the set's own ladder and the
 * theme's mood — never a hard-coded 18 or 91.
 */
function deriveNeutral(list: ReadonlyArray<HSL>, star: number): Recipe {
  const carrier = hueCarrier(list);
  const loudest = chromaOf(carrier);
  // Never more tinted than the palette itself is colorful: an all-white theme
  // gets a white neutral, not a cream.
  const ceiling = Math.min(11, loudest);
  const tint = clamp(meanChroma(list) * 0.25, Math.min(3, loudest), ceiling);
  return {
    h: carrier.h,
    chroma: tint,
    star,
    maxChroma: ceiling,
    maxStarChroma: maxStarChromaOf(list),
  };
}

/**
 * Slot 4 — an ACCENT genuinely related to the colors already present. Its hue
 * is the midpoint of the set's two hues ONLY when they are close enough for a
 * midpoint to still read as between them; otherwise it reuses the set's second
 * hue outright, so the accent is never a color the theme does not contain. Its
 * chroma cannot exceed `chromaCeiling`, and its lightness comes from
 * `completionWindow` — the opposite side of the median from the neutral.
 */
function deriveAccent(list: ReadonlyArray<HSL>, star: number): Recipe {
  const carrier = hueCarrier(list);
  const second = secondHue(list);
  const carrierC = chromaOf(carrier);
  const secondC = chromaOf(second);
  const gap = Math.abs(hueDelta(carrier.h, second.h));
  const secondBears = second !== carrier && secondC >= HUE_BEARING_CHROMA && gap >= 6;
  const h = !secondBears
    ? carrier.h
    : gap <= ANALOGOUS_MAX_HUE_GAP
      ? hueMid(carrier.h, second.h)
      : second.h;
  // Chroma budget: if two members already read as hues, this one lands as a
  // tinted neutral rather than a third competing color — and either way it
  // stays under the set's own second-loudest member.
  const highs = list.filter((c) => chromaOf(c) >= HIGH_CHROMA).length;
  const cap = Math.min(chromaCeiling(list), highs >= MAX_HIGH_CHROMA ? 26 : 48);
  const base = secondBears ? (carrierC + secondC) / 2 : carrierC * 0.62;
  return {
    h,
    chroma: clamp(base * 0.85, 0, cap),
    star,
    maxChroma: cap,
    maxStarChroma: maxStarChromaOf(list),
  };
}

/**
 * Place a derived color so it is visibly its own chip — searching only INSIDE
 * the L* half the mood window gave this slot, and never above the chroma
 * ceiling that slot was given: lightness first (it keeps the hue relationship),
 * then chroma, and hue only as a last resort. Returns the first candidate that
 * clears `MIN_PERCEPTUAL_GAP` from every color already in the set, or — for a
 * palette with genuinely no room, an all-white or an all-black one — the most
 * separated position the window contains. Deterministic.
 */
function placeColor(
  r: Recipe,
  taken: ReadonlyArray<string>,
  loStar: number,
  hiStar: number,
): { hex: string; hsl: HSL } {
  const lo = Math.min(loStar, hiStar);
  const hi = Math.max(loStar, hiStar);
  const candidates: Recipe[] = [];
  // 1) Lightness, but only INSIDE the half of the window this slot was given —
  //    a nudge that crossed the pivot would break the median guarantee. The
  //    intended L* is tried first, then progressively further from it.
  for (const d of [0, 3, -3, 6, -6, 9, -9, 13, -13, 17, -17, 22, -22, 28, -28, 34, -34]) {
    candidates.push({ ...r, star: clamp(r.star + d, lo, hi) });
  }
  // 2) Chroma at the SAME lightness — a tint step, invisible to the mood, and
  //    the only move left when the window is a point wide (all-black,
  //    all-white). CAPPED at the slot's own ceiling: an all-white theme whose
  //    description says "no accent color at all" must not buy distinctness by
  //    growing a color.
  for (const dc of [5, -5, 10, -10, 16, -16, 24, -24]) {
    candidates.push({ ...r, chroma: clamp(r.chroma + dc, 0, r.maxChroma) });
  }
  const measure = (cand: Recipe) => {
    const { hex, hsl } = buildWithinChromaCeiling(cand);
    const lab = labOfHex(hex);
    const gap =
      taken.length === 0 ? Infinity : Math.min(...taken.map((t) => labDistance(lab, labOfHex(t))));
    return { hex, hsl, gap };
  };
  let best: { hex: string; hsl: HSL; gap: number } | null = null;
  for (const cand of candidates) {
    const settled = measure(cand);
    if (settled.gap >= MIN_PERCEPTUAL_GAP) return { hex: settled.hex, hsl: settled.hsl };
    if (!best || settled.gap > best.gap) best = settled;
  }
  // 3) Hue — HELD BACK, and this is deliberate. Rotating the hue is the one
  //    move that changes what the color IS, and a fifth chip in a hue the
  //    theme does not contain is worse than a fifth chip that is quietly
  //    tonal: an unbounded ±90° search here handed a grey-and-plum
  //    moody-garden theme an OLIVE, 120° of Lab hue from anything present.
  //
  //    Two cases, and the difference between them is whether a person could
  //    SEE the rotation. Below C*ab 6 nobody calls a chip a color — rotating
  //    a barely-tinted grey is free, and it is the only room a near-neutral
  //    palette has. Above it, a rotation is used only to break an EXACT
  //    repeat, and only by a couple of dozen degrees.
  const rotationIsInvisible = r.maxStarChroma <= INVISIBLE_HUE_CHROMA;
  if (best && (rotationIsInvisible || best.gap < 1)) {
    const sweep = rotationIsInvisible
      ? [30, -30, 60, -60, 90, -90, 120, -120, 150, 180]
      : [8, -8, 16, -16, 24, -24];
    for (const dh of sweep) {
      const settled = measure({ ...r, h: r.h + dh });
      if (settled.gap > best.gap) best = settled;
      if (best.gap >= MIN_PERCEPTUAL_GAP) break;
    }
  }
  // Nothing in the window clears the margin — a genuinely flat palette, which
  // is a real kind of theme and not an error. Take the most separated position
  // available rather than pretending, and DO NOT escape the window to find
  // room: leaving it is the inversion this whole module exists to prevent.
  if (best) return { hex: best.hex, hsl: best.hsl };
  return buildWithinChromaCeiling(r);
}

/**
 * Complete a reception palette to exactly five colors, PRESERVING the input
 * colors in their given order (Dominant/Supporting/Accent stay put) and
 * deriving the rest from the colors actually present AND from the theme's
 * `mood_tag` — never appending arbitrary filler, and never dragging a palette
 * toward the middle. Pure + deterministic.
 *
 * 🛑 `mood` IS REQUIRED, ON PURPOSE. It used to be absent, and an absent mood
 * is exactly how 906 of 2,600 themes ended up with the opposite of the
 * character their tag names (see MOOD_COMPLETION above). A required parameter
 * makes forgetting it a compile error instead of a silent inversion.
 *
 * Returns [] for an empty/invalid input, and the first five for an input that
 * is already five or longer, so re-running it over already-lifted content is
 * idempotent.
 */
export function completeReceptionFive(base: ReadonlyArray<string>, mood: AllMoodTag): string[] {
  const valid = base
    .filter((h) => typeof h === 'string' && /^#[0-9A-Fa-f]{6}$/.test(h))
    .map((h) => h.toUpperCase());
  if (valid.length === 0) return [];
  if (valid.length >= RECEPTION_PALETTE_SIZE) return valid.slice(0, RECEPTION_PALETTE_SIZE);

  const profile = MOOD_COMPLETION[mood];
  const hexes = [...valid];
  const hsl = valid.map(hexToHsl);

  const push = (recipe: Recipe, loStar: number, hiStar: number) => {
    const { hex, hsl: settled } = placeColor(recipe, hexes, loStar, hiStar);
    hexes.push(hex);
    hsl.push(settled);
  };

  // Slots 0-2 are hues. Neither shipped caller gets here (both pass three),
  // but the function is exported: a caller that supplied fewer gets related
  // accents inside its own window, not filler, so the hue family still holds.
  while (hexes.length < 3) {
    const w = completionWindow(hsl, profile);
    push(deriveAccent(hsl, w.pivot), w.deepBound, w.lightBound);
  }

  // Both additions read THE THREE, never each other: slot 4 must be a function
  // of the theme's own colors, not of the neutral that slot 3 just added (which
  // would drag every accent toward whatever grey preceded it). One window,
  // computed once, straddled by both.
  const source = hsl.slice(0, 3);
  const w = completionWindow(source, profile);
  const neutralIsDeep = profile.neutralSide === 'deep';
  const neutralStar = neutralIsDeep ? w.deepTarget : w.lightTarget;
  const accentStar = neutralIsDeep ? w.lightTarget : w.deepTarget;
  // Slot 3: the grounding neutral, on the mood's own side of the median.
  push(
    deriveNeutral(source, neutralStar),
    neutralIsDeep ? w.deepBound : w.pivot,
    neutralIsDeep ? w.pivot : w.lightBound,
  );
  // Slot 4: the related accent, on the other side — so the five keep the
  // three's median exactly.
  push(
    deriveAccent(source, accentStar),
    neutralIsDeep ? w.pivot : w.deepBound,
    neutralIsDeep ? w.lightBound : w.pivot,
  );
  return hexes.slice(0, RECEPTION_PALETTE_SIZE);
}

// ── per-style anchor palettes + reception defaults ──────────────────────

type StyleSpec = {
  /** 4-6 signature hex colors, dominant → accent order. */
  anchors: string[];
  /** Reception material candidates to cycle through per (part, attr) —
   *  every id here MUST be a real option id from RECEPTION_PARTS. */
  reception: {
    ceiling: string[];
    backdropStyle: string[];
    backdropFlorals: string[];
    stageSetup: string[];
    stageFlorals: string[];
    tableShape: string[];
    tableChairs: string[];
    tableLinen: string[];
    tableCenter: string[];
    tablePlace: string[];
    tunnel: string[];
    entranceRunner: string[];
    walls: string[];
    photoWall: string[];
    welcome: string[];
    people: string[];
  };
};

const STYLE_SPECS: Record<AllStyleFamily, StyleSpec> = {
  'elegant · simple · classic': {
    anchors: ['#FAF7F2', '#C5A059', '#824A2A', '#D4AF37', '#CFD3D6'],
    reception: {
      ceiling: ['chandeliers', 'draped', 'fairy_lights'],
      backdropStyle: ['draped', 'capiz'],
      backdropFlorals: ['corner', 'full', 'cascading'],
      stageSetup: ['sweetheart', 'king_queen'],
      stageFlorals: ['arch', 'pedestals'],
      tableShape: ['round'],
      tableChairs: ['chiavari', 'cross_back', 'ghost'],
      tableLinen: ['plain', 'runner', 'sequin'],
      tableCenter: ['tall', 'candelabra', 'low'],
      tablePlace: ['gold', 'silver'],
      tunnel: ['floral', 'crystal'],
      entranceRunner: ['fabric', 'candle'],
      walls: ['bare', 'uplighting_only'],
      photoWall: ['floral_wall', 'none'],
      welcome: ['framed_seating_chart', 'minimal'],
      people: ['couple_party', 'everyone'],
    },
  },
  'bridgerton · regal': {
    anchors: ['#7A1F2B', '#D4AF37', '#5C2542', '#059669', '#824A2A'],
    reception: {
      ceiling: ['chandeliers'],
      backdropStyle: ['draped', 'capiz', 'moon_gate'],
      backdropFlorals: ['full', 'cascading'],
      stageSetup: ['king_queen', 'sweetheart', 'lounge'],
      stageFlorals: ['arch', 'pedestals'],
      tableShape: ['round'],
      tableChairs: ['velvet', 'chiavari'],
      tableLinen: ['full_drape', 'sequin', 'runner'],
      tableCenter: ['candelabra', 'tall'],
      tablePlace: ['gold'],
      tunnel: ['crystal', 'draped', 'floral'],
      entranceRunner: ['candle', 'mirror'],
      walls: ['fabric_drape', 'floral_garland'],
      photoWall: ['floral_wall', 'step_repeat'],
      welcome: ['framed_seating_chart', 'floral_guestbook'],
      people: ['everyone', 'couple_party'],
    },
  },
  'editorial cream': {
    anchors: ['#CFD3D6', '#1E2229', '#FAF7F2', '#C97B4B', '#824A2A'],
    reception: {
      ceiling: ['bare', 'geometric'],
      backdropStyle: ['draped', 'led'],
      backdropFlorals: ['none', 'corner'],
      stageSetup: ['sweetheart', 'lounge'],
      stageFlorals: ['none', 'table_runner'],
      tableShape: ['long', 'square'],
      tableChairs: ['ghost', 'bentwood'],
      tableLinen: ['plain', 'runner'],
      tableCenter: ['low', 'greenery_runner'],
      tablePlace: ['glass', 'none'],
      tunnel: ['none'],
      entranceRunner: ['none', 'floral_lined'],
      walls: ['uplighting_only', 'bare'],
      photoWall: ['none', 'neon_backdrop'],
      welcome: ['minimal', 'easel_sign'],
      people: ['couple', 'couple_party'],
    },
  },
  'tropical heritage': {
    anchors: ['#E8735A', '#D4AF37', '#059669', '#3A5746', '#8A9A6B'],
    reception: {
      ceiling: ['banana_leaf', 'hanging_greenery', 'lanterns'],
      backdropStyle: ['capiz', 'greenery'],
      backdropFlorals: ['full', 'cascading'],
      stageSetup: ['sweetheart', 'riser_arch'],
      stageFlorals: ['pedestals', 'arch'],
      tableShape: ['round', 'long'],
      tableChairs: ['cross_back', 'bentwood'],
      tableLinen: ['banig', 'runner'],
      tableCenter: ['sampaguita', 'tall'],
      tablePlace: ['none', 'gold'],
      tunnel: ['bamboo', 'greenery'],
      entranceRunner: ['floral_lined', 'petals'],
      walls: ['greenery_wall', 'floral_garland'],
      photoWall: ['greenery_wall', 'floral_wall'],
      welcome: ['floral_guestbook', 'easel_sign'],
      people: ['everyone', 'couple_party'],
    },
  },
  'modern minimalist': {
    anchors: ['#1E2229', '#CFD3D6', '#FAF7F2', '#000000', '#BE185D'],
    reception: {
      ceiling: ['geometric', 'bare'],
      backdropStyle: ['led', 'draped'],
      backdropFlorals: ['none'],
      stageSetup: ['lounge', 'sweetheart'],
      stageFlorals: ['none'],
      tableShape: ['square', 'long'],
      tableChairs: ['ghost'],
      tableLinen: ['plain', 'sequin'],
      tableCenter: ['candles', 'low'],
      tablePlace: ['none', 'silver'],
      tunnel: ['none'],
      entranceRunner: ['none', 'mirror'],
      walls: ['uplighting_only', 'bare'],
      photoWall: ['neon_backdrop', 'none'],
      welcome: ['minimal'],
      people: ['couple', 'couple_party'],
    },
  },
  'boho beach': {
    anchors: ['#E8DCC8', '#C97B4B', '#8AA9B8', '#FAF7F2', '#824A2A'],
    reception: {
      ceiling: ['fairy_lights', 'hanging_greenery', 'bare'],
      backdropStyle: ['greenery', 'draped', 'fringe'],
      backdropFlorals: ['cascading', 'corner'],
      stageSetup: ['lounge', 'sweetheart'],
      stageFlorals: ['pedestals', 'none'],
      tableShape: ['round', 'long'],
      tableChairs: ['bentwood', 'cross_back'],
      tableLinen: ['runner', 'plain'],
      tableCenter: ['lanterns', 'greenery_runner'],
      tablePlace: ['none'],
      tunnel: ['bamboo', 'none'],
      entranceRunner: ['petals', 'none'],
      walls: ['bare', 'fabric_drape'],
      photoWall: ['balloon_garland', 'none'],
      welcome: ['easel_sign', 'minimal'],
      people: ['couple_party', 'couple'],
    },
  },
  'vintage ilustrado': {
    anchors: ['#F7F3EA', '#D4AF37', '#7A1F2B', '#824A2A', '#C5A059'],
    reception: {
      ceiling: ['chandeliers', 'lanterns'],
      backdropStyle: ['capiz', 'draped'],
      backdropFlorals: ['corner', 'full'],
      stageSetup: ['sweetheart', 'king_queen'],
      stageFlorals: ['arch', 'table_runner'],
      tableShape: ['round'],
      tableChairs: ['cross_back', 'chiavari'],
      tableLinen: ['plain', 'banig'],
      tableCenter: ['candelabra', 'sampaguita'],
      tablePlace: ['gold'],
      tunnel: ['floral', 'bamboo'],
      entranceRunner: ['fabric', 'candle'],
      walls: ['fabric_drape', 'bare'],
      photoWall: ['floral_wall', 'none'],
      welcome: ['framed_seating_chart', 'easel_sign'],
      people: ['couple_party', 'everyone'],
    },
  },
  'industrial loft': {
    anchors: ['#8A8F94', '#1E2229', '#C97B4B', '#FAF7F2', '#3A3A3A'],
    reception: {
      ceiling: ['bare', 'geometric'],
      backdropStyle: ['led', 'draped', 'fringe'],
      backdropFlorals: ['none', 'corner'],
      stageSetup: ['lounge', 'sweetheart'],
      stageFlorals: ['none'],
      tableShape: ['long', 'square'],
      tableChairs: ['ghost', 'bentwood'],
      tableLinen: ['plain', 'runner'],
      tableCenter: ['candles', 'low'],
      tablePlace: ['glass', 'none'],
      tunnel: ['none'],
      entranceRunner: ['none'],
      walls: ['uplighting_only', 'bare'],
      photoWall: ['neon_backdrop', 'step_repeat'],
      welcome: ['minimal', 'easel_sign'],
      people: ['couple', 'couple_party'],
    },
  },
  'moody garden': {
    anchors: ['#2C3B2E', '#5C2542', '#7A1F2B', '#D4AF37', '#1B1F1C'],
    reception: {
      ceiling: ['hanging_greenery', 'fairy_lights', 'hanging_florals'],
      backdropStyle: ['greenery', 'draped'],
      backdropFlorals: ['cascading', 'full'],
      stageSetup: ['riser_arch', 'sweetheart'],
      stageFlorals: ['arch', 'pedestals'],
      tableShape: ['round', 'long'],
      tableChairs: ['velvet', 'cross_back'],
      tableLinen: ['full_drape', 'runner'],
      tableCenter: ['candles', 'candelabra'],
      tablePlace: ['gold', 'none'],
      tunnel: ['greenery', 'draped'],
      entranceRunner: ['candle', 'floral_lined'],
      walls: ['greenery_wall', 'fabric_drape'],
      photoWall: ['floral_wall', 'greenery_wall'],
      welcome: ['easel_sign', 'framed_seating_chart'],
      people: ['everyone', 'couple_party'],
    },
  },
  'destination resort': {
    anchors: ['#2FA6A0', '#FAF7F2', '#E8735A', '#D4AF37', '#8AA9B8'],
    reception: {
      ceiling: ['bare', 'fairy_lights', 'hanging_greenery'],
      backdropStyle: ['greenery', 'draped'],
      backdropFlorals: ['corner', 'cascading'],
      stageSetup: ['lounge', 'sweetheart'],
      stageFlorals: ['pedestals', 'none'],
      tableShape: ['round', 'long'],
      tableChairs: ['bentwood', 'cross_back'],
      tableLinen: ['runner', 'plain'],
      tableCenter: ['tall', 'lanterns'],
      tablePlace: ['none', 'gold'],
      tunnel: ['bamboo', 'none'],
      entranceRunner: ['petals', 'none'],
      walls: ['bare', 'greenery_wall'],
      photoWall: ['greenery_wall', 'none'],
      welcome: ['easel_sign', 'minimal'],
      people: ['couple_party', 'everyone'],
    },
  },
};

// ── per-mood HSL transform ───────────────────────────────────────────────

/**
 * Transform one style's anchor HSL colors for a mood. `variant` (0..n) jitters
 * hue/sat/light slightly (deterministically) so successive variants in the
 * same (style, mood) combination don't collapse to identical hexes, without
 * drifting so far the palette stops reading as that mood.
 */
function moodTransform(mood: AllMoodTag, hsl: HSL[], variant: number): HSL[] {
  const jitterH = (i: number) => (((variant * 7 + i * 13) % 11) - 5); // -5..5
  const jitterL = (i: number) => (((variant * 5 + i * 3) % 7) - 3); // -3..3
  const withJitter = (c: HSL, i: number): HSL => ({
    h: c.h + jitterH(i),
    s: c.s,
    l: c.l,
  });

  switch (mood) {
    case 'dark_moody':
      return hsl.map((c, i) => withJitter({ h: c.h, s: clamp(c.s + 10, 0, 100), l: clamp(c.l - 22 + jitterL(i), 8, 55) }, i));
    case 'minimalist':
      return hsl.slice(0, 3).map((c, i) => withJitter({ h: c.h, s: clamp(c.s * 0.45, 0, 100), l: clamp(c.l + 4, 0, 96) }, i));
    case 'simple_understated':
      // Near-monochrome: pull every color toward the FIRST anchor's hue.
      return hsl.slice(0, 3).map((c, i) =>
        withJitter({ h: hsl[0]!.h + (c.h - hsl[0]!.h) * 0.15, s: clamp(c.s * 0.55, 0, 100), l: clamp(c.l, 12, 92) }, i),
      );
    case 'bold_contrasting':
      return hsl.map((c, i) =>
        withJitter({ h: c.h, s: clamp(c.s + 20, 0, 100), l: i % 2 === 0 ? clamp(c.l + 28, 60, 96) : clamp(c.l - 28, 6, 40) }, i),
      );
    case 'whimsical_storybook':
      return hsl.map((c, i) =>
        withJitter({ h: c.h, s: clamp(i === hsl.length - 1 ? c.s + 15 : c.s - 15, 0, 100), l: clamp(c.l + 16, 0, 94) }, i),
      );
    case 'maximalist_complex':
      return hsl.map((c, i) => withJitter({ h: c.h, s: clamp(c.s + 8 + i * 2, 0, 100), l: clamp(c.l + jitterL(i), 10, 90) }, i));
    case 'romantic_ethereal':
      return hsl.map((c, i) => withJitter({ h: c.h, s: clamp(c.s - 22, 5, 100), l: clamp(c.l + 26, 0, 95) }, i));
    case 'nostalgic_vintage':
      // Sepia-shift: pull hue toward warm ~35°, desaturate, lift midtones.
      return hsl.map((c, i) =>
        withJitter({ h: c.h + (35 - c.h) * 0.35, s: clamp(c.s * 0.6, 0, 100), l: clamp(c.l + 6, 10, 88) }, i),
      );
    case 'glam_luxurious': {
      // Push toward metallics: raise saturation, and force the LAST slot
      // toward a gold/silver accent (alternating by variant) rather than
      // whatever hue the anchor happened to carry.
      const metallic = variant % 2 === 0 ? { h: 46, s: 62, l: 55 } : { h: 210, s: 8, l: 78 }; // gold / silver
      const out = hsl.map((c, i) => withJitter({ h: c.h, s: clamp(c.s + 18, 0, 100), l: clamp(c.l + jitterL(i), 8, 90) }, i));
      out[out.length - 1] = metallic;
      return out;
    }
    case 'organic_natural':
      // Desaturate toward earth tones: pull hue toward ~30° (brown/terracotta).
      return hsl.map((c, i) =>
        withJitter({ h: c.h + (30 - c.h) * 0.5, s: clamp(c.s - 25, 5, 100), l: clamp(c.l - 6 + jitterL(i), 8, 85) }, i),
      );
    default:
      return hsl.map((c, i) => withJitter(c, i));
  }
}

// ── naming ───────────────────────────────────────────────────────────────

const STYLE_NOUNS: Record<AllStyleFamily, string[]> = {
  'elegant · simple · classic': [
    'Timeless Vows', 'Quiet Grace', 'Heirloom Promise', 'Classic Devotion', 'Ivory Chapter',
    'Enduring Elegance', 'Grace Everlasting', 'Golden Vow', 'Understated Romance', 'Forever Simple',
    'Poised Beginning', 'Refined Union',
  ],
  'bridgerton · regal': [
    'Court Romance', 'Regency Waltz', 'Ballroom Reverie', 'Gilded Court', 'Duchess Diaries',
    'Royal Devotion', 'Velvet Crown', 'Court of Two Hearts', 'Regal Promenade', 'Grand Cotillion',
    'Sovereign Vow', 'Palace Waltz',
  ],
  'editorial cream': [
    'Gallery Vow', 'Studio Romance', 'Cream Page', 'Editorial Chapter', 'Muted Frame',
    'Quiet Editorial', 'Blank Canvas Vow', 'Understated Feature', 'Concrete Poetry', 'Modern Manuscript',
    'Cream Manifesto', 'Minimal Frame',
  ],
  'tropical heritage': [
    'Island Homecoming', 'Sampaguita Vow', 'Heritage Harvest', 'Bayanihan Romance', 'Coastal Ancestry',
    'Filipiniana Chapter', 'Kundiman Evening', 'Waling-Waling Bloom', 'Provincial Feast', 'Homeland Reunion',
    'Tropic Harvest Vow', 'Ancestral Garden',
  ],
  'modern minimalist': [
    'Clean Line Vow', 'Architects’ Romance', 'Negative Space', 'Modern Manifesto', 'Structured Devotion',
    'Geometric Heart', 'Sleek Chapter', 'Studio Vow', 'Concrete Romance', 'Precision Promise',
    'Monochrome Manifesto', 'Silhouette Vow',
  ],
  'boho beach': [
    'Barefoot Promise', 'Salt Air Romance', 'Driftwood Vow', 'Tidepool Reverie', 'Windswept Union',
    'Seaglass Chapter', 'Sandy Toes Forever', 'Coastal Wanderer', 'Free Spirit Vow', 'Shoreline Reverie',
    'Sun-Bleached Romance', 'Wild Coast Union',
  ],
  'vintage ilustrado': [
    'Ilustrado Romance', 'Ancestral House Vow', 'Sepia Chapter', 'Antique Lace Promise', 'Colonial Courtyard',
    'Heirloom Ilustrado', 'Piña Silk Vow', 'Old Manila Romance', 'Baroque Homecoming', 'Vintage Portrait Vow',
    'Narra Wood Devotion', 'Gilded Age Vow',
  ],
  'industrial loft': [
    'Warehouse Romance', 'Loft Chapter', 'Steel & Vow', 'Raw Space Devotion', 'Concrete Canvas',
    'Foundry Promise', 'Brick & Ember Vow', 'Exposed Beam Romance', 'Urban Foundry', 'Riveted Devotion',
    'Factory Floor Vow', 'Copper Pipe Romance',
  ],
  'moody garden': [
    'Moonlit Garden Vow', 'Twilight Bloom', 'Candlelit Hillside', 'Gothic Garden Romance', 'Wildflower Dusk',
    'Shadowed Bloom Vow', 'Evening Garden Reverie', 'Dusk Hollow Promise', 'Bramble & Vow', 'Nightfall Garden',
    'Overgrown Romance', 'Hillside Twilight Vow',
  ],
  'destination resort': [
    'Sunset Voyage', 'Horizon Vow', 'Island Escape Romance', 'Tide & Promise', 'Beachfront Reverie',
    'Palm-Lined Vow', 'Turquoise Horizon', 'Getaway Devotion', 'Seabreeze Chapter', 'Faraway Shore Vow',
    'Resort Reverie', 'Wanderlust Union',
  ],
};

const MOOD_PREFIXES: Record<AllMoodTag, string[]> = {
  whimsical_storybook: [
    'A Storybook', 'Once Upon a', 'Fairy-Tale', 'Enchanted', 'Wishing-Well', 'Daydream',
    'Pixie-Light', 'Charmed', 'Wonderland', 'Spellbound', 'Whimsical', 'Fable-Bright',
  ],
  minimalist: [
    'A Quiet', 'Bare', 'Distilled', 'Pared-Back', 'Unadorned', 'Essential',
    'A Single Line of', 'Clean', 'Restrained', 'Uncluttered', 'Plainspoken', 'A Simple',
  ],
  dark_moody: [
    'Midnight', 'Smoldering', 'A Dramatic', 'Shadowed', 'Candlelit', 'Velvet-Dark',
    'A Brooding', 'Twilight', 'Ember-Lit', 'Deep-Toned', 'A Sultry', 'Storm-Kissed',
  ],
  bold_contrasting: [
    'A Bold', 'High-Contrast', 'Fearless', 'Graphic', 'A Striking', 'Vivid',
    'Electric', 'A Daring', 'Sharp-Edged', 'Uncompromising', 'A Vibrant', 'Loud & Proud',
  ],
  simple_understated: [
    'A Quiet', 'Understated', 'A Gentle', 'Unhurried', 'A Soft-Spoken', 'Modest',
    'A Still', 'Grounded', 'A Humble', 'Low-Key', 'A Calm', 'Unfussy',
  ],
  maximalist_complex: [
    'A Lavish', 'Layered', 'An Opulent', 'Abundant', 'A Rich', 'Ornate',
    'A Grand', 'Densely-Bloomed', 'A Sumptuous', 'Baroque', 'An Elaborate', 'Full-Spectrum',
  ],
  romantic_ethereal: [
    'An Ethereal', 'Dreamlike', 'A Gauzy', 'Soft-Focus', 'Cloud-Soft', 'A Wistful',
    'Gossamer', 'A Tender', 'Featherlight', 'A Dreamy', 'Pastel-Kissed', 'Sighing',
  ],
  nostalgic_vintage: [
    'A Nostalgic', 'Sepia-Toned', 'A Vintage', 'Faded-Photograph', 'Old-World', 'A Wistful Vintage',
    'Time-Worn', 'A Keepsake', 'Antique', 'A Remembered', 'Yesteryear’s', 'A Cherished',
  ],
  glam_luxurious: [
    'A Glamorous', 'Gilded', 'An Opulent', 'Diamond-Bright', 'A Lavish Glam', 'Champagne-Soaked',
    'A Red-Carpet', 'Jewel-Toned', 'A Radiant', 'Star-Studded', 'A Luxe', 'Mirror-Bright',
  ],
  organic_natural: [
    'An Earthy', 'Sun-Warmed', 'A Grounded', 'Wildgrown', 'A Rustic', 'Root-Deep',
    'A Weathered', 'Bare-Foot Natural', 'An Unpolished', 'Field-Grown', 'A Windblown', 'Moss-Soft',
  ],
};

function generateName(style: AllStyleFamily, mood: AllMoodTag, variant: number, usedNames: Set<string>): string {
  const nouns = STYLE_NOUNS[style];
  const prefixes = MOOD_PREFIXES[mood];
  // `variant -> (variant % prefixes.length, floor(variant / prefixes.length) %
  // nouns.length)` is INJECTIVE for variant < prefixes.length * nouns.length
  // (12 * 12 = 144 here, well above the ≥25-per-combination requirement) — so
  // every variant in a combination gets a genuinely distinct (prefix, noun)
  // pair, not just a distinct-looking one. `attempt` only kicks in past that
  // range (defensive; never hit at the current bank sizes/variant count).
  let name = '';
  for (let attempt = 0; attempt < prefixes.length * nouns.length; attempt++) {
    const k = variant + attempt * prefixes.length * nouns.length;
    const prefix = prefixes[k % prefixes.length]!;
    const noun = nouns[Math.floor(k / prefixes.length) % nouns.length]!;
    name = `${prefix} ${noun}`;
    if (!usedNames.has(name)) break;
  }
  usedNames.add(name);
  return name;
}

function generateDescription(
  style: AllStyleFamily,
  mood: AllMoodTag,
  anchors: string[],
  reception: ReceptionDesign,
): string {
  const leadName = nearestColorName(anchors[0] ?? '#FAF7F2') ?? 'soft neutral';
  // Walk the rest of the palette for a color whose NAME actually differs from
  // the lead's — two similar-but-not-identical hexes can both resolve to the
  // same nearest name (e.g. two near-creams), which read as an odd "Cream
  // and Cream" repeat. Falls back to a generic phrase only if the whole
  // palette really is one name (near-monochrome moods like simple_understated).
  let accentName: string | null = null;
  for (let i = anchors.length - 1; i >= 1; i--) {
    const candidate = nearestColorName(anchors[i] ?? '');
    if (candidate && candidate !== leadName) {
      accentName = candidate;
      break;
    }
  }
  const styleLabel = STYLE_FAMILY_LABELS[style].toLowerCase();
  const moodLabel = MOOD_LABELS[mood].toLowerCase();
  // The generator only ever authors single ids (see `generateTemplate` below),
  // but the stored shape allows several — read through `optionIds` so this
  // stays correct if a future template is ever authored with a combination.
  const backdropStyle = optionIds(reception.backdrop?.style)[0];
  const highlight = backdropStyle ? ` behind a ${backdropStyle.replace(/_/g, ' ')} backdrop` : '';
  const colorPhrase = accentName ? `${leadName} and ${accentName}` : `${leadName} tones throughout`;
  const article = /^[aeiou]/i.test(moodLabel) ? 'an' : 'a';
  return `${colorPhrase}${highlight} — ${article} ${moodLabel} take on ${styleLabel}.`;
}

// ── row generation ───────────────────────────────────────────────────────

export const THEMES_PER_COMBINATION = 25;

function cycle<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

/** Build one (style, mood, variant) row. Pure + deterministic. */
export function generateTemplate(
  style: AllStyleFamily,
  mood: AllMoodTag,
  variant: number,
  sortOrder: number,
  usedNames: Set<string>,
): Omit<MoodboardThemeTemplate, 'template_id'> {
  const spec = STYLE_SPECS[style];
  const baseHsl = spec.anchors.map(hexToHsl);
  // Rotate which anchor leads for this variant so "which color leads vs.
  // supports" varies across the 25 rows, not just the transform.
  const rotated = baseHsl.map((_, i) => baseHsl[(i + variant) % baseHsl.length]!);
  const transformed = moodTransform(mood, rotated, variant);
  const hexes = transformed.map(hslToHex);

  // RECEPTION IS FIVE (owner directive 2026-09-03) — and it is built as one
  // set, not three colors with two appended. Dominant + Supporting carry the
  // hues; the third anchor becomes the Accent, chroma-tamed ONLY when the
  // first two already spend the whole high-chroma budget (so bold_contrasting
  // and maximalist_complex keep their character while never shipping five
  // competing hues). `completeReceptionFive` then derives the grounding
  // neutral and the related second accent from those three.
  //
  // NOTE the moods that deliberately narrow the hue set — `minimalist` and
  // `simple_understated` trim `moodTransform` to 3 — still land on five here.
  // Their fifth is not a fifth HUE: it is the neutral pair those moods are
  // actually made of. Fewer hues, same five slots.
  const dominant = transformed[0]!;
  const supporting = transformed[1] ?? dominant;
  const thirdAnchor = transformed[2] ?? supporting;
  const spentBudget =
    [dominant, supporting].filter((c) => chromaOf(c) >= HIGH_CHROMA).length >= MAX_HIGH_CHROMA;
  // Taming the chroma must not also move the LIGHTNESS: holding HSL `l` while
  // dropping chroma still darkens a saturated yellow by ~10 points of L*, and
  // that alone was enough to flip four gold themes out of reading light. Hold
  // the anchor's perceptual lightness and change only how loud it is.
  const tamedChroma = Math.min(chromaOf(thirdAnchor), 30);
  const accent: HSL = spentBudget
    ? withChroma(
        thirdAnchor.h,
        tamedChroma,
        hslLightnessForStar(thirdAnchor.h, tamedChroma, lightnessStar(thirdAnchor)),
      )
    : thirdAnchor;
  // MOOD IS PASSED, not inferred: `completeReceptionFive` derives slots 3-4
  // within THIS mood's lightness character (see MOOD_COMPLETION) instead of
  // filling whichever pole is missing, which inverted every palette whose mood
  // deliberately sat at one end.
  const receptionFive = completeReceptionFive([dominant, supporting, accent].map(hslToHex), mood);

  const rolePalette: MoodboardThemeTemplate['role_palette'] = {
    ceremony: [hexes[0]!, hexes[Math.min(3, hexes.length - 1)]!],
    reception: receptionFive,
    bride: [hexes[0]!],
    groom: [hexes[Math.min(2, hexes.length - 1)]!],
    wedding_party: hexes.slice(0, 3),
    guest: [hexes[0]!, ...hexes.slice(1, 3)],
  };

  const r = spec.reception;
  const reception_design: ReceptionDesign = {
    ceiling: { treatment: cycle(r.ceiling, variant) },
    backdrop: { style: cycle(r.backdropStyle, variant + 1), florals: cycle(r.backdropFlorals, variant) },
    stage: { setup: cycle(r.stageSetup, variant), florals: cycle(r.stageFlorals, variant + 2) },
    tables: {
      shape: cycle(r.tableShape, variant),
      chairs: cycle(r.tableChairs, variant + 1),
      linen: cycle(r.tableLinen, variant + 2),
      centerpiece: cycle(r.tableCenter, variant),
      place: cycle(r.tablePlace, variant + 3),
    },
    tunnel: { style: cycle(r.tunnel, variant) },
    entrance: { runner: cycle(r.entranceRunner, variant + 1) },
    walls: { treatment: cycle(r.walls, variant) },
    photo_wall: { style: cycle(r.photoWall, variant + 1) },
    welcome_signage: { style: cycle(r.welcome, variant) },
    people: { who: cycle(r.people, variant) },
  };

  const name = generateName(style, mood, variant, usedNames);
  // Describe the RECEPTION FIVE, not the raw anchor list: the anchors past the
  // third never reach the reception palette, so naming one produced a sentence
  // about a color the couple could not see in their own swatch strip.
  const description = generateDescription(style, mood, receptionFive, reception_design);

  return {
    style_family: style as MoodboardThemeTemplate['style_family'],
    mood_tag: mood as MoodboardThemeTemplate['mood_tag'],
    name,
    description,
    role_palette: rolePalette,
    reception_design,
    sort_order: sortOrder,
  };
}

/**
 * Every (style, mood) combination, THEMES_PER_COMBINATION rows each.
 * `startSortOrder` lets the seed script offset past the 100 hand-authored
 * rows' own 0-99 `sort_order` range (both tables' rows are ordered together
 * by page.tsx's single `.order('sort_order')`), while unit tests can call
 * this with the default 0 to check combination counts in isolation.
 */
export function generateAllThemes(startSortOrder = 0): Array<Omit<MoodboardThemeTemplate, 'template_id'>> {
  const out: Array<Omit<MoodboardThemeTemplate, 'template_id'>> = [];
  let sortOrder = startSortOrder;
  for (const style of ALL_STYLE_FAMILIES) {
    for (const mood of ALL_MOOD_TAGS) {
      const usedNames = new Set<string>();
      for (let variant = 0; variant < THEMES_PER_COMBINATION; variant++) {
        out.push(generateTemplate(style, mood, variant, sortOrder, usedNames));
        sortOrder += 1;
      }
    }
  }
  return out;
}

/**
 * Validate one generated row against the REAL sanitizers — a generator that
 * silently produces schema-invalid values (a key the sanitizer drops, an
 * option id the sanitizer doesn't recognize) is worse than no generator.
 * Returns a list of problems; empty means the row round-trips cleanly.
 */
export function validateGeneratedTemplate(
  row: Omit<MoodboardThemeTemplate, 'template_id'>,
): string[] {
  const problems: string[] = [];
  const sanitizedPalette = sanitizeRolePalette(row.role_palette);
  for (const key of Object.keys(row.role_palette)) {
    const before = (row.role_palette as Record<string, unknown>)[key];
    const after = (sanitizedPalette as Record<string, unknown>)[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      problems.push(`role_palette.${key} was altered/dropped by sanitizeRolePalette`);
    }
  }
  const sanitizedDesign = sanitizeReceptionDesign(row.reception_design);
  for (const [partId, attrs] of Object.entries(row.reception_design)) {
    for (const [attrId, value] of Object.entries(attrs ?? {})) {
      const kept = (sanitizedDesign as ReceptionDesign)[partId as keyof ReceptionDesign]?.[attrId];
      // Compare the RESOLVED id lists, not the raw values: the sanitizer
      // normalizes a one-entry array back to a bare string, which is the same
      // selection and must not be reported as a loss.
      if (optionIds(kept).join('|') !== optionIds(value).join('|')) {
        problems.push(
          `reception_design.${partId}.${attrId}="${JSON.stringify(value)}" was dropped by sanitizeReceptionDesign`,
        );
      }
    }
  }
  if (!row.name || row.name.trim().length === 0) problems.push('name is empty');
  if (!row.description || row.description.trim().length === 0) problems.push('description is empty');
  return problems;
}
