'use client';

/**
 * BuildPins — the Build tab (PR E of the 0016 Plan Builder redesign).
 *
 * Retires the Lean/Fits/Stretch budget-estimate engine (owner: "replace the
 * estimator fully") in favor of the prototype's compose-real-vendors model:
 *   1. The couple's Date / Budget / Location anchors (Flag/Pin) — PR D.
 *   2. Per-category Flag + Compute: flag the categories to fill, then
 *      "Auto-fill with Setnayan AI" sources + writes the best-matched vendor
 *      straight into the Shortlist. Reuses the shipped, AI-gated, validated
 *      flag/compute backend (build-flags-actions → generateFlaggedVendors) via
 *      the existing CategoryFlags control — no new write path.
 *
 * Client component.
 */

import { BuildAnchors, type AnchorData } from './build-anchors';
import { CategoryFlags } from './category-flags';
import { BuildPicksList, type BuildPickItem } from './build-picks-list';
import { BuildCompute } from './build-compute';

export type CategoryFillData = {
  openCats: { groupId: string; label: string }[];
  lockedCount: number;
  flaggedGroups: string[];
  aiOn: boolean;
};

export function BuildPins({
  eventId,
  anchors,
  categoryFill,
  buildItems,
  budgetPhp,
}: {
  eventId: string;
  anchors: AnchorData;
  categoryFill: CategoryFillData;
  /** The items transferred here via Shortlist "Add to build" (event_build_picks). */
  buildItems: BuildPickItem[];
  /** Pinned budget (events.estimated_budget_centavos → PHP) for the totals line. */
  budgetPhp: number | null;
}) {
  return (
    <div className="space-y-4">
      {/* Date / Budget / Location anchors — Pin what's fixed, Flag what Setnayan
          should suggest (PR D). */}
      <BuildAnchors eventId={eventId} data={anchors} />

      {/* "Your build" — the items the couple added from the Shortlist land here
          (owner 2026-06-09: "Add to build transfers the item to the build page").
          Lock them on the Lock tab. */}
      <BuildPicksList eventId={eventId} items={buildItems} budgetPhp={budgetPhp} />

      {/* Per-category Flag — mark the categories Compute should fill. Pinned
          categories (already an "Add to build" pick) stay fixed. */}
      <CategoryFlags
        eventId={eventId}
        openCats={categoryFill.openCats}
        lockedCount={categoryFill.lockedCount}
        flaggedGroups={categoryFill.flaggedGroups}
        aiOn={categoryFill.aiOn}
      />

      {/* COMPUTE — assemble the build from the SHORTLIST within the pinned
          budget (owner 2026-06-09). Fills each flagged category with one fitting
          shortlisted service; categories with no fitting option surface the
          "[Find compatible] / [Remove flag]" prompt (Find compatible = the
          marketplace escape hatch). Distinct from CategoryFlags' Setnayan-AI
          marketplace auto-fill, which sources NEW options into the shortlist. */}
      <BuildCompute eventId={eventId} flaggedCount={categoryFill.flaggedGroups.length} />
    </div>
  );
}
