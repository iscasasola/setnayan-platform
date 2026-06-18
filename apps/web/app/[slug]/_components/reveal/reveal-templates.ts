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
};

/**
 * Ordered library for the dashboard chooser. `blurb` is a one-line plain-English
 * description of HOW the opening moves — the previews are intentionally small +
 * un-recordable (owner-locked 2026-06-18), so the blurb is what lets a couple
 * tell the five openings apart. `motion` is a 2-3 word gesture summary used as a
 * chip on each picker tile.
 */
export const REVEAL_LIBRARY: ReadonlyArray<{
  id: RevealTemplate;
  label: string;
  family: 'rigid' | 'veil';
  blurb: string;
  motion: string;
}> = [
  {
    id: 'four-flap',
    label: 'Four-flap envelope',
    family: 'rigid',
    blurb: 'A classic envelope — all four flaps unfold outward from the centre to reveal your film.',
    motion: 'Flaps unfold',
  },
  {
    id: 'two-flap-vertical',
    label: 'Two-flap · side open',
    family: 'rigid',
    blurb: 'Two panels part to the left and right, like opening a card from the side.',
    motion: 'Opens sideways',
  },
  {
    id: 'two-flap-horizontal',
    label: 'Two-flap · top open',
    family: 'rigid',
    blurb: 'Two panels swing up and down, opening from the middle like a top-fold note.',
    motion: 'Opens up & down',
  },
  {
    id: 'church-doors',
    label: 'Church doors',
    family: 'rigid',
    blurb: 'Two tall doors swing open from the centre — a grand, ceremonial entrance.',
    motion: 'Doors swing open',
  },
  {
    id: 'veil-sheer',
    label: 'Sheer bridal veil',
    family: 'veil',
    blurb: 'A soft, sheer veil lifts and floats away, uncovering your film beneath.',
    motion: 'Veil lifts away',
  },
];
