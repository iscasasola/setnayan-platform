/**
 * Per-event Save-the-Date reveal effect toggles (events.std_reveal_effects).
 * Couple-facing decorative effects on the opening:
 *   - butterflies → envelope openings (four-flap / two-flap-*)
 *   - petals      → church doors + sheer veil
 *
 * The wax seal is NOT an effect — it's the structural open-gate, always on for
 * envelopes (owner-locked 2026-06-18).
 */

export type RevealEffects = {
  butterflies: boolean;
  petals: boolean;
};

/** NULL/legacy → petals on (the spec's default door/veil look), butterflies off. */
export const DEFAULT_REVEAL_EFFECTS: RevealEffects = {
  butterflies: false,
  petals: true,
};

export function resolveRevealEffects(raw: unknown): RevealEffects {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return {
      butterflies:
        typeof o.butterflies === 'boolean' ? o.butterflies : DEFAULT_REVEAL_EFFECTS.butterflies,
      petals: typeof o.petals === 'boolean' ? o.petals : DEFAULT_REVEAL_EFFECTS.petals,
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
