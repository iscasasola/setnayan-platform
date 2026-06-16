/**
 * Named saved builds — the PURE helpers for the free-form Save-As → Compare flow
 * (Build_3State_Solver_2026-06-16.md). The fixed A/B/C 3-slot cap is replaced by
 * N free-form NAMED builds: a build is identified by its `build_id` + a free-form
 * `title`, with `label` no longer required (migration 20261231010000 relaxes it).
 *
 * These functions hold no DB / React — they're the unit-tested core
 * (`named-builds.test.ts`) for title normalization, the display name a column
 * shows, sort order, and the create-new-vs-overwrite decision the Save-As
 * control makes.
 */

/** Max stored title length — trims runaway input; matches a comfy column header. */
export const MAX_BUILD_TITLE_LEN = 60;

/**
 * A saved-build row as the Compare surface needs it (label is now nullable; a
 * named build has `label === null` and is identified by build_id + title).
 */
export type NamedBuildRow = {
  build_id: string;
  label: string | null;
  title: string | null;
  created_at?: string | null;
};

/**
 * Normalize a couple-typed build name into a stored `title`:
 *   • trims + collapses internal whitespace,
 *   • caps length at MAX_BUILD_TITLE_LEN (grapheme-naive char slice — fine for a
 *     short label; never throws),
 *   • returns `null` for an empty/whitespace-only name so the caller can fall
 *     back to an auto title ("Build N") rather than store a blank.
 * Pure + total: any input (including non-strings, defensively) yields a string
 * or null, never throws.
 */
export function normalizeBuildTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, MAX_BUILD_TITLE_LEN);
}

/**
 * The auto title for a build that has no stored title. Legacy A/B/C rows show
 * "Plan A/B/C" (unchanged); a NAMED row with no title shows "Build {n}" using
 * its 1-based position so an untitled save is never a blank column header.
 */
export function autoBuildTitle(row: NamedBuildRow, indexZeroBased: number): string {
  if (row.label) return `Plan ${row.label}`;
  return `Build ${indexZeroBased + 1}`;
}

/**
 * The display title a Compare column shows: the stored title if present, else
 * the auto title. Pure; `indexZeroBased` is the row's position in the sorted
 * list (used only for the untitled fallback).
 */
export function displayBuildTitle(row: NamedBuildRow, indexZeroBased: number): string {
  const t = normalizeBuildTitle(row.title);
  return t ?? autoBuildTitle(row, indexZeroBased);
}

/**
 * Stable Compare-column order for saved builds:
 *   • Legacy A/B/C rows first, alphabetically by label (A, then B, then C) — so
 *     a mixed event (old A/B/C + new named) keeps the historical slots leading.
 *   • Then named rows (label === null) oldest-first by `created_at`, build_id as
 *     a deterministic tie-break (covers missing/equal timestamps).
 * Does NOT mutate the input. Total + deterministic for stable tests.
 */
export function sortSavedBuilds<T extends NamedBuildRow>(rows: ReadonlyArray<T>): T[] {
  return [...rows].sort((a, b) => {
    const aLabel = a.label ?? null;
    const bLabel = b.label ?? null;
    // Labeled rows lead unlabeled.
    if (aLabel && !bLabel) return -1;
    if (!aLabel && bLabel) return 1;
    if (aLabel && bLabel) {
      if (aLabel !== bLabel) return aLabel < bLabel ? -1 : 1;
      return a.build_id < b.build_id ? -1 : a.build_id > b.build_id ? 1 : 0;
    }
    // Both named: oldest-first by created_at, build_id tie-break.
    const at = a.created_at ?? '';
    const bt = b.created_at ?? '';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.build_id < b.build_id ? -1 : a.build_id > b.build_id ? 1 : 0;
  });
}

/**
 * Decide what a Save-As submission should do, given the typed name + the chosen
 * overwrite target (a `build_id` or null) + the existing rows. Pure — the action
 * layer turns this into the actual insert/update + RLS-guarded write.
 *
 *   • overwriteBuildId set & found → `{ mode: 'overwrite', buildId, title }`.
 *   • overwriteBuildId set but not found (stale UI) → fail-soft to create-new so
 *     a save is never silently dropped.
 *   • otherwise → `{ mode: 'create', title }` (a brand-new named build).
 *
 * `title` is the normalized name (may be null → caller uses the auto title).
 */
export type SaveAsPlan =
  | { mode: 'create'; title: string | null }
  | { mode: 'overwrite'; buildId: string; title: string | null };

export function planSaveAs(args: {
  rawName: unknown;
  overwriteBuildId: string | null;
  existing: ReadonlyArray<NamedBuildRow>;
}): SaveAsPlan {
  const title = normalizeBuildTitle(args.rawName);
  const target = args.overwriteBuildId
    ? args.existing.find((r) => r.build_id === args.overwriteBuildId)
    : undefined;
  if (target) return { mode: 'overwrite', buildId: target.build_id, title };
  return { mode: 'create', title };
}
