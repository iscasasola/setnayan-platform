/**
 * lib/reveal-config-pure.ts — the reveal-studio config SHAPE and its LOCKED
 * defaults, with no database in the module graph.
 *
 * Split out of lib/reveal-config.ts, which reads the persisted row through the
 * service-role admin client. The renderers are `'use client'` components
 * (veil-reveal · reveal-particles) and the Reveal Studio panel
 * (app/admin/reveal-studio/studio.tsx) is a client component too — all three
 * need DEFAULT_* and REVEAL_TEMPLATE_IDS as VALUES, and a value import from a
 * module that reaches `createAdminClient` is exactly what
 * `scripts/lint-server-only-boundary.mjs` exists to stop.
 *
 * 🔑 THE MERGE LIVES HERE, NOT NEXT TO THE FETCH. `mergeRevealConfig` is pure
 * over its argument, and it is what makes a missing or partial row resolve to
 * the signed-off look. Keeping it on this side means it stays unit-testable in
 * the node runner (lib/reveal-config.test.ts) and reusable by the admin writer
 * without either of them dragging the admin client along.
 *
 * Server callers keep importing from `@/lib/reveal-config`, which re-exports
 * everything here.
 */

export type RevealTemplateId =
  | 'four-flap'
  | 'two-flap-vertical'
  | 'two-flap-horizontal'
  | 'church-doors'
  | 'veil-sheer';
// gold-monogram / molten-monogram retired as openings 2026-06-22 (now monogram
// motion keys — lib/monogram-motion.ts). Keep this union in lockstep with
// RevealTemplate in reveal-templates.ts.

export const REVEAL_TEMPLATE_IDS: readonly RevealTemplateId[] = [
  'four-flap',
  'two-flap-vertical',
  'two-flap-horizontal',
  'church-doors',
  'veil-sheer',
];

/** The veil "look" knobs — the live slider panel. Mirrors the prototype's §6 table. */
export type VeilLook = {
  tilePx: number; // logo gap px (large = plain veil)
  logoSize: number; // mark size as % of the tile
  logoOpacity: number; // mark opacity (subtle white)
  topValance: number; // top-valance % (the visible fold droop)
  reaches: number; // hem reaches ~% from the bottom
  wind: number; // hem-weighted sway
  folds: number; // bloom fold count
  fullness: number; // fold depth at the hem
  weight: number; // gravity
  trail: number; // fold follow softness
  floatUp: number; // keeps the fold high during reveal
  feather: number; // auto-reveal (feather) seconds
  bounce: number; // settle damping
  petalsDensity: number; // petal count %
  liftPk: number; // hold forward peak
  hold: number; // tap-pinch radius
  stretch: number; // soft strain envelope
};

export type RevealFeatures = {
  petals: boolean;
  logo: boolean;
  music: boolean;
};

/**
 * Rigid-family effect calibration (envelopes → butterflies · church doors →
 * petals). 0–100 console-style values mapped to the canvas particle layer
 * (reveal-particles.tsx). Author-time baked house defaults, admin-tunable in the
 * Reveal Studio (spec `0024_Reveal_Tuning_and_Door_Spec` §7/§8 — petals + butterflies).
 */
export type RevealEffectsLook = {
  butterflySize: number; // wing scale
  butterflyCount: number; // how many are in the air at once
  butterflySpeed: number; // outward fly-from-envelope speed
  petalSize: number; // petal scale
  petalDensity: number; // how many petals fall
  petalFall: number; // fall speed
  shadow: number; // soft cast-shadow strength (both)
};

/**
 * Touch-glow — a soft light that blooms where a finger presses on the
 * Save-the-Date (like a floor that glows where you step in a film). A
 * screen-blend radial bloom that follows the touch and fades on release.
 * Admin-tunable; reads on the public couple page during the STD phase.
 */
export type RevealTouchGlow = {
  enabled: boolean;
  /** Bloom colour (warm candlelight by default; the couple never overrides it). */
  color: string;
  /** Peak brightness 0–100 (mapped to opacity). */
  intensity: number;
  /** Bloom radius 0–100 (mapped to diameter). */
  size: number;
};

export type RevealStudioConfig = {
  /** Master on/off for the reveal (replaces the NEXT_PUBLIC_STD_REVEAL env flag). */
  enabled: boolean;
  /** House-default template when a couple hasn't chosen one. */
  defaultTemplate: RevealTemplateId;
  /** Which templates couples may use (for the future per-event chooser). */
  templates: Record<RevealTemplateId, boolean>;
  /** Per-feature toggles. */
  features: RevealFeatures;
  /** House-default veil tulle colour (the couple's Mood Board palette overrides it). */
  veilColorDefault: string;
  /** House-default petal colour. */
  petalsColor: string;
  /** The veil look knobs. */
  veil: VeilLook;
  /** The rigid-family effect knobs (butterflies + petals). */
  effects: RevealEffectsLook;
  /** Press-to-glow on the Save-the-Date. */
  touchGlow: RevealTouchGlow;
};

/** LOCKED owner-tuned defaults (spec §6, 2026-06-17). Every read merges over these. */
export const DEFAULT_VEIL_LOOK: VeilLook = {
  tilePx: 125,
  logoSize: 9,
  logoOpacity: 22,
  topValance: 30,
  reaches: 10,
  wind: 48,
  folds: 16,
  fullness: 100,
  weight: 26,
  trail: 100,
  floatUp: 100,
  feather: 5.0,
  bounce: 83,
  petalsDensity: 100,
  liftPk: 70,
  hold: 22,
  stretch: 15,
};

/** LOCKED rigid-effect defaults (spec §7 — butterfly size 20 · petal size 22). */
export const DEFAULT_EFFECTS_LOOK: RevealEffectsLook = {
  butterflySize: 45,
  butterflyCount: 60,
  butterflySpeed: 55,
  petalSize: 50,
  petalDensity: 70,
  petalFall: 50,
  shadow: 55,
};

/** Touch-glow defaults — ON, a warm candlelight bloom, subtle. */
export const DEFAULT_TOUCH_GLOW: RevealTouchGlow = {
  enabled: true,
  color: '#FBE9C8',
  intensity: 55,
  size: 50,
};

export const DEFAULT_REVEAL_CONFIG: RevealStudioConfig = {
  // Off by default — same as the env-flag-off default today; admin flips it on.
  // (The ?reveal= URL override works only on a NEXT_PUBLIC_STD_REVEAL=1 preview
  // build — SEC-3 2026-07-26 scoped it; in production the param is inert.)
  enabled: false,
  defaultTemplate: 'veil-sheer',
  templates: {
    'four-flap': true,
    'two-flap-vertical': true,
    'two-flap-horizontal': true,
    'church-doors': true,
    'veil-sheer': true,
  },
  features: { petals: true, logo: true, music: false },
  veilColorDefault: '#f3ece1',
  petalsColor: '#e87a93',
  veil: DEFAULT_VEIL_LOOK,
  effects: DEFAULT_EFFECTS_LOOK,
  touchGlow: DEFAULT_TOUCH_GLOW,
};

// ── helpers ────────────────────────────────────────────────────────────────

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function clamp(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}
function hex(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback;
}
function isTemplateId(v: unknown): v is RevealTemplateId {
  return typeof v === 'string' && (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v);
}

function mergeLook(raw: unknown): VeilLook {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_VEIL_LOOK;
  return {
    // Clamp each knob to its Reveal-Studio SliderDef range
    // (app/admin/reveal-studio/studio.tsx). `num()` only checked finiteness — an
    // out-of-range persisted JSONB value can corrupt the veil sim and, via the
    // shared petal/density knobs, feed a negative Canvas2D radius → IndexSizeError
    // on the public Save-the-Date page. Parity with mergeEffects / mergeTouchGlow.
    tilePx: clamp(r.tilePx, d.tilePx, 40, 400),
    logoSize: clamp(r.logoSize, d.logoSize, 2, 30),
    logoOpacity: clamp(r.logoOpacity, d.logoOpacity, 0, 100),
    topValance: clamp(r.topValance, d.topValance, 0, 70),
    reaches: clamp(r.reaches, d.reaches, 0, 30),
    wind: clamp(r.wind, d.wind, 0, 100),
    folds: clamp(r.folds, d.folds, 4, 30),
    fullness: clamp(r.fullness, d.fullness, 0, 100),
    weight: clamp(r.weight, d.weight, 0, 100),
    trail: clamp(r.trail, d.trail, 0, 100),
    floatUp: clamp(r.floatUp, d.floatUp, 0, 100),
    feather: clamp(r.feather, d.feather, 2, 8),
    bounce: clamp(r.bounce, d.bounce, 0, 100),
    petalsDensity: clamp(r.petalsDensity, d.petalsDensity, 0, 100),
    liftPk: clamp(r.liftPk, d.liftPk, 0, 100),
    hold: clamp(r.hold, d.hold, 0, 100),
    stretch: clamp(r.stretch, d.stretch, 0, 100),
  };
}

function mergeEffects(raw: unknown): RevealEffectsLook {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_EFFECTS_LOOK;
  return {
    // Clamp every 0–100 slider (parity with mergeTouchGlow). A persisted
    // out-of-range value would drive the petal/butterfly ellipse radius
    // negative in reveal-particles → IndexSizeError crashing the public
    // Save-the-Date page. `num()` only checks finiteness, not range.
    butterflySize: clamp(r.butterflySize, d.butterflySize, 0, 100),
    butterflyCount: clamp(r.butterflyCount, d.butterflyCount, 0, 100),
    butterflySpeed: clamp(r.butterflySpeed, d.butterflySpeed, 0, 100),
    petalSize: clamp(r.petalSize, d.petalSize, 0, 100),
    petalDensity: clamp(r.petalDensity, d.petalDensity, 0, 100),
    petalFall: clamp(r.petalFall, d.petalFall, 0, 100),
    shadow: clamp(r.shadow, d.shadow, 0, 100),
  };
}

/** Deep-merge a raw JSONB value over the locked defaults, with type guards. */
export function mergeRevealConfig(raw: unknown): RevealStudioConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_REVEAL_CONFIG;
  const rawTemplates = (r.templates ?? {}) as Record<string, unknown>;
  const templates = { ...d.templates };
  for (const id of REVEAL_TEMPLATE_IDS) templates[id] = bool(rawTemplates[id], d.templates[id]);
  const rawFeatures = (r.features ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(r.enabled, d.enabled),
    defaultTemplate: isTemplateId(r.defaultTemplate) ? r.defaultTemplate : d.defaultTemplate,
    templates,
    features: {
      petals: bool(rawFeatures.petals, d.features.petals),
      logo: bool(rawFeatures.logo, d.features.logo),
      music: bool(rawFeatures.music, d.features.music),
    },
    veilColorDefault: hex(r.veilColorDefault, d.veilColorDefault),
    petalsColor: hex(r.petalsColor, d.petalsColor),
    veil: mergeLook(r.veil),
    effects: mergeEffects(r.effects),
    touchGlow: mergeTouchGlow(r.touchGlow),
  };
}

function mergeTouchGlow(raw: unknown): RevealTouchGlow {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_TOUCH_GLOW;
  return {
    enabled: bool(r.enabled, d.enabled),
    color: hex(r.color, d.color),
    intensity: clamp(r.intensity, d.intensity, 0, 100),
    size: clamp(r.size, d.size, 0, 100),
  };
}
