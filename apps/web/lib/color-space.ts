/**
 * The two perceptual color spaces in this codebase — CIELAB and OKLCH — and
 * NOTHING ELSE. This file is their one shared home so a reader can compare
 * every threshold in both without hunting across files for a third.
 *
 * 🛑 DO NOT ADD A THIRD ONE. `color-space-has-exactly-two-perceptual-spaces
 * .test.ts` pins this by fingerprinting each conversion matrix and failing if
 * either appears anywhere in `apps/web/lib` outside this file (test files that
 * deliberately duplicate one for guard independence are the sole exception —
 * see below). That test is the enforcement; this comment is the reasoning.
 *
 * ── THE BOUNDARY, STATED EXPLICITLY ──────────────────────────────────────
 *
 *   CIELAB  — colour NAMING (`color-names.ts`) and ΔE audits. Unchanged.
 *   OKLCH   — the palette-style engine (`palette-styles.ts`) ONLY.
 *
 * ONE IMPORTER EACH. `color-names.ts` imports the CIELAB section below;
 * `palette-styles.ts` imports the OKLCH section further down. Neither
 * reimplements the other's math, and neither reimplements its own — see the
 * guard test.
 *
 * ── WHY TWO SPACES INSTEAD OF ONE ────────────────────────────────────────
 *
 * This looks exactly like the two-thresholds-nobody-can-compare risk the
 * original one-space rule existed to prevent. It was allowed only after
 * measuring, not assuming, that CIELAB could not do the palette engine's job:
 *
 *   · The six-rank VISIBILITY ORDERING does NOT need OKLCH — CIELAB carries
 *     it identically (0 inversions / 97 ordered pairs, fuzzed too). This is
 *     not the justification for OKLCH; if it were the only difference, this
 *     file would still say one space.
 *   · The HUE AND CHROMA GATES do, and the reason is structural, not a
 *     re-tune. Every one of `palette-styles.ts`'s ~14 hue/chroma constants
 *     (`NEON_C_MAX`, `RANK_CHROMA_CAP`, `WARM_HUE_MAX`, …) is a SINGLE number
 *     applied at every hue and every lightness. In OKLCH that number is right
 *     everywhere. In CIELAB the right number MOVES: a full CIELAB port,
 *     re-tuned against the same fixtures, measured the achievable chroma
 *     scale spanning 3.21–4.35 across hue sectors inside the engine's own
 *     operating window (36% spread), and the warm-arc hue boundary swinging
 *     107.5°→112.75° across its lightness sweep. A single CIELAB threshold
 *     cannot be correct across that range.
 *   · MEASURED CONSEQUENCE: the re-tuned CIELAB engine emitted 7 cool
 *     colours on all-warm palettes where the OKLCH engine emits 0 — dark
 *     olive-greens on burgundy-and-gold weddings. That is verbatim the
 *     defect `palette-styles.ts`'s warm-arc guard exists to prevent, so a
 *     CIELAB engine would have shipped inert against its own stated purpose.
 *
 * This file exists because `labOfHex` was private to
 * `moodboard-theme-generator.ts` while `color-names.ts` needed the exact same
 * conversion to stop naming colors out of their hue family. Copying it would
 * have produced two implementations that can drift apart silently — the
 * generator writes the seeded theme descriptions, `color-names` writes the
 * words in them, and a disagreement between the two is invisible until a
 * couple reads "Charcoal" under a pine green. One home per space, one
 * importer per space.
 *
 * ⚠ The guard tests `moodboard-theme-generator.test.ts`,
 * `the-completion-cannot-invert-a-theme-s-mood.test.ts` and
 * `color-names.test.ts` deliberately write CIELAB out again rather than
 * importing it — that is on purpose, so a broken conversion here cannot make
 * its own tests pass. Leave them duplicated; the third-space guard test
 * allows exactly this file plus test files to hold either fingerprint.
 */

export type Lab = { L: number; a: number; b: number };

/** sRGB hex (`#RRGGBB`) → CIELAB (D65, 2°). */
export function labOfHex(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  const r = lin(((n >> 16) & 255) / 255);
  const g = lin(((n >> 8) & 255) / 255);
  const b = lin((n & 255) / 255);
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * CIE76 (plain Euclidean Lab) distance.
 *
 * Deliberately NOT ΔE2000 — the audit that finds this class of defect measures
 * in ΔE2000, and shipped code sharing a formula with its own audit agrees with
 * it by construction rather than by being right.
 */
export function labDistance(p: Lab, q: Lab): number {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

/** Perceptual colorfulness, C*ab. Zero on any pure grey. */
export function chromaStar(lab: Lab): number {
  return Math.hypot(lab.a, lab.b);
}

/** Perceptual hue angle h_ab, degrees in [0, 360). Meaningless near C*ab 0. */
export function hueStar(lab: Lab): number {
  return ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
}

/** Shortest angular distance between two hue angles, 0-180°. */
export function hueDeltaDeg(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * sRGB hue angle, degrees in [0, 360) — the polar form of the RGB triple
 * itself (the H of HSV/HSL). Zero on any pure grey.
 *
 * 🛑 THIS IS NOT A SECOND PERCEPTUAL COLOR SPACE and the rule at the top of
 * this file still stands — there is no OKLab here, no second set of ΔE
 * thresholds, nothing to drift out of step with CIELAB. This is arithmetic on
 * the same three sRGB bytes `labOfHex` already reads, and it exists for ONE
 * measured reason: CIELAB hue cannot see the blue/purple boundary at all.
 *
 * Measured on the sRGB primaries and the CSS table, in Lab hue vs sRGB hue:
 *
 *   sRGB blue #0000FF        lab 306.3°   srgb 240.0°
 *   Medium Purple #9370DB    lab 306.3°   srgb 259.6°   ← IDENTICAL Lab hue
 *   Violet #EE82EE           lab 326.8°   srgb 300.0°
 *
 * Pure blue and a medium purple have the SAME CIELAB hue angle to one decimal
 * place. The whole blue→violet arc is 21° wide in Lab and 60° in sRGB, while
 * cyan→blue is 110° in Lab and the same 60° in sRGB — so Lab compresses the
 * one boundary a person is most confident about by 3x and expands a boundary
 * they barely see by 2x. No threshold on `deltaHStar` or `hueDeltaDeg` can
 * separate a blue from a purple, at any value, which is why the hue guard in
 * `color-names.ts` reads both angles and not just the perceptual one.
 */
export function srgbHueDeg(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/**
 * CIE ΔH*ab — the hue difference expressed in the SAME Lab units as ΔE, so it
 * can carry a threshold that means one thing everywhere.
 *
 * 🔑 WHY NOT A PLAIN DEGREE TOLERANCE: Lab hue is wildly non-uniform. Measured
 * on the sRGB primaries/secondaries, yellow sits at 103° and green at 136° —
 * 33° apart — while cyan (196°) and blue (306°) are 110° apart. A single
 * degree tolerance is therefore several families wide in the greens and barely
 * a shade wide in the blues. ΔH* is chroma-weighted (`2·√(C₁C₂)·sin(Δh/2)`),
 * which is also what the eye does: 20° between two dull colors is a nuance,
 * 20° between two saturated ones is a different color.
 */
export function deltaHStar(p: Lab, q: Lab): number {
  const c1 = chromaStar(p);
  const c2 = chromaStar(q);
  const dh = (hueDeltaDeg(hueStar(p), hueStar(q)) * Math.PI) / 180;
  return 2 * Math.sqrt(c1 * c2) * Math.sin(dh / 2);
}

// ═══════════════════════════════════════════════════════════════════════
// OKLCH — the palette-style engine's perceptual space. See the file-level
// docblock above for the boundary this section observes: ONLY
// `palette-styles.ts` may import from here, and only for palette-style
// derivation, never for naming.
// ═══════════════════════════════════════════════════════════════════════

/**
 * OKLCH measurement of a colour, carrying its OKLab Cartesian coordinates
 * (`a`, `b`) alongside the polar form (`C`, `H`) derived from them, plus the
 * normalized hex it was measured from. The polar and Cartesian forms are
 * kept side by side — rather than one recomputed from the other on every
 * read — because the palette engine reads both: `visibility()` measures
 * separation in the Cartesian plane, while the hue/chroma gates read the
 * polar form directly.
 */
export type Oklch = { L: number; a: number; b: number; C: number; H: number; hex: string };

function clampUnit(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function rgb01ToHex(r: number, g: number, b: number): string {
  const f = (c: number) =>
    Math.round(clampUnit(c) * 255)
      .toString(16)
      .padStart(2, '0');
  return ('#' + f(r) + f(g) + f(b)).toUpperCase();
}
function oklchToLinearSrgb(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function oklchToGammaSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
/** sRGB (0–1) → OKLab `[L, a, b]`. Bradford-free, D65 — the reference OKLab matrices. */
function rgb01ToOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const R = oklchToLinearSrgb(r);
  const G = oklchToLinearSrgb(g);
  const B = oklchToLinearSrgb(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
/** OKLab `[L, a, b]` → sRGB (0–1, NOT gamut-clamped — callers clamp via `maxOklchChroma`). */
function oklabToRgb01([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    oklchToGammaSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    oklchToGammaSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    oklchToGammaSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const OKLCH_DEG = 180 / Math.PI;

/** sRGB hex (`#RRGGBB`) → OKLCH. */
export function oklchOfHex(hex: string): Oklch {
  const [L, a, b] = rgb01ToOklab(hexToRgb01(hex));
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * OKLCH_DEG) % 360;
  if (H < 0) H += 360;
  return { L, a, b, C, H, hex: hex.toUpperCase() };
}

function oklchToRgb01(L: number, C: number, H: number): [number, number, number] {
  return oklabToRgb01([L, C * Math.cos(H / OKLCH_DEG), C * Math.sin(H / OKLCH_DEG)]);
}
function inOklchGamut(L: number, C: number, H: number): boolean {
  const [r, g, b] = oklchToRgb01(L, C, H);
  const e = 1e-4;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e;
}

/**
 * Largest chroma reachable at this lightness/hue while staying inside the
 * sRGB gamut — a binary search on the gamut boundary, 24 iterations (better
 * than 1e-7 precision on the [0, 0.5] chroma range this engine operates in).
 */
export function maxOklchChroma(L: number, H: number): number {
  if (!inOklchGamut(L, 0, H)) return 0;
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (inOklchGamut(L, m, H)) lo = m;
    else hi = m;
  }
  return lo;
}

/** OKLCH `(L, C, H)` → sRGB hex, gamut-clamping `C` via `maxOklchChroma` first. */
export function hexOfOklch(L: number, C: number, H: number): string {
  const Lc = clampUnit(L);
  const Hn = ((H % 360) + 360) % 360;
  const Cc = Math.min(Math.max(C, 0), maxOklchChroma(Lc, Hn));
  const [r, g, b] = oklchToRgb01(Lc, Cc, Hn);
  return rgb01ToHex(r, g, b);
}

/** Euclidean distance in the OKLab Cartesian plane — ΔEok. */
export function oklchDistance(p: Oklch, q: Oklch): number {
  return Math.hypot(
    p.L - q.L,
    p.C * Math.cos(p.H / OKLCH_DEG) - q.C * Math.cos(q.H / OKLCH_DEG),
    p.C * Math.sin(p.H / OKLCH_DEG) - q.C * Math.sin(q.H / OKLCH_DEG),
  );
}
