/**
 * lib/reveal-extras.ts — ✨ THE REVEAL PART'S EXTRAS ▾ (the new Maker, plan PR 3;
 * owner 2026-10-06: "Extras ▾ None · Butterflies · Falling petals").
 *
 * The SAME switch the Reveal's fine-tune draws (`maker-reveal.tsx`
 * `FineTune`, `events.std_reveal_effects`), as ONE dropdown — offering only what
 * the chosen opening's engine draws: the veil lets petals fall. The nine reveals of
 * 23 Nov 2026 are drawn whole (the Petals reveal IS petals), so no other reveal has an
 * extra; the retired envelopes' butterflies went with them. Nothing new is stored. Its own module so
 * none of it rides the Maker's first load (`lib/std-reveal-effects.ts` does).
 */
import type { RevealEffects } from './std-reveal-effects';

export type RevealExtra = 'none' | 'butterflies' | 'petals';
export const REVEAL_EXTRA_LABEL: Record<RevealExtra, string> = { none: 'None', butterflies: 'Butterflies', petals: 'Falling petals' };
/** The extras an opening's engine draws, "None" first — the veil's petals; nothing for any other reveal. */
export function revealExtrasFor(opening: string): RevealExtra[] {
  return opening === 'veil-sheer' ? ['none', 'petals'] : ['none'];
}

/** What Extras ▾ shows for these effects on this opening. */
export function revealExtraOf(effects: RevealEffects, opening: string): RevealExtra {
  return opening === 'veil-sheer' && effects.petals ? 'petals' : 'none';
}

/** The effects with one extra picked — only that opening's own switch moves. */
export function revealEffectsWithExtra(effects: RevealEffects, opening: string, extra: RevealExtra): RevealEffects {
  if (opening !== 'veil-sheer') return effects;
  return { ...effects, petals: extra === 'petals' };
}
