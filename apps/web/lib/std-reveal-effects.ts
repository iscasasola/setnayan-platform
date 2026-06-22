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
};

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
