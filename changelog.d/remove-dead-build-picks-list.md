## 2026-07-27 · chore(vendors): delete dead BuildPicksList component

- `_components/build-picks-list.tsx` (`BuildPicksList`, 8.7 KB) had no importer anywhere —
  the Build slot has composed `MerkadoGuardBanner` + `Build3StateControl` + `BuildLocked` only
  since the 3-state solver rewrite (2026-06-16) + "Build absorbs Lock" (2026-06-20). Verified:
  repo-wide grep (incl. dynamic-import path strings + tests) finds only self-references.
- Fixed the two stale comments naming it as a `goToBuildTab` consumer
  (`lib/budget-build.ts`, `_components/services-takeover.tsx`).
- Server actions NOT touched: `removeBuildPick` keeps a live caller (`accordion-build.tsx`);
  ⚠ `clearBuildPicks` (build-pick-actions.ts) now has NO caller — left in place, flagged for
  an owner/dev decision (it may be wanted by the Explore IA replan in design).
- Verified: `tsc` clean · lint no new warnings.

SPEC IMPACT: None
