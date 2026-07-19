## 2026-07-08 · feat(checklist): "you might also want" leaf-category suggestions

Wires the merged leaf-surfacing re-ranker into the checklist so every service
leaf category gets a fair, relevance-gated chance to reach the couple — the
"help all services have a chance to be an option" goal.

- `lib/leaf-suggestions-core.ts` (pure, unit-tested): `buildLeafCandidates` +
  `rankLeafSuggestions` — event-type gate → already-planned exclusion →
  only-when-it-fits gate (≥1 available vendor, hide zero-result) → diversity
  re-rank (cross-tile, capped 2–3) via the merged `selectDiverseLeaves`.
- `lib/leaf-suggestions.ts` (server, defensive): assembles event context +
  `getCoverageTaxonomy()` leaves + `fetchVendorCountsByService` availability;
  returns [] on any failure.
- `checklist/page.tsx` calls it (graceful-degrade); `ChecklistFull` renders a
  "You might also want" card at the end of the list — only when there's a fit.

Additive + null-safe: no card when nothing fits or on any read error. Organic
availability only (no paid boost). No schema change.

SPEC IMPACT: PR-4 of `02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md`
§4. Corpus current.
