/**
 * Vendor-category progress — turn the couple's `event_vendors` into per-category
 * lifecycle states for the checklist, so a vendor task reads as a live decision
 * ("Catering: comparing options", "Photographer: confirmed") rather than a flat
 * to-do. Pure (no DB) → unit-testable; the checklist page supplies the rows.
 *
 * Reuses the merged state machine `resolveCategoryState` (lib/checklist-state).
 * Decisions (excluded/deferred overrides) are out of scope here — state derives
 * purely from vendor status, the dominant signal.
 */
import {
  resolveCategoryState,
  CATEGORY_STATE_LABELS,
  type CategoryDecisionState,
} from './checklist-state';

export type VendorCategoryProgress = {
  /** Raw event_vendors.category key. */
  category: string;
  /** Humanized label ("photo_video" → "Photo Video"). */
  label: string;
  state: CategoryDecisionState;
  stateLabel: string;
  vendorCount: number;
};

function humanizeCategory(category: string): string {
  return category
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sort so the categories that need attention lead and the settled ones trail. */
const STATE_ORDER: Record<CategoryDecisionState, number> = {
  needs_more_options: 0,
  searching: 1,
  one_option: 2,
  in_progress: 3,
  deferred: 4,
  done: 5,
  excluded: 6,
  not_started: 7,
};

/**
 * Group event_vendors by category, resolve each group's lifecycle state, and
 * return only the categories the couple has actually engaged (drops
 * `not_started`). Ordered attention-first (searching → … → done).
 */
export function resolveVendorCategoryProgress(
  vendors: ReadonlyArray<{ category: string | null; status: string }>,
): VendorCategoryProgress[] {
  const byCategory = new Map<string, { status: string }[]>();
  for (const v of vendors) {
    const category = (v.category ?? '').trim();
    if (!category) continue;
    const rows = byCategory.get(category) ?? [];
    rows.push({ status: v.status });
    byCategory.set(category, rows);
  }

  const out: VendorCategoryProgress[] = [];
  for (const [category, rows] of byCategory) {
    const state = resolveCategoryState(null, rows);
    if (state === 'not_started') continue;
    out.push({
      category,
      label: humanizeCategory(category),
      state,
      stateLabel: CATEGORY_STATE_LABELS[state],
      vendorCount: rows.length,
    });
  }

  out.sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.label.localeCompare(b.label),
  );
  return out;
}
