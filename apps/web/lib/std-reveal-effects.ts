/**
 * Per-event Save-the-Date reveal effect toggles (events.std_reveal_effects).
 * Couple-facing controls on the opening:
 *   - butterflies → (stored, no longer drawn: the retired envelopes' particle layer went with them, 23 Nov 2026)
 *   - petals      → the sheer veil's falling petals
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
import { REVEAL_SPEEDS, snapRevealSpeed } from './reveal-motion';
import {
  DEFAULT_EFFECTS_LOOK,
  DEFAULT_VEIL_LOOK,
  REVEAL_TEMPLATE_IDS,
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
   EVERY reveal reads `speed` (⏱ 9 · 12 · 16 s hands-free, `lib/reveal-motion.ts` — owner 23 Nov 2026: one speed,
   no reveal has timing of its own); the veil also reads `petalsDensity`. The petal / butterfly knobs of the
   retired rigid openings resolve still (stored tunes stay readable) but no reveal offers them.
   ═══════════════════════════════════════════════════════════════════════════ */

export type RevealTuneKey =
  | 'speed'
  | 'wind'
  | 'petalsDensity'
  | 'petalDensity'
  | 'petalSize'
  | 'petalFall'
  | 'butterflyCount'
  | 'butterflySpeed'
  | 'butterflySize'
  /* 🧵 The Sheer veil's Style choices (owner 2026-10-17 — Fold ▾ · Weave ▾ · Wind ▾, `lib/veil-style.ts`): three
     presets each, stored as these house-look overrides, so the guest's veil plays them through the SAME
     `tuneRevealLooks` every surface already reads. No slider offers them (`revealTuneKnobsFor` leaves them out). */
  | 'drape'
  | 'weave'
  | 'gust';
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
  /** A knob that is a CHOICE, not a slider (⏱ speed: 9 · 12 · 16) — drawn as a dropdown, resolved to the nearest. */
  choices?: readonly number[];
};

/** The ranges are `mergeLook` / `mergeEffects`' own clamps (held by a test). */
export const REVEAL_TUNE_KNOBS: Record<RevealTuneKey, RevealTuneKnob> = {
  speed: { key: 'speed', look: 'veil', label: 'Speed', lo: 'Quick', hi: 'Slow', min: REVEAL_SPEEDS[0], max: REVEAL_SPEEDS[REVEAL_SPEEDS.length - 1]!, step: 1, choices: REVEAL_SPEEDS },
  wind: { key: 'wind', look: 'veil', label: 'Sway', lo: 'Still', hi: 'Breezy', min: 0, max: 100, step: 1 },
  petalsDensity: { key: 'petalsDensity', look: 'veil', label: 'Petal amount', lo: 'Few', hi: 'Many', min: 0, max: 100, step: 1 },
  petalDensity: { key: 'petalDensity', look: 'effects', label: 'Petal amount', lo: 'Few', hi: 'Many', min: 0, max: 100, step: 1 },
  petalSize: { key: 'petalSize', look: 'effects', label: 'Petal size', lo: 'Small', hi: 'Large', min: 0, max: 100, step: 1 },
  petalFall: { key: 'petalFall', look: 'effects', label: 'Petal fall speed', lo: 'Slow', hi: 'Fast', min: 0, max: 100, step: 1 },
  butterflyCount: { key: 'butterflyCount', look: 'effects', label: 'Butterflies', lo: 'Few', hi: 'Many', min: 0, max: 100, step: 1 },
  butterflySpeed: { key: 'butterflySpeed', look: 'effects', label: 'Butterfly speed', lo: 'Slow', hi: 'Fast', min: 0, max: 100, step: 1 },
  butterflySize: { key: 'butterflySize', look: 'effects', label: 'Butterfly size', lo: 'Small', hi: 'Large', min: 0, max: 100, step: 1 },
  drape: { key: 'drape', look: 'veil', label: 'Fold', lo: 'Light', hi: 'Full', min: 0, max: 70, step: 1 },
  weave: { key: 'weave', look: 'veil', label: 'Weave', lo: 'Fine', hi: 'Dense', min: 0, max: 100, step: 1 },
  gust: { key: 'gust', look: 'veil', label: 'Gusts', lo: 'Even', hi: 'Gusty', min: 0, max: 100, step: 1 },
};

/** The knobs THIS opening's engine reads, given what the couple has switched on. */
export function revealTuneKnobsFor(opening: string, effects: Pick<RevealEffects, 'petals' | 'butterflies'>): RevealTuneKnob[] {
  const K = REVEAL_TUNE_KNOBS;
  /* 🌬 The veil's wind is Wind ▾ on Cover Scene › Style now (owner 2026-10-17, `lib/veil-style.ts` — Still · Breeze ·
     Gusty onto this same `tune.wind`): one control for it, so the old Sway slider is not offered beside it. */
  if (opening === 'veil-sheer') return effects.petals ? [K.speed, K.petalsDensity] : [K.speed];
  /* ⏱ Every other reveal: its speed alone (the drawing's scenes have no knob of their own). */
  if ((REVEAL_TEMPLATE_IDS as readonly string[]).includes(opening)) return [K.speed];
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
    if (knob.choices) {
      out[knob.key] = snapRevealSpeed(v);
      continue;
    }
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
