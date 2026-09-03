/**
 * CIELAB — the one perceptual color space in this codebase.
 *
 * 🛑 DO NOT ADD A SECOND ONE. This file exists because `labOfHex` was private
 * to `moodboard-theme-generator.ts` while `color-names.ts` needed the exact
 * same conversion to stop naming colors out of their hue family. Copying it
 * would have produced two implementations that can drift apart silently — the
 * generator writes the seeded theme descriptions, `color-names` writes the
 * words in them, and a disagreement between the two is invisible until a
 * couple reads "Charcoal" under a pine green. One home, two importers.
 *
 * Why CIELAB and not OKLab/OKLCH: CIELAB is what already ships here (the
 * mood-board completion, its two guard tests, and the ΔE2000 audit that found
 * the 874 indistinguishable palettes all speak it). A second space would mean
 * two sets of thresholds nobody can compare.
 *
 * ⚠ The guard tests `moodboard-theme-generator.test.ts` and
 * `the-completion-cannot-invert-a-theme-s-mood.test.ts` deliberately write
 * CIELAB out again rather than importing it — that is on purpose, so a broken
 * conversion here cannot make its own tests pass. Leave them duplicated.
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
