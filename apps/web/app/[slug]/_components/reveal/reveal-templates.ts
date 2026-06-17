/**
 * The Save-the-Date reveal library — the shared registry of opening templates.
 *
 * 5 templates (owner-locked 2026-06-17): 4 rigid (envelopes + church doors) + 1
 * veil (the sheer bridal veil). The Crown veil was removed 2026-06-17. Kept as a
 * tiny pure types/consts module (no React, no three.js) so both the live overlay
 * and the dashboard preview chooser can share it with zero bundle cost.
 */

export type RevealTemplate =
  | 'four-flap'
  | 'two-flap-vertical'
  | 'two-flap-horizontal'
  | 'church-doors'
  | 'veil-sheer';

/** Veil templates lift/fold themselves clear (drag-driven); rigid ones swing open on tap. */
export function isVeilTemplate(t: RevealTemplate): boolean {
  return t === 'veil-sheer';
}

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
];
