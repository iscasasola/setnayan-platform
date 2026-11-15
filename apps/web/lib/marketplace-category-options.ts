/**
 * marketplace-category-options.ts — the category list the supplier marketplace offers: key → label → folder.
 *
 * ─── MOVED HERE 2026-11-12, UNCHANGED, FROM `app/(shell)/explore/page.tsx` ─────────────────────────────────
 * `/explore`'s category search has always offered `TAXONOMY_OPTIONS` (built once at module load from the code's own
 * taxonomy). Discover's "All categories ▾" (DECISION_LOG 2026-11-12 "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED")
 * offers the SAME list — so it lives here, where a CLIENT component can import it lazily, instead of inside the
 * server-only marketplace view. One list, two doors: they cannot disagree about what a category is called.
 *
 * Pure: no I/O, no React. Nothing here is read from the database, so opening the list costs no request.
 */
import { TAXONOMY_MAP, WEDDING_FOLDER_ORDER, WEDDING_FOLDER_SHORT_LABEL, type WeddingFolder } from '@/lib/taxonomy';
import { FOLDER_SERVICE_COUNT } from '@/lib/taxonomy-folder-counts';

/** The shape `/explore`'s category search (`taxonomy-search.tsx`'s `TaxonomyOption`) renders. */
export type MarketplaceCategoryOption = {
  key: string;
  label: string;
  column: string;
  columnCount?: number;
};

// Derive a human-readable label from a snake_case canonical_service key.
// Pre-baked overrides for cases that don't title-case cleanly (acronyms,
// hyphenated terms, Setnayan-branded SKUs).
const TAXONOMY_LABEL_OVERRIDE: Record<string, string> = {
  pre_nup_photographer: 'Pre-Nup Photographer',
  pre_nup_shoot_locations: 'Pre-Nup Shoot Locations',
  setnayan_papic: 'Setnayan · Papic',
  setnayan_ai_edited_highlight: 'Setnayan · AI Highlight',
};

export function taxonomyLabel(key: string): string {
  if (TAXONOMY_LABEL_OVERRIDE[key]) return TAXONOMY_LABEL_OVERRIDE[key];
  return key
    .split('_')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// Build the full 192-item autocomplete list once at module load.
export const TAXONOMY_OPTIONS: ReadonlyArray<MarketplaceCategoryOption> = Object.entries(
  TAXONOMY_MAP,
)
  .map(([key, meta]) => ({
    key,
    label: taxonomyLabel(key),
    column: WEDDING_FOLDER_SHORT_LABEL[meta.folder],
    columnCount: FOLDER_SERVICE_COUNT[meta.folder] ?? 0,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Discover's "All categories ▾" (2026-11-12): the same options, grouped under their folders in the folders' own
 * order — "folders, then categories" (the drawing's Map card). A category the marketplace never lists
 * (`marketplaceHidden`) or Setnayan's own services (`setnayan_*`, which the marketplace filters out of every grid —
 * owner 2026-07-26 "remove setnayan from Explore") is not offered: picking it could only ever show an empty view.
 */
export function marketplaceCategoryFolders(): Array<{
  folder: WeddingFolder;
  label: string;
  options: MarketplaceCategoryOption[];
}> {
  return WEDDING_FOLDER_ORDER.map((folder) => ({
    folder,
    label: WEDDING_FOLDER_SHORT_LABEL[folder],
    options: TAXONOMY_OPTIONS.filter((o) => {
      const meta = TAXONOMY_MAP[o.key];
      return meta?.folder === folder && !meta.marketplaceHidden && !o.key.startsWith('setnayan_');
    }),
  })).filter((g) => g.options.length > 0);
}
