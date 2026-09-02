import type { RolePalette } from './mood-board';
import { RECEPTION_PARTS, type ReceptionDesign } from './reception-scene';

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

type NamedColor = { name: string; hex: string };

// A curated wedding-relevant color-name table (not exhaustive — general
// aesthetic families a couple would recognize). Nearest match by Euclidean
// distance in RGB space, which is crude but stable and fast, and good enough
// for a "starter suggestion, editable by the couple" affordance.
const NAMED_COLORS: NamedColor[] = [
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'Cream', hex: '#FAF7F2' },
  { name: 'Blush', hex: '#F4C2C2' },
  { name: 'Dusty Rose', hex: '#C9A0A0' },
  { name: 'Rose', hex: '#BE185D' },
  { name: 'Burgundy', hex: '#7A1F2B' },
  { name: 'Terracotta', hex: '#C97B4B' },
  { name: 'Rust', hex: '#824A2A' },
  { name: 'Champagne Gold', hex: '#C5A059' },
  { name: 'Gold', hex: '#D4AF37' },
  { name: 'Mustard', hex: '#D97706' },
  { name: 'Sage', hex: '#8A9A6B' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Forest Green', hex: '#3A5746' },
  { name: 'Sky Blue', hex: '#7DB8D9' },
  { name: 'Navy', hex: '#1E2540' },
  { name: 'Slate', hex: '#3A5766' },
  { name: 'Lavender', hex: '#C9B8D9' },
  { name: 'Plum', hex: '#5C2542' },
  { name: 'Charcoal', hex: '#1E2229' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Silver', hex: '#CFD3D6' },
  { name: 'Peach', hex: '#F0B27A' },
  { name: 'Coral', hex: '#E8735A' },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const hex6 = m?.[1];
  if (!hex6) return null;
  const n = parseInt(hex6, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Nearest named color for a hex, by RGB Euclidean distance. Pure. */
export function nearestColorName(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let best: { name: string; d: number } | null = null;
  for (const nc of NAMED_COLORS) {
    const ncRgb = hexToRgb(nc.hex);
    if (!ncRgb) continue;
    const d =
      (rgb[0] - ncRgb[0]) ** 2 + (rgb[1] - ncRgb[1]) ** 2 + (rgb[2] - ncRgb[2]) ** 2;
    if (!best || d < best.d) best = { name: nc.name, d };
  }
  return best?.name ?? null;
}

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

function motifWord(design: ReceptionDesign): string | null {
  const backdropStyle = design.backdrop?.style;
  if (backdropStyle && MOTIF_WORDS[backdropStyle]) return MOTIF_WORDS[backdropStyle];
  const ceilingTreatment = design.ceiling?.treatment;
  if (ceilingTreatment && MOTIF_WORDS[ceilingTreatment]) return MOTIF_WORDS[ceilingTreatment];
  return null;
}

function optionLabel(partId: string, attrId: string, optionId: string | undefined): string | null {
  if (!optionId) return null;
  const part = RECEPTION_PARTS.find((p) => p.id === partId);
  const attr = part?.attributes.find((a) => a.id === attrId);
  const option = attr?.options.find((o) => o.id === optionId);
  return option?.label ?? null;
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
    optionLabel('ceiling', 'treatment', design.ceiling?.treatment),
    optionLabel('backdrop', 'style', design.backdrop?.style),
    optionLabel('tables', 'centerpiece', design.tables?.centerpiece),
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
