/**
 * The Save-the-Date reveal library — the shared registry of opening templates.
 *
 * Locked at 7 total (0024 addendum §1a): 4 rigid envelopes + 2 veils + 1 curtain.
 * Six ship here; the curtain (Veil C) lands separately. Kept as a tiny pure
 * types/consts module (no React, no three.js) so both the live overlay and the
 * dashboard preview chooser can share it with zero bundle cost.
 */

export type RevealTemplate =
  | 'four-flap'
  | 'two-flap-vertical'
  | 'two-flap-horizontal'
  | 'church-doors'
  | 'veil-sheer'
  | 'veil-crown';

/** Veil templates lift/fold themselves clear (drag-driven); rigid ones swing open on tap. */
export function isVeilTemplate(t: RevealTemplate): boolean {
  return t === 'veil-sheer' || t === 'veil-crown';
}

/**
 * Rigid swing duration. The CSS transition on the flaps runs for RIGID_FOLD_MS;
 * the overlay (and the studio preview) wait RIGID_REVEAL_MS — a touch longer — to
 * remove the overlay so the swing finishes before the page beneath takes over.
 * NOTE: the Tailwind class on the flaps is the literal `duration-[1100ms]` (JIT
 * needs a static value) — keep it in sync with RIGID_FOLD_MS by hand.
 */
export const RIGID_FOLD_MS = 1100;
export const RIGID_REVEAL_MS = RIGID_FOLD_MS + 100;

/**
 * `?reveal=` query-param aliases → template id. Lets a Vercel preview demo any
 * template without flipping the global flag. Back-compat aliases kept: `veil`
 * (→ sheer) and `envelope` (→ four-flap) shipped in earlier PRs.
 */
export const REVEAL_ALIASES: Record<string, RevealTemplate> = {
  envelope: 'four-flap',
  'four-flap': 'four-flap',
  'two-flap-vertical': 'two-flap-vertical',
  'two-flap-v': 'two-flap-vertical',
  'two-flap-horizontal': 'two-flap-horizontal',
  'two-flap-h': 'two-flap-horizontal',
  'church-doors': 'church-doors',
  doors: 'church-doors',
  veil: 'veil-sheer',
  'veil-sheer': 'veil-sheer',
  'veil-crown': 'veil-crown',
  crown: 'veil-crown',
};

/** Ordered library for the dashboard chooser (label + family for grouping). */
export const REVEAL_LIBRARY: ReadonlyArray<{
  id: RevealTemplate;
  label: string;
  family: 'rigid' | 'veil';
}> = [
  { id: 'four-flap', label: 'Four-flap envelope', family: 'rigid' },
  { id: 'two-flap-vertical', label: 'Two-flap · side open', family: 'rigid' },
  { id: 'two-flap-horizontal', label: 'Two-flap · top open', family: 'rigid' },
  { id: 'church-doors', label: 'Church doors', family: 'rigid' },
  { id: 'veil-sheer', label: 'Sheer bridal veil', family: 'veil' },
  { id: 'veil-crown', label: 'Crown veil', family: 'veil' },
];
