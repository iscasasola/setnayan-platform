/**
 * Candle Stamp Maker — the wax-seal RECIPE (0024 addendum §3 · PR2).
 *
 * A minted seal is a tiny DETERMINISTIC recipe (this type), persisted on
 * `events.wax_seal_config`. The couple's monogram (the stamp die) and the wax
 * colour are NOT stored here — the die is read live from
 * `monogram_uploaded_svg ?? monogram_custom_svg` and the colour defaults to the
 * Mood Board deep accent — so the seal recolours for free and the same recipe
 * renders identically in the maker preview and the live guest reveal (₱0, no
 * per-couple image). `paintWaxSeal` (./paint) is the renderer.
 *
 * Pure, dependency-free → importable on both server (sanitize before write) and
 * client (render). No `Math.random` / `Date.now` in the render path.
 */

export const WAX_SEAL_V = 1;

export type WaxFinish = 'matte' | 'glossy';
export type WaxMarkSource = 'uploaded' | 'custom' | 'letters';

export type WaxSealConfig = {
  /** Schema version — paint branches on it, never breaks old seals. */
  v: number;
  /** uint32 uniqueness anchor: puddle outline jitter, bubbles, rim bulge. */
  seed: number;
  wax: {
    /** `#rrggbb`, or null = inherit the Mood Board deep accent at render. */
    color: string | null;
    finish: WaxFinish;
  };
  pour: {
    /** Puddle size, 0..1 (self-levelling). */
    amount: number;
    /** Organic edge-outline jitter, 0..1 (seeded). */
    irregularity: number;
    /** Overheat micro-bubble density, 0..1. */
    bubbles: number;
  };
  press: {
    /** The 3-zone outcome: <0.34 hot/soft · 0.34–0.74 crisp · >0.74 shallow. */
    crispness: number;
    /** Emboss/deboss displacement, 0..1 (derived from crispness at mint). */
    depth: number;
    /** Hand-made press offset where the die landed, each -1..1. */
    offset: [number, number];
    /** Slight die tilt for authenticity, -1..1. */
    skew: number;
  };
  /** Provenance only (analytics) — the die is still read live. */
  mark: { source: WaxMarkSource };
  /** True when produced by the one-tap "mint a clean seal" fallback. */
  isDefault?: boolean;
  /** ISO timestamp — display/analytics only. */
  mintedAt?: string;
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const clampPm1 = (n: number) => (n < -1 ? -1 : n > 1 ? 1 : n);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && isFinite(v) ? v : fallback);

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Deterministic 32-bit PRNG — same seed → same stream (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable uint32 seed from a public id, so an un-minted couple still gets a
 *  bespoke (not generic) seal. FNV-1a over the string. */
export function fallbackSeedFromPublicId(publicId: string | null | undefined): number {
  let h = 0x811c9dc5;
  const s = publicId ?? 'setnayan';
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The wax colour to render — the explicit override, else the moodboard default. */
export function resolveWaxColor(config: WaxSealConfig | null, fallback: string): string {
  const c = config?.wax?.color;
  return c && HEX.test(c) ? c : fallback;
}

/**
 * Validate + clamp an untrusted recipe (client form / DB row) before it is
 * written or rendered. Returns null when it isn't a usable object (caller then
 * renders from a fallback seed). Defensive: every field clamped/whitelisted.
 */
export function sanitizeWaxSealConfig(raw: unknown): WaxSealConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const seedRaw = r.seed;
  if (typeof seedRaw !== 'number' || !isFinite(seedRaw)) return null;

  const wax = (r.wax ?? {}) as Record<string, unknown>;
  const pour = (r.pour ?? {}) as Record<string, unknown>;
  const press = (r.press ?? {}) as Record<string, unknown>;
  const mark = (r.mark ?? {}) as Record<string, unknown>;

  const color = typeof wax.color === 'string' && HEX.test(wax.color) ? wax.color : null;
  const finish: WaxFinish = wax.finish === 'glossy' ? 'glossy' : 'matte';
  const source: WaxMarkSource =
    mark.source === 'uploaded' || mark.source === 'custom' ? mark.source : 'letters';

  const offRaw = Array.isArray(press.offset) ? press.offset : [];
  const offset: [number, number] = [
    clampPm1(num(offRaw[0], 0)),
    clampPm1(num(offRaw[1], 0)),
  ];

  const config: WaxSealConfig = {
    v: Math.trunc(num(r.v, WAX_SEAL_V)) || WAX_SEAL_V,
    seed: seedRaw >>> 0,
    wax: { color, finish },
    pour: {
      amount: clamp01(num(pour.amount, 0.6)),
      irregularity: clamp01(num(pour.irregularity, 0.3)),
      bubbles: clamp01(num(pour.bubbles, 0)),
    },
    press: {
      crispness: clamp01(num(press.crispness, 0.7)),
      depth: clamp01(num(press.depth, 0.7)),
      offset,
      skew: clampPm1(num(press.skew, 0)),
    },
    mark: { source },
  };
  if (r.isDefault === true) config.isDefault = true;
  if (typeof r.mintedAt === 'string' && r.mintedAt.length <= 40) config.mintedAt = r.mintedAt;
  return config;
}

/**
 * A pleasant, always-crisp DEFAULT recipe deterministically varied by a seed —
 * used when no seal has been minted yet, so every couple still gets a bespoke
 * (not generic) seal from day one. The maker is authoring, never a gate.
 */
export function defaultConfigFromSeed(seed: number): WaxSealConfig {
  const rnd = mulberry32(seed);
  return {
    v: WAX_SEAL_V,
    seed: seed >>> 0,
    wax: { color: null, finish: 'matte' },
    pour: {
      amount: 0.56 + rnd() * 0.12,
      irregularity: 0.22 + rnd() * 0.16,
      bubbles: 0,
    },
    press: {
      crispness: 0.62 + rnd() * 0.14,
      depth: 0.66 + rnd() * 0.12,
      offset: [(rnd() - 0.5) * 0.16, (rnd() - 0.5) * 0.16],
      skew: (rnd() - 0.5) * 0.1,
    },
    mark: { source: 'letters' },
    isDefault: true,
  };
}
