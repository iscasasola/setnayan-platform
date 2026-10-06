/**
 * Per-event Save-the-Date reveal effect toggles (events.std_reveal_effects).
 * Couple-facing controls on the opening:
 *   - butterflies → envelope openings (four-flap / two-flap-*)
 *   - petals      → church doors + sheer veil
 *   - music       → whether the song plays on the Save-the-Date
 *   - veilColor   → tulle colour override (veil) — null inherits the Mood Board
 *   - petalColor  → petal colour override (veil) — null inherits the Mood Board
 *
 * The COUPLE'S VEIL CONTROLS (owner 2026-06-18) are exactly four: Add music ·
 * Add petals · Veil colour · Petal colour. This overrides the earlier "colours
 * auto-inherit from the Mood Board, no picker" line for the veil — the couple
 * sets the veil + petal colours directly; the admin Reveal Studio still owns the
 * veil LOOK (folds / weight / wind). Colour overrides are null → inherit.
 *
 * The wax seal is NOT an effect — it's the structural open-gate, always on for
 * envelopes (owner-locked 2026-06-18).
 */
import {
  DEFAULT_EFFECTS_LOOK,
  DEFAULT_VEIL_LOOK,
  mergeRevealConfig,
  type RevealEffectsLook,
  type VeilLook,
} from './reveal-config-pure';

/**
 * Gold-monogram opening DIALS (owner 2026-06-22) — the couple mixes-and-matches
 * three independent channels for the 'gold-monogram' reveal:
 *   buildUp — how the mark FORMS (trace each element · assemble · grow · float-land)
 *   move    — its 3D CHARACTER (turn medallion · hover · swing · pop)
 *   accent  — the finishing flourish (shimmer · sparkle · ember · foil flash · rays · engrave)
 * Composed by GoldMonogramReveal on nested wrappers so the three never collide.
 * Styling INSIDE the already-unlocked ₱799 opening — not a gate.
 */
export type GoldBuildUp = 'trace' | 'assemble' | 'grow' | 'float-land';
export type GoldMove = 'turn' | 'hover' | 'swing' | 'pop';
export type GoldAccent =
  | 'shimmer'
  | 'sparkle'
  | 'ember-rise'
  | 'foil-flash'
  | 'light-rays'
  | 'engrave';
export type GoldRevealDials = { buildUp: GoldBuildUp; move: GoldMove; accent: GoldAccent };

export const GOLD_BUILDUPS: readonly GoldBuildUp[] = ['trace', 'assemble', 'grow', 'float-land'];
export const GOLD_MOVES: readonly GoldMove[] = ['turn', 'hover', 'swing', 'pop'];
export const GOLD_ACCENTS: readonly GoldAccent[] = [
  'shimmer',
  'sparkle',
  'ember-rise',
  'foil-flash',
  'light-rays',
  'engrave',
];

/** Default = the premium headline: each element inks itself, turns in, catches the light. */
export const DEFAULT_GOLD_DIALS: GoldRevealDials = {
  buildUp: 'trace',
  move: 'turn',
  accent: 'shimmer',
};

export type RevealEffects = {
  butterflies: boolean;
  petals: boolean;
  /** Play the song on the Save-the-Date (veil control "Add music"). */
  music: boolean;
  /** Veil tulle colour override (hex). Null → inherit the Mood Board palette. */
  veilColor: string | null;
  /** Petal colour override (hex). Null → inherit the Mood Board palette. */
  petalColor: string | null;
  /** The 3 dials for the gold-monogram opening (ignored by other openings). */
  gold: GoldRevealDials;
  /** The couple's FINE-TUNE over the Reveal Studio's house look — present only
   *  when they have moved a slider (`resolveRevealTune`). */
  tune?: RevealTune;
};

/* ═══════════════════════════════════════════════════════════════════════════
   🎚 THE COUPLE'S FINE-TUNE (owner 2026-09-27: *"where is the petal speed and
   other fine tuning?"* — DECISION_LOG 2026-09-21 "ONE REVEAL, AND IT
   FINE-TUNES", 2026-09-25 "pick a reveal and see the effects, fine tune it to
   your liking").

   The engine already has the knobs — the Reveal Studio's house look
   (`lib/reveal-config-pure.ts`: `VeilLook`, `RevealEffectsLook`). A couple's
   tune is a SPARSE override of a few of them, stored beside their effects in
   `events.std_reveal_effects.tune` (no new column), and laid over the house
   look where the opening plays (`tuneRevealLooks`). The ranges ARE the house
   resolver's clamps — `mergeRevealConfig` clamps the tuned look again, so a
   stored value can never leave the range the engine was tuned for.

   Only the knobs the opening's engine actually reads are offered for it:
   the veil reads `feather` (lift time), `wind` and `petalsDensity`; church
   doors read the petal knobs; envelopes the butterfly knobs
   (`reveal-particles.tsx`). The veil's own petals have no size or fall knob.
   ═══════════════════════════════════════════════════════════════════════════ */

export type RevealTuneKey =
  | 'feather'
  | 'wind'
  | 'petalsDensity'
  | 'petalDensity'
  | 'petalSize'
  | 'petalFall'
  | 'butterflyCount'
  | 'butterflySpeed'
  | 'butterflySize';
export type RevealTune = Partial<Record<RevealTuneKey, number>>;

export type RevealTuneKnob = {
  key: RevealTuneKey;
  /** Which house look it overrides. */
  look: 'veil' | 'effects';
  label: string;
  lo: string;
  hi: string;
  min: number;
  max: number;
  step: number;
};

/** The ranges are `mergeLook` / `mergeEffects`' own clamps (held by a test). */
export const REVEAL_TUNE_KNOBS: Record<RevealTuneKey, RevealTuneKnob> = {
  feather: { key: 'feather', look: 'veil', label: 'Speed', lo: 'Quick', hi: 'Slow', min: 2, max: 8, step: 0.5 },
  wind: { key: 'wind', look: 'veil', label: 'Sway', lo: 'Still', hi: 'Breezy', min: 0, max: 100, step: 1 },
  petalsDensity: { key: 'petalsDensity', look: 'veil', label: 'Petal amount', lo: 'Few', hi: 'Many', min: 0, max: 100, step: 1 },
  petalDensity: { key: 'petalDensity', look: 'effects', label: 'Petal amount', lo: 'Few', hi: 'Many', min: 0, max: 100, step: 1 },
  petalSize: { key: 'petalSize', look: 'effects', label: 'Petal size', lo: 'Small', hi: 'Large', min: 0, max: 100, step: 1 },
  petalFall: { key: 'petalFall', look: 'effects', label: 'Petal fall speed', lo: 'Slow', hi: 'Fast', min: 0, max: 100, step: 1 },
  butterflyCount: { key: 'butterflyCount', look: 'effects', label: 'Butterflies', lo: 'Few', hi: 'Many', min: 0, max: 100, step: 1 },
  butterflySpeed: { key: 'butterflySpeed', look: 'effects', label: 'Butterfly speed', lo: 'Slow', hi: 'Fast', min: 0, max: 100, step: 1 },
  butterflySize: { key: 'butterflySize', look: 'effects', label: 'Butterfly size', lo: 'Small', hi: 'Large', min: 0, max: 100, step: 1 },
};

const ENVELOPE_OPENINGS = new Set(['four-flap', 'two-flap-vertical', 'two-flap-horizontal']);

/** The knobs THIS opening's engine reads, given what the couple has switched on. */
export function revealTuneKnobsFor(opening: string, effects: Pick<RevealEffects, 'petals' | 'butterflies'>): RevealTuneKnob[] {
  const K = REVEAL_TUNE_KNOBS;
  if (opening === 'veil-sheer') return effects.petals ? [K.feather, K.wind, K.petalsDensity] : [K.feather, K.wind];
  if (opening === 'church-doors') return effects.petals ? [K.petalDensity, K.petalSize, K.petalFall] : [];
  if (ENVELOPE_OPENINGS.has(opening)) {
    return effects.butterflies ? [K.butterflyCount, K.butterflySpeed, K.butterflySize] : [];
  }
  return [];
}

/** The house look's value for every knob — where an untuned slider rests. */
export type RevealTuneHouse = Record<RevealTuneKey, number>;

export function revealTuneHouse(
  config: { veil?: VeilLook; effects?: RevealEffectsLook } | null | undefined,
): RevealTuneHouse {
  const veil = config?.veil ?? DEFAULT_VEIL_LOOK;
  const effects = config?.effects ?? DEFAULT_EFFECTS_LOOK;
  const out = {} as RevealTuneHouse;
  for (const knob of Object.values(REVEAL_TUNE_KNOBS)) {
    const raw = knob.look === 'veil' ? veil[knob.key as keyof VeilLook] : effects[knob.key as keyof RevealEffectsLook];
    out[knob.key] = Math.min(knob.max, Math.max(knob.min, raw));
  }
  return out;
}

/** Sparse, finite, clamped, snapped to the slider's step — anything else dropped. */
export function resolveRevealTune(raw: unknown): RevealTune {
  const out: RevealTune = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  for (const knob of Object.values(REVEAL_TUNE_KNOBS)) {
    const v = o[knob.key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const snapped = Math.round(v / knob.step) * knob.step;
    out[knob.key] = Math.min(knob.max, Math.max(knob.min, Number(snapped.toFixed(2))));
  }
  return out;
}

/** NULL/legacy → petals on, music on, colours inherit the Mood Board, butterflies off,
 *  gold dials at their premium defaults. */
export const DEFAULT_REVEAL_EFFECTS: RevealEffects = {
  butterflies: false,
  petals: true,
  music: true,
  veilColor: null,
  petalColor: null,
  gold: DEFAULT_GOLD_DIALS,
};

/** A 3/6-digit hex (#rgb / #rrggbb) or null — anything else coerces to null. */
function coerceHex(v: unknown): string | null {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v) ? v : null;
}

/** Coerce a value against a closed allowed-set, falling back to a default. */
function coerceEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Validate/default the 3 gold dials from raw JSON — never throws, always complete. */
export function resolveGoldDials(raw: unknown): GoldRevealDials {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    buildUp: coerceEnum(o.buildUp, GOLD_BUILDUPS, DEFAULT_GOLD_DIALS.buildUp),
    move: coerceEnum(o.move, GOLD_MOVES, DEFAULT_GOLD_DIALS.move),
    accent: coerceEnum(o.accent, GOLD_ACCENTS, DEFAULT_GOLD_DIALS.accent),
  };
}

export function resolveRevealEffects(raw: unknown): RevealEffects {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return {
      butterflies:
        typeof o.butterflies === 'boolean' ? o.butterflies : DEFAULT_REVEAL_EFFECTS.butterflies,
      petals: typeof o.petals === 'boolean' ? o.petals : DEFAULT_REVEAL_EFFECTS.petals,
      music: typeof o.music === 'boolean' ? o.music : DEFAULT_REVEAL_EFFECTS.music,
      veilColor: coerceHex(o.veilColor),
      petalColor: coerceHex(o.petalColor),
      gold: resolveGoldDials(o.gold),
      // Present only when the couple tuned something, so an untuned event's
      // effects are exactly what they were before the fine-tune existed.
      ...(() => {
        const tune = resolveRevealTune(o.tune);
        return Object.keys(tune).length > 0 ? { tune } : {};
      })(),
    };
  }
  return { ...DEFAULT_REVEAL_EFFECTS };
}

/**
 * The rigid-family particle effect for a given opening + toggles.
 * Veil returns null here (it renders petals via its own WebGL `features.petals`,
 * not the rigid canvas-2D layer).
 */
export function rigidEffectFor(
  template: string,
  effects: RevealEffects,
): 'butterflies' | 'petals' | null {
  if (template === 'veil-sheer') return null;
  if (template === 'church-doors') return effects.petals ? 'petals' : null;
  return effects.butterflies ? 'butterflies' : null; // envelopes
}

/**
 * The house look with the couple's tune laid over it — what the opening plays
 * with. No tune → the house look untouched (the very same objects). The result
 * goes back through `mergeRevealConfig`, the house resolver, so every value is
 * clamped exactly as an admin's would be.
 */
export function tuneRevealLooks(
  config: { veil?: VeilLook; effects?: RevealEffectsLook } | null | undefined,
  tune: RevealTune | undefined,
): { veil: VeilLook | undefined; effects: RevealEffectsLook | undefined } {
  const t = resolveRevealTune(tune);
  if (Object.keys(t).length === 0) return { veil: config?.veil, effects: config?.effects };
  const veilTune: Record<string, number> = {};
  const effectsTune: Record<string, number> = {};
  for (const [key, value] of Object.entries(t) as [RevealTuneKey, number][]) {
    (REVEAL_TUNE_KNOBS[key].look === 'veil' ? veilTune : effectsTune)[key] = value;
  }
  const merged = mergeRevealConfig({
    veil: { ...(config?.veil ?? DEFAULT_VEIL_LOOK), ...veilTune },
    effects: { ...(config?.effects ?? DEFAULT_EFFECTS_LOOK), ...effectsTune },
  });
  return { veil: merged.veil, effects: merged.effects };
}
