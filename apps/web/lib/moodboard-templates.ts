import type { PaletteKey, RolePalette } from './mood-board';
import { optionIds, type AttributeValue, type PartId, type ReceptionDesign } from './reception-scene';

/**
 * Theme TEMPLATE gallery — "pick a look, seed your board" (Mood Board
 * redesign follow-up, 2026-09-03). A template is admin-authored reference
 * content (public.moodboard_theme_templates); this module holds the PURE
 * "apply" logic so it's independently testable without a database: given the
 * couple's CURRENT board state + a template, compute what would be filled in
 * and the merged result.
 *
 * The one rule that matters everywhere in this file: FILL EMPTY SLOTS ONLY.
 * Applying a template must never overwrite anything the couple already set —
 * only palette roles / reception zones / theme fields that are currently
 * unset. A couple who's already fully customized their board gets a no-op
 * (every `filled*` array comes back empty), never a silent overwrite.
 */

/**
 * TAXONOMY v2 (owner directive, 2026-09-03): widened 5→10 style families for
 * the 2,500-theme procedural generator (apps/web/lib/moodboard-theme-generator.ts).
 * The original 5 are kept verbatim and FIRST in the list — existing rows and
 * any code that assumed only these 5 stays correct; the 5 new ones are purely
 * additive. Backed by moodboard_theme_templates_style_family_check_v2
 * (migration 20271195711446).
 */
export const MOODBOARD_STYLE_FAMILIES = [
  // original 5
  'elegant · simple · classic',
  'bridgerton · regal',
  'editorial cream',
  'tropical heritage',
  'modern minimalist',
  // new 5 (2026-09-03 taxonomy expansion)
  'boho beach',
  'vintage ilustrado',
  'industrial loft',
  'moody garden',
  'destination resort',
] as const;

export type MoodboardStyleFamily = (typeof MOODBOARD_STYLE_FAMILIES)[number];

/**
 * The mood-CHARACTER axis — independent of style_family (owner directive,
 * 2026-09-03). A 'bridgerton · regal' template can be either `dark_moody` or
 * `whimsical_storybook` depending on its actual palette; the two axes filter
 * the gallery independently rather than one implying the other.
 *
 * TAXONOMY v2 (owner directive, 2026-09-03): widened 6→10 moods, same
 * additive rule as style_family above. Backed by
 * moodboard_theme_templates_mood_tag_check_v2 (migration 20271195711446).
 */
export const MOODBOARD_MOOD_TAGS = [
  // original 6
  'whimsical_storybook',
  'minimalist',
  'dark_moody',
  'bold_contrasting',
  'simple_understated',
  'maximalist_complex',
  // new 4 (2026-09-03 taxonomy expansion)
  'romantic_ethereal',
  'nostalgic_vintage',
  'glam_luxurious',
  'organic_natural',
] as const;

export type MoodboardMoodTag = (typeof MOODBOARD_MOOD_TAGS)[number];

/**
 * Warm, plain-language, feeling-first labels for the gallery's filter chips —
 * the internal taxonomy keys above are NOT user-facing strings. Wired into
 * template-gallery.tsx (replacing what used to be a local, 5/6-entry-only
 * copy of these same maps).
 */
export const STYLE_FAMILY_LABELS: Record<MoodboardStyleFamily, string> = {
  'elegant · simple · classic': 'Elegant & Timeless',
  'bridgerton · regal': 'Regal & Romantic',
  'editorial cream': 'Editorial & Understated',
  'tropical heritage': 'Tropical Filipiniana',
  'modern minimalist': 'Sleek & Modern',
  'boho beach': 'Barefoot Boho Beach',
  'vintage ilustrado': 'Vintage Ilustrado',
  'industrial loft': 'Urban & Industrial',
  'moody garden': 'Moody Garden Romance',
  'destination resort': 'Sun-Soaked Destination',
};

export const MOOD_LABELS: Record<MoodboardMoodTag, string> = {
  whimsical_storybook: 'Whimsical & Storybook',
  minimalist: 'Clean & Minimal',
  dark_moody: 'Dramatic & Romantic',
  bold_contrasting: 'Bold & Graphic',
  simple_understated: 'Quiet & Timeless',
  maximalist_complex: 'Rich & Layered',
  romantic_ethereal: 'Soft & Ethereal',
  nostalgic_vintage: 'Nostalgic & Vintage',
  glam_luxurious: 'Glamorous & Opulent',
  organic_natural: 'Earthy & Grounded',
};

export type MoodboardThemeTemplate = {
  template_id: string;
  style_family: MoodboardStyleFamily;
  mood_tag: MoodboardMoodTag;
  name: string;
  description: string;
  role_palette: RolePalette;
  reception_design: ReceptionDesign;
  sort_order: number;
};

// ── gallery paging + input validation ───────────────────────────────────
//
// 🛑 THE TABLE IS 2,600 ROWS AND MUST NEVER BE READ WHOLE (2026-09-03).
// The first cut of the gallery selected `moodboard_theme_templates` with NO
// filter and NO limit, shipped the entire table (two JSONB blobs per row)
// into every couple's RSC payload on every mood-board load, and filtered it
// client-side in a `useMemo`. The fix is a filtered, paged server action —
// `fetchThemeTemplates` in the mood-board actions file — and these two pure
// helpers are the part that has to be right: the CAP and the WHITELIST.

/** One screenful of themes — what the gallery asks for per page. */
export const THEME_TEMPLATE_PAGE_SIZE = 6;

/** Hard server-side ceiling on a single fetch, regardless of what the client
 *  asks for. A client cannot page its way back to "the whole table in one
 *  request": 24 rows is four screenfuls, well above any legitimate ask. */
export const THEME_TEMPLATE_MAX_LIMIT = 24;

/** Ceiling on `offset`, so a hostile/buggy caller can't push PostgREST into
 *  scanning far past the end of any real (family, mood) bucket. The largest
 *  bucket is ~26 rows today (2,600 across 10×10); 1,000 is generous headroom
 *  and still bounded. */
export const THEME_TEMPLATE_MAX_OFFSET = 1000;

export type ThemeTemplateQuery = {
  styleFamily: MoodboardStyleFamily;
  moodTag: MoodboardMoodTag;
  limit: number;
  offset: number;
};

export function isMoodboardStyleFamily(value: unknown): value is MoodboardStyleFamily {
  return (
    typeof value === 'string' && (MOODBOARD_STYLE_FAMILIES as readonly string[]).includes(value)
  );
}

export function isMoodboardMoodTag(value: unknown): value is MoodboardMoodTag {
  return typeof value === 'string' && (MOODBOARD_MOOD_TAGS as readonly string[]).includes(value);
}

/**
 * Validate + clamp a gallery fetch request. Returns `null` when the taxonomy
 * values are not EXACTLY one of the shipped vocabulary strings — the action
 * then refuses rather than interpolating a caller-supplied string into a
 * query. `limit`/`offset` are clamped, never rejected, so an out-of-range
 * number degrades to a sane page instead of erroring at the couple.
 */
export function normalizeThemeTemplateQuery(input: {
  styleFamily?: unknown;
  moodTag?: unknown;
  limit?: unknown;
  offset?: unknown;
}): ThemeTemplateQuery | null {
  if (!isMoodboardStyleFamily(input.styleFamily)) return null;
  if (!isMoodboardMoodTag(input.moodTag)) return null;

  const rawLimit = Number(input.limit ?? THEME_TEMPLATE_PAGE_SIZE);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(THEME_TEMPLATE_MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
    : THEME_TEMPLATE_PAGE_SIZE;

  const rawOffset = Number(input.offset ?? 0);
  const offset = Number.isFinite(rawOffset)
    ? Math.min(THEME_TEMPLATE_MAX_OFFSET, Math.max(0, Math.floor(rawOffset)))
    : 0;

  return { styleFamily: input.styleFamily, moodTag: input.moodTag, limit, offset };
}

export type ThemeTemplatePage = {
  templates: MoodboardThemeTemplate[];
  /** Total rows matching this (family, mood) — drives "show more". */
  total: number;
  offset: number;
  limit: number;
};

// ── palette fill ─────────────────────────────────────────────────────────

/**
 * Fill only the palette keys the couple hasn't set yet (no colors saved, or
 * an empty array — `sanitizeRolePalette` never persists an empty array, but
 * a defensive check costs nothing). `room_dressing` is deliberately left
 * alone — a template never touches the couple's advanced room-dressing
 * overrides, only the named palette keys it ships values for.
 */
export function mergeRolePalette(
  current: RolePalette,
  template: RolePalette,
): { merged: RolePalette; filledKeys: PaletteKey[] } {
  const merged: RolePalette = { ...current };
  const filledKeys: PaletteKey[] = [];
  for (const [key, colors] of Object.entries(template) as [PaletteKey, string[] | undefined][]) {
    if (key === ('room_dressing' as unknown as PaletteKey)) continue;
    if (!colors || colors.length === 0) continue;
    const existing = current[key];
    if (!existing || existing.length === 0) {
      merged[key] = colors;
      filledKeys.push(key);
    }
  }
  return { merged, filledKeys };
}

// ── reception design fill ────────────────────────────────────────────────

/**
 * Fill only the (part, attribute) "zones" the couple hasn't chosen a
 * treatment for yet. A zone is filled independently — if the couple already
 * set `backdrop.style` but never touched `backdrop.florals`, the template
 * fills florals while leaving their chosen style untouched. `filledZones`
 * entries are `"part.attribute"` strings for the UI summary.
 */
export function mergeReceptionDesign(
  current: ReceptionDesign,
  template: ReceptionDesign,
): { merged: ReceptionDesign; filledZones: string[] } {
  const merged: ReceptionDesign = {};
  const filledZones: string[] = [];
  const partIds = new Set<string>([...Object.keys(current), ...Object.keys(template)]);
  for (const partId of partIds) {
    const currentAttrs = current[partId as PartId] ?? {};
    const templateAttrs = template[partId as PartId] ?? {};
    // `AttributeValue`, not `string`: an attribute may hold one id or several
    // (multi-select, 2026-09-03). "Has the couple set this zone?" is
    // `optionIds(...).length > 0` — an empty array is truthy, so a bare truthy
    // check would read "already chosen" for a zone holding nothing.
    const mergedAttrs: Record<string, AttributeValue> = { ...currentAttrs };
    for (const [attrId, optionId] of Object.entries(templateAttrs)) {
      if (optionIds(optionId).length === 0) continue;
      if (optionIds(currentAttrs[attrId]).length === 0) {
        mergedAttrs[attrId] = optionId;
        filledZones.push(`${partId}.${attrId}`);
      }
    }
    if (Object.keys(mergedAttrs).length > 0) merged[partId as PartId] = mergedAttrs;
  }
  return { merged, filledZones };
}

// ── full-overwrite ("Replace everything") variants ──────────────────────

/**
 * Apply mode (owner directive, 2026-09-03 follow-up): `fill_empty` is the
 * existing, always-safe default (merge* functions above — never overwrites
 * anything). `replace_all` is the new destructive mode — it REPLACES the
 * couple's current values with the template's, for the specific fields the
 * template governs, always confirmed client-side before the action runs
 * (see template-gallery.tsx).
 */
export type ApplyMode = 'fill_empty' | 'replace_all';

/**
 * Overwrite every palette key the TEMPLATE defines, unconditionally — unlike
 * `mergeRolePalette`, it doesn't check whether the couple already set that
 * key. `room_dressing` and `custom_roles` are still never touched: templates
 * never author either field (only the couple does), so there is nothing of
 * the template's to replace them WITH — leaving them alone here isn't a
 * safety compromise, it's the only sensible behavior for a field the
 * template has no opinion on.
 */
export function replaceRolePalette(
  current: RolePalette,
  template: RolePalette,
): { merged: RolePalette; changedKeys: PaletteKey[] } {
  const merged: RolePalette = { ...current };
  const changedKeys: PaletteKey[] = [];
  for (const [key, colors] of Object.entries(template) as [PaletteKey, string[] | undefined][]) {
    if (key === ('room_dressing' as unknown as PaletteKey)) continue;
    if (key === ('custom_roles' as unknown as PaletteKey)) continue;
    if (!colors || colors.length === 0) continue;
    merged[key] = colors;
    changedKeys.push(key);
  }
  return { merged, changedKeys };
}

/**
 * Overwrite every (part, attribute) zone the TEMPLATE defines, unconditionally.
 * A zone the template DOESN'T mention (e.g. an older template authored before
 * the Walls/Photo Wall/Welcome & Signage parts existed) is left exactly as the
 * couple had it — "replace everything" replaces everything the template has
 * an opinion about, not fields it's silent on, so applying an older template
 * can never blank out a newer zone it simply predates.
 */
export function replaceReceptionDesign(
  current: ReceptionDesign,
  template: ReceptionDesign,
): { merged: ReceptionDesign; changedZones: string[] } {
  const merged: ReceptionDesign = { ...current };
  const changedZones: string[] = [];
  for (const [partId, templateAttrs] of Object.entries(template)) {
    const currentAttrs = current[partId as PartId] ?? {};
    const mergedAttrs: Record<string, AttributeValue> = { ...currentAttrs };
    for (const [attrId, optionId] of Object.entries(templateAttrs ?? {})) {
      if (optionIds(optionId).length === 0) continue;
      mergedAttrs[attrId] = optionId;
      changedZones.push(`${partId}.${attrId}`);
    }
    if (Object.keys(mergedAttrs).length > 0) merged[partId as PartId] = mergedAttrs;
  }
  return { merged, changedZones };
}

// ── style-family provenance ─────────────────────────────────────────────

/**
 * WHICH style family produced this board — the fact nothing used to record
 * (2026-09-03). The AI decor-layer pilot (@/lib/reception-decor-layers) can
 * only choose a decor image when it knows the event's style family, and
 * `resolveDecorLayer` refuses to guess: a null family always falls back to
 * the flat SVG. Before this, `applyMoodboardTemplate` merged a template's
 * palette + reception_design into the event and threw away the one field
 * that says where they came from, so EVERY event resolved null and the pilot
 * was dormant for everyone.
 *
 * `events.moodboard_style_family` is now that record. This function decides
 * what to write, honoring each apply mode's own semantics:
 *
 *   • `fill_empty`  — write ONLY when the event has none yet. A couple who
 *     already established a family (an earlier template, a future explicit
 *     picker) keeps it, exactly like their palette colors survive a fill.
 *   • `replace_all` — always write. "Replace everything" includes the
 *     provenance of everything.
 *
 * Returns `null` for "leave the stored value alone" — never an empty string,
 * so a caller can't confuse "no change" with "clear it".
 */
export function nextMoodboardStyleFamily(
  mode: ApplyMode,
  currentStyleFamily: string | null | undefined,
  templateStyleFamily: MoodboardStyleFamily,
): MoodboardStyleFamily | null {
  if (mode === 'replace_all') return templateStyleFamily;
  const current = typeof currentStyleFamily === 'string' ? currentStyleFamily.trim() : '';
  return current.length === 0 ? templateStyleFamily : null;
}

/** Theme name/description are always overwritten in replace_all mode — there's
 *  no "zone" granularity to preserve, unlike palette keys/reception zones. */
export function replaceTheme(
  templateName: string,
  templateDescription: string,
): { name: string; description: string } {
  return { name: templateName, description: templateDescription };
}

// ── theme name/description fill ─────────────────────────────────────────

export function mergeTheme(
  currentName: string | null,
  currentDescription: string | null,
  templateName: string,
  templateDescription: string,
): { name: string | null; description: string | null; filledName: boolean; filledDescription: boolean } {
  const filledName = !currentName || currentName.trim().length === 0;
  const filledDescription = !currentDescription || currentDescription.trim().length === 0;
  return {
    name: filledName ? templateName : currentName,
    description: filledDescription ? templateDescription : currentDescription,
    filledName,
    filledDescription,
  };
}

// ── inspiration slot → style-tagged asset lookup ────────────────────────

/**
 * Which inspiration slots (event_inspiration_assets.slot_key) can be filled
 * from a style-tagged library asset, and which moodboard_library_assets
 * (asset_type, asset_subtype) to look up for each. ONLY figure_attire assets
 * carry a style_theme (venue_scene/florals rows don't — see
 * 20260613000000's own comment), so only the attire-adjacent slots have a
 * style-driven starter image; the rest (venue/backdrop/ceiling/stage/table/
 * flowers/tunnel/cocktail/overall/palette/parents) are left for the couple to
 * upload their own reference, same as today.
 */
export const TEMPLATE_INSPIRATION_SLOT_ASSETS: Readonly<
  Record<string, { asset_type: 'figure_attire'; asset_subtype: string }>
> = {
  bride: { asset_type: 'figure_attire', asset_subtype: 'bride' },
  groom: { asset_type: 'figure_attire', asset_subtype: 'groom' },
  entourage: { asset_type: 'figure_attire', asset_subtype: 'bridesmaids' },
  principal_sponsor: { asset_type: 'figure_attire', asset_subtype: 'female_ps' },
  guests: { asset_type: 'figure_attire', asset_subtype: 'guests' },
};

/**
 * Given the set of inspiration slot_keys that already have AT LEAST ONE
 * active image (either position), return the slots from
 * TEMPLATE_INSPIRATION_SLOT_ASSETS that are still completely empty — the
 * candidates the caller should look up a style-tagged asset for. Pure: the
 * actual DB lookup + insert happens in the server action.
 */
export function emptyTemplateInspirationSlots(occupiedSlotKeys: ReadonlySet<string>): string[] {
  return Object.keys(TEMPLATE_INSPIRATION_SLOT_ASSETS).filter((k) => !occupiedSlotKeys.has(k));
}

export type ApplyTemplateSummary = {
  mode: ApplyMode;
  filledPaletteRoles: PaletteKey[];
  filledReceptionZones: string[];
  filledInspirationSlots: string[];
  filledThemeName: boolean;
  filledThemeDescription: boolean;
};

export function summaryIsEmpty(summary: ApplyTemplateSummary): boolean {
  return (
    summary.filledPaletteRoles.length === 0 &&
    summary.filledReceptionZones.length === 0 &&
    summary.filledInspirationSlots.length === 0 &&
    !summary.filledThemeName &&
    !summary.filledThemeDescription
  );
}
