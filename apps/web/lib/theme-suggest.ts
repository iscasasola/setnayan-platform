import type { RolePalette } from './mood-board';
import {
  RECEPTION_PARTS,
  optionIds,
  type AttributeValue,
  type ReceptionDesign,
} from './reception-scene';

/**
 * Deterministic "suggest a theme" helper for the Mood Board's Overall Theme
 * card (redesign, 2026-09-02). No AI/LLM call — pure function that derives a
 * starter name + description from what the couple already saved: the
 * dominant palette color(s), named by nearest match, combined with the
 * reception design's chosen backdrop/ceiling treatment. The couple can accept
 * the suggestion or overwrite it; nothing here is persisted on its own.
 *
 * ⚠ JUDGMENT CALL — the exact color-naming table and the motif-word mapping
 * below are a first pass, not a locked spec. Flag for a human to sanity-check
 * the vocabulary (e.g. whether "Modern" is the right word for a moon-gate
 * backdrop) before this ships broadly.
 */

// ---- nearest named color -------------------------------------------------
//
// Moved to lib/color-names.ts (2026-09-02) — now a complete two-layer naming
// library (curated wedding names + the full 140 standard CSS names as a
// fallback so ANY hex resolves to a real name), shared with the palette
// editor and every other place a swatch is shown, not just this suggestion
// helper. Re-exported here so existing callers of `nearestColorName` from
// this module don't need to change their import.
export { nearestColorName } from './color-names';
import { nearestColorName } from './color-names';

// ---- reception-design motif word -----------------------------------------

// A short "feel" word per chosen backdrop/ceiling option — used as the
// theme's trailing descriptor (e.g. "… Garden Reception"). Deliberately
// terse; the couple's own words in the description carry the real detail.
const MOTIF_WORDS: Record<string, string> = {
  // backdrop.style
  floral_wall: 'Garden',
  greenery: 'Garden',
  moon_gate: 'Modern',
  marquee: 'Marquee',
  neon: 'Modern',
  led: 'Modern',
  balloon: 'Playful',
  fringe: 'Boho',
  draped: 'Romantic',
  // ceiling.treatment
  chandeliers: 'Classic',
  fairy_lights: 'Whimsical',
  hanging_florals: 'Garden',
  hanging_greenery: 'Garden',
  lanterns: 'Rustic',
  geometric: 'Modern',
};

/** Reads the RAW stored value (via `optionIds`, not `sel`) on purpose: an
 *  attribute the couple never set must stay unset here, so an untouched design
 *  suggests nothing rather than describing DEFAULT_DESIGN back at them. With
 *  multi-select it walks every selection and takes the first that HAS a motif
 *  word — so a couple who picked "draped + floral wall" gets "Garden", not a
 *  null from the first id alone. */
function motifWord(design: ReceptionDesign): string | null {
  for (const id of optionIds(design.backdrop?.style)) {
    if (MOTIF_WORDS[id]) return MOTIF_WORDS[id]!;
  }
  for (const id of optionIds(design.ceiling?.treatment)) {
    if (MOTIF_WORDS[id]) return MOTIF_WORDS[id]!;
  }
  return null;
}

/** Every chosen option's label for one attribute, joined for prose ("Draped
 *  fabric and Fairy lights"). Empty when the couple never set the attribute. */
function optionLabels(partId: string, attrId: string, value: AttributeValue | undefined): string | null {
  const ids = optionIds(value);
  if (ids.length === 0) return null;
  const part = RECEPTION_PARTS.find((p) => p.id === partId);
  const attr = part?.attributes.find((a) => a.id === attrId);
  const labels = ids
    .map((id) => attr?.options.find((o) => o.id === id)?.label)
    .filter((l): l is string => Boolean(l));
  return labels.length > 0 ? labels.join(' and ') : null;
}

// ---- the suggestion --------------------------------------------------------

export type ThemeSuggestion = { name: string; description: string };

/**
 * Derive a starter theme name + description from the couple's saved palette
 * and reception design. Pure — no DB, no AI call. Returns `null` when there's
 * nothing to suggest from yet (no palette colors at all), so the caller can
 * leave the "Suggest for me" button showing a neutral empty state instead of
 * a suggestion built from nothing.
 */
export function suggestMoodboardTheme(
  palette: RolePalette,
  design: ReceptionDesign,
): ThemeSuggestion | null {
  const source =
    (palette.reception?.length ? palette.reception : null) ??
    (palette.bride?.length ? palette.bride : null) ??
    (palette.wedding_party?.length ? palette.wedding_party : null) ??
    (palette.groom?.length ? palette.groom : null) ??
    null;
  if (!source || source.length === 0) return null;

  const colorNames = Array.from(
    new Set(source.map((hex) => nearestColorName(hex)).filter((n): n is string => Boolean(n))),
  ).slice(0, 2);
  if (colorNames.length === 0) return null;

  const motif = motifWord(design) ?? 'Wedding';
  const colorPhrase = colorNames.join(' & ');
  const name = `${colorPhrase} ${motif} Reception`.slice(0, 80);

  const detailLabels = [
    optionLabels('ceiling', 'treatment', design.ceiling?.treatment),
    optionLabels('backdrop', 'style', design.backdrop?.style),
    optionLabels('tables', 'centerpiece', design.tables?.centerpiece),
  ].filter((l): l is string => Boolean(l));

  const detailPhrase =
    detailLabels.length > 0
      ? ` with ${detailLabels.map((l) => l.toLowerCase()).join(', ')}`
      : '';
  const description =
    `A ${colorNames.map((n) => n.toLowerCase()).join(' and ')} palette${detailPhrase}.`.slice(
      0,
      280,
    );

  return { name, description };
}
