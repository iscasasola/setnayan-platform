/**
 * lib/reveal-extras.ts — ✨ THE REVEAL PART'S EXTRAS ▾ (the new Maker, plan PR 3;
 * owner 2026-10-06: "Extras ▾ None · Butterflies · Falling petals").
 *
 * The SAME two switches the Reveal's fine-tune draws (`maker-reveal.tsx`
 * `FineTune`, `events.std_reveal_effects`), as ONE dropdown — offering only what
 * the chosen opening's engine draws: an envelope lets butterflies out, the
 * doors and the veil let petals fall. Nothing new is stored. Its own module so
 * none of it rides the Maker's first load (`lib/std-reveal-effects.ts` does).
 */
import type { RevealEffects } from './std-reveal-effects';

export type RevealExtra = 'none' | 'butterflies' | 'petals';
export const REVEAL_EXTRA_LABEL: Record<RevealExtra, string> = { none: 'None', butterflies: 'Butterflies', petals: 'Falling petals' };
/** The envelope openings (`std-reveal-effects.ts` reads the same three for its butterflies). */
const ENVELOPES = new Set(['four-flap', 'two-flap-vertical', 'two-flap-horizontal']);

/** The extras an opening's engine draws, "None" first. */
export function revealExtrasFor(opening: string): RevealExtra[] {
  return ENVELOPES.has(opening) ? ['none', 'butterflies'] : ['none', 'petals'];
}

/** What Extras ▾ shows for these effects on this opening. */
export function revealExtraOf(effects: RevealEffects, opening: string): RevealExtra {
  if (ENVELOPES.has(opening)) return effects.butterflies ? 'butterflies' : 'none';
  return effects.petals ? 'petals' : 'none';
}

/** The effects with one extra picked — only that opening's own switch moves. */
export function revealEffectsWithExtra(effects: RevealEffects, opening: string, extra: RevealExtra): RevealEffects {
  if (ENVELOPES.has(opening)) return { ...effects, butterflies: extra === 'butterflies' };
  return { ...effects, petals: extra === 'petals' };
}
