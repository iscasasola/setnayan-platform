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
}: {
  eventId: string;
  anchors: AnchorData;
  categoryFill: CategoryFillData;
}) {
  return (
    <div className="space-y-4">
      {/* Date / Budget / Location anchors — Pin what's fixed, Flag what Setnayan
          should suggest (PR D). */}
      <BuildAnchors eventId={eventId} data={anchors} />

      {/* Per-category Flag + Compute — flag the categories to fill, then auto-fill
          the flagged ones with the best match (writes to the Shortlist). The same
          control the Summary cover uses; reused here as the Build tab's compose
          surface (PR E). */}
      <CategoryFlags
        eventId={eventId}
        openCats={categoryFill.openCats}
        lockedCount={categoryFill.lockedCount}
        flaggedGroups={categoryFill.flaggedGroups}
        aiOn={categoryFill.aiOn}
      />
    </div>
  );
}
