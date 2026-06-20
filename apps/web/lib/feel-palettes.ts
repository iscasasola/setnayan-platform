import { PALETTE_LIMITS, type PaletteKey, type RolePalette } from './mood-board';

/**
 * Onboarding "feel" → a starter colour set. Mirrors the FEELS map in the
 * onboarding wizard (app/onboarding/wedding/_components/onboarding-shell.tsx) —
 * keep the two in sync until they're unified. These are the couple's stated
 * wedding vibe, used to PRE-FILL the mood-board palette editor as an editable
 * draft. They are NEVER written to events.role_palette without an explicit save.
 */
export const FEEL_PALETTES: Record<string, string[]> = {
  timeless: ['#F3ECE0', '#E8D6B8', '#C5A059', '#8A6D3B', '#FFFFFF'],
  modern: ['#FFFFFF', '#1E2229', '#CFD3D6', '#3A5746', '#9AA0A6'],
  boho: ['#C98A5E', '#9C6B4F', '#D9B8A0', '#8A9A6B', '#E6D6C0'],
  rustic: ['#8A9A6B', '#B5A285', '#D9CBB0', '#6B7A8A', '#EFE7D6'],
  glam: ['#7A1F2B', '#C5A059', '#1E2229', '#D9B8BD', '#F3ECE0'],
  royalty: ['#3A5746', '#C5A059', '#5C2542', '#1E2540', '#E8D6B8'],
  filipiniana: ['#E8D6B8', '#C5A059', '#7A1F2B', '#3A5746', '#FFFFFF'],
  // 'others' / "still deciding" has no derived palette — the board stays blank.
};

/**
 * Derive an EDITABLE starting palette from the couple's onboarding feel. Seeds
 * only the two venue-family keys (reception + ceremony) that are visible, each
 * clamped to its slot max — a draft for the couple to tweak and Save. Role and
 * couple palettes stay empty. Returns {} when there's no feel/colours, so the
 * board falls back to fully blank. PURE: no DB access, no persistence.
 */
export function seedPaletteFromFeel(
  feelKey: string | null | undefined,
  visibleKeys: ReadonlyArray<PaletteKey>,
): RolePalette {
  const colors = feelKey ? FEEL_PALETTES[feelKey] : undefined;
  if (!colors || colors.length === 0) return {};
  const visible = new Set(visibleKeys);
  const out: RolePalette = {};
  for (const key of ['reception', 'ceremony'] as const) {
    if (!visible.has(key)) continue;
    out[key] = colors.slice(0, PALETTE_LIMITS[key].max);
  }
  return out;
}
